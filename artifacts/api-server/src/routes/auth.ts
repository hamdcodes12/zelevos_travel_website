import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, authTokensTable, notificationsTable, auditLogsTable, sessionsTable, emailOtpsTable } from "@workspace/db";
import {
  OAUTH_STATE_COOKIE,
  createSession,
  destroySession,
  generateOAuthState,
  generateCustomerId,
  generateNextCustomerId,
  hashPassword,
  normalizeEmail,
  publicUser,
  verifyOAuthState,
  verifyPassword,
  createRefreshToken,
  verifyRefreshToken,
} from "../lib/auth";
import { requireAuth } from "../middlewares/authMiddleware";
import { generateBase32Secret, getTotpAuthUrl, verifyTotp } from "../services/totp-service";
import { logger } from "../lib/logger";
import {
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendPasswordResetConfirmationEmail,
} from "../services/email-service";
import { requestSignupOtp, verifySignupOtp } from "../services/otp-service";

const router: IRouter = Router();

// In-memory OTP wrong-attempt tracking (max 5 attempts per 15-minute window)
const otpAttempts = new Map<string, { count: number; resetAt: number }>();

function recordOtpFailure(email: string): { locked: boolean; count: number } {
  const now = Date.now();
  const entry = otpAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    otpAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return { locked: false, count: 1 };
  }
  entry.count += 1;
  return { locked: entry.count >= 5, count: entry.count };
}

function clearOtpAttempts(email: string): void {
  otpAttempts.delete(email);
}


function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

const verifyOtpSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(320),
  otp: z.string().trim().min(6, "Verification code must be 6 digits.").max(6, "Verification code must be 6 digits."),
});

const resendOtpSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(320),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters.").max(100).optional(),
  email: z.string().trim().email("Please enter a valid email address.").max(320),
  password: z.string().min(8, "Password must be at least 8 characters long.").max(128),
  confirmPassword: z.string().min(8).max(128).optional(),
  phone: z.string().trim().max(30).optional(),
  referralCode: z.string().trim().max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(320),
  password: z.string().min(1, "Please enter your password.").max(128),
  totpCode: z.string().trim().optional(),
});

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(320),
});

const verifyPasswordResetOtpSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(320),
  otp: z.string().trim().length(6, "Verification code must be 6 digits."),
});

const passwordResetSchema = z.object({
  token: z.string().trim().min(6).max(256).optional(),
  resetToken: z.string().trim().min(6).max(256).optional(),
  password: z.string().min(8, "Password must be at least 8 characters long.").max(128),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters long.").max(128),
}).refine((data) => Boolean(data.token || data.resetToken), {
  message: "A valid reset authorization token is required.",
  path: ["resetToken"],
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match. Please re-enter.",
  path: ["confirmPassword"],
});

function hashAuthToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL?.trim() || "http://localhost:3000";
}

function getApiBaseUrl(req: any): string {
  if (process.env.API_BASE_URL?.trim()) {
    return process.env.API_BASE_URL.trim();
  }
  const host = req.get("host") || "localhost:8080";
  const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

function safeAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown authentication error.";
  return message.replace(/[\w.+-]+@[\w.-]+/g, "<redacted-email>").slice(0, 240);
}

function logAuthFailure(req: any, route: string, operation: string, error: unknown): void {
  const logFn = req.log?.error ? req.log.error.bind(req.log) : logger.error.bind(logger);
  logFn({
    route,
    operation,
    errorType: error instanceof Error ? error.name : typeof error,
    errorMessage: safeAuthErrorMessage(error),
  }, "Authentication operation failed");
}

// --------------------------------------------------------------------------
// 1. Current Authenticated User, Session Refresh & Provider Status
// --------------------------------------------------------------------------
router.get("/auth/user", (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ status: "unauthorized", message: "No active session." });
    return;
  }
  res.json({ user: publicUser(req.user) });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  if (req.isAuthenticated() && req.user) {
    await createSession(req.user.id, res);
    const refreshToken = createRefreshToken(req.user.id);
    res.json({ user: publicUser(req.user), refreshToken });
    return;
  }

  const rawToken = req.headers["x-refresh-token"] || req.body?.refreshToken;
  if (typeof rawToken === "string" && rawToken.trim()) {
    const verified = verifyRefreshToken(rawToken.trim());
    if (verified?.userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, verified.userId)).limit(1);
      if (user) {
        await createSession(user.id, res);
        const newRefreshToken = createRefreshToken(user.id);
        res.json({ user: publicUser(user), refreshToken: newRefreshToken });
        return;
      }
    }
  }

  res.status(401).json({ status: "unauthorized", message: "Invalid or expired session/refresh token." });
});

router.get("/auth/providers", (_req, res) => {
  res.json({ emailPassword: { enabled: true } });
});

// --------------------------------------------------------------------------
// 2. Email & Password Sign Up (with Email OTP Verification)
// --------------------------------------------------------------------------
router.post(["/auth/signup", "/auth/register"], async (req, res): Promise<void> => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Enter a valid email and a password of at least 8 characters.";
    res.status(400).json({ status: "invalid_request", message: msg, errors: parsed.error.issues });
    return;
  }

  const { email, password, confirmPassword, fullName, phone, referralCode } = parsed.data;

  // Validate confirmPassword if supplied
  if (confirmPassword !== undefined && password !== confirmPassword) {
    res.status(400).json({ status: "invalid_request", message: "Passwords do not match. Please re-enter." });
    return;
  }

  try {
    const ipAddress = typeof req.ip === "string" ? req.ip.slice(0, 45) : undefined;
    const result = await requestSignupOtp({
      email,
      fullName,
      phone,
      password,
      referralCode,
      ipAddress,
    });

    if (!result.success) {
      res.status(result.status).json({
        status: result.code,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      status: "otp_sent",
      message: result.message,
      email: result.email,
    });
  } catch (error) {
    logAuthFailure(req, "/api/auth/signup", "requesting signup otp", error);
    res.status(500).json({ status: "database_error", message: "Account action could not be completed. Please try again." });
  }
});

// --------------------------------------------------------------------------
// 2b. Verify Email OTP
// --------------------------------------------------------------------------
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: "invalid_request",
      message: parsed.error.issues[0]?.message || "Please enter a valid 6-digit verification code.",
    });
    return;
  }

  const { email, otp } = parsed.data;

  try {
    const ipAddress = typeof req.ip === "string" ? req.ip.slice(0, 45) : undefined;
    const result = await verifySignupOtp({
      email,
      otp,
      ipAddress,
    });

    if (!result.success) {
      res.status(result.status).json({
        status: result.code,
        message: result.message,
      });
      return;
    }

    // Create session cookie
    await createSession(result.user.id, res);
    const refreshToken = createRefreshToken(result.user.id);

    res.status(200).json({
      status: "verified",
      message: result.message,
      user: publicUser(result.user),
      refreshToken,
    });
  } catch (error) {
    logAuthFailure(req, "/api/auth/verify-otp", "verifying otp", error);
    res.status(500).json({ status: "server_error", message: "Failed to verify code. Please try again." });
  }
});

// --------------------------------------------------------------------------
// 2c. Resend Email OTP
// --------------------------------------------------------------------------
router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const parsed = resendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: "invalid_request",
      message: parsed.error.issues[0]?.message || "Please enter a valid email address.",
    });
    return;
  }

  const cleanEmail = normalizeEmail(parsed.data.email);

  try {
    const ipAddress = typeof req.ip === "string" ? req.ip.slice(0, 45) : undefined;
    const [recentOtp] = await db
      .select()
      .from(emailOtpsTable)
      .where(
        and(
          eq(emailOtpsTable.email, cleanEmail),
          eq(emailOtpsTable.purpose, "signup")
        )
      )
      .orderBy(desc(emailOtpsTable.createdAt))
      .limit(1);

    const metadata = (recentOtp?.metadata || {}) as Record<string, any>;
    const result = await requestSignupOtp({
      email: cleanEmail,
      fullName: metadata.fullName,
      phone: metadata.phone,
      referralCode: metadata.referralCode,
      ipAddress,
    });

    if (!result.success) {
      res.status(result.status).json({
        status: result.code,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      status: "otp_sent",
      message: `A new 6-digit verification code has been sent to ${cleanEmail}.`,
      email: cleanEmail,
    });
  } catch (error) {
    logAuthFailure(req, "/api/auth/resend-otp", "resending otp", error);
    res.status(500).json({ status: "server_error", message: "Failed to resend code. Please try again." });
  }
});

// --------------------------------------------------------------------------
// 3. Email & Password Login (Enforces Email Verification)
// --------------------------------------------------------------------------
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Enter a valid email and password.";
    res.status(400).json({ status: "invalid_request", message: msg });
    return;
  }

  let operation = "normalizing login email";
  try {
    const cleanEmail = normalizeEmail(parsed.data.email);
    operation = "finding user";
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

    if (!user) {
      res.status(401).json({ status: "invalid_credentials", message: "Email or password is incorrect." });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({
        status: "password_login_required",
        message: "This account does not have an email/password login. Use an email/password account or contact support.",
      });
      return;
    }

    if (!verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ status: "invalid_credentials", message: "Email or password is incorrect." });
      return;
    }

    // Enforce account active status (reject archived customer accounts)
    if (user.isArchived || user.status === "archived") {
      res.status(403).json({
        status: "account_unavailable",
        message: "Your account is currently unavailable. Please contact Zelevos Support.",
      });
      return;
    }

    // Existing users keep logging in normally and are not forced to verify (Section D Phase 2 Rule 6)

    // 2FA check
    if (user.totpEnabled && user.totpSecret) {
      const code = parsed.data.totpCode;
      if (!code) {
        res.status(200).json({
          status: "2fa_required",
          require2fa: true,
          message: "Two-factor authentication code is required to complete login.",
        });
        return;
      }
      if (!verifyTotp(user.totpSecret, code)) {
        res.status(401).json({ status: "invalid_2fa", message: "Invalid two-factor authentication code." });
        return;
      }
    }

    // Update lastLoginAt
    operation = "updating last login";
    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));
    user.lastLoginAt = new Date();

    operation = "creating session";
    await createSession(user.id, res);
    res.json({ user: publicUser(user) });
  } catch (error) {
    logAuthFailure(req, "/api/auth/login", operation, error);
    res.status(500).json({ status: "database_error", message: "Login could not be completed." });
  }
});

// --------------------------------------------------------------------------
// 4. Logout
// --------------------------------------------------------------------------
router.post("/auth/logout", async (req, res): Promise<void> => {
  try {
    await destroySession(req, res);
    res.status(200).json({ status: "success", message: "Logged out successfully." });
  } catch (error) {
    const logFn = req.log?.error ? req.log.error.bind(req.log) : logger.error.bind(logger);
    logFn({ err: error }, "Failed to log out user");
    res.status(500).json({ status: "database_error", message: "Logout could not be completed." });
  }
});

// --------------------------------------------------------------------------
// 4b. Two-Factor Authentication Management
// --------------------------------------------------------------------------
router.post("/auth/2fa/setup", requireAuth, async (req, res): Promise<void> => {
  const secret = generateBase32Secret(20);
  const authUrl = getTotpAuthUrl(req.user!.email, secret, "Zelevos");
  res.json({ status: "success", secret, authUrl });
});

router.post("/auth/2fa/enable", requireAuth, async (req, res): Promise<void> => {
  const schema = z.object({ secret: z.string().min(16), token: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !verifyTotp(parsed.data.secret, parsed.data.token)) {
    res.status(400).json({ status: "invalid_code", message: "Invalid 2FA verification code or secret." });
    return;
  }
  await db.update(usersTable).set({ totpEnabled: true, totpSecret: parsed.data.secret }).where(eq(usersTable.id, req.user!.id));
  res.json({ status: "success", message: "2FA successfully enabled for your account." });
});

router.post("/auth/2fa/disable", requireAuth, async (req, res): Promise<void> => {
  const schema = z.object({ token: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.totpSecret && (!parsed.success || !verifyTotp(user.totpSecret, parsed.data.token))) {
    res.status(400).json({ status: "invalid_code", message: "Invalid 2FA code to disable 2FA." });
    return;
  }
  await db.update(usersTable).set({ totpEnabled: false, totpSecret: null }).where(eq(usersTable.id, req.user!.id));
  res.json({ status: "success", message: "2FA successfully disabled." });
});

// --------------------------------------------------------------------------
// 4c. Secure Forgot Password + Email OTP + Password Reset Flow
// --------------------------------------------------------------------------

// 1. Request Reset OTP (Forgot Password / Resend OTP)
router.post(
  ["/auth/password/forgot", "/auth/forgot-password", "/auth/password/resend-otp", "/auth/resend-password-reset-otp"],
  async (req, res): Promise<void> => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        status: "invalid_request",
        message: parsed.error.issues[0]?.message || "A valid email address is required.",
      });
      return;
    }

    const cleanEmail = normalizeEmail(parsed.data.email);
    let debugOtp: string | undefined;

    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

      if (user && user.status === "active") {
        // Invalidate any prior unconsumed password reset OTPs or auth tokens for this user
        await db
          .update(authTokensTable)
          .set({ consumedAt: new Date() })
          .where(
            and(
              eq(authTokensTable.userId, user.id),
              or(
                eq(authTokensTable.purpose, "PASSWORD_RESET_OTP"),
                eq(authTokensTable.purpose, "PASSWORD_RESET_AUTH"),
                eq(authTokensTable.purpose, "PASSWORD_RESET")
              ),
              isNull(authTokensTable.consumedAt)
            )
          );

        // Generate cryptographically secure 6-digit numeric OTP
        const otp = generateOtp();
        const otpHash = hashAuthToken(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lifetime

        // Also generate a secure 32-byte direct reset token for direct link in email
        const directToken = crypto.randomBytes(32).toString("base64url");
        const directTokenHash = hashAuthToken(directToken);

        // Store OTP hash
        await db.insert(authTokensTable).values({
          userId: user.id,
          tokenHash: otpHash,
          purpose: "PASSWORD_RESET_OTP",
          expiresAt,
          attemptCount: 0,
        });

        // Store direct reset token hash (both are bound to this user and single-use)
        await db.insert(authTokensTable).values({
          userId: user.id,
          tokenHash: directTokenHash,
          purpose: "PASSWORD_RESET",
          expiresAt,
          attemptCount: 0,
        });

        // Audit log security event (no secrets logged)
        try {
          await db.insert(auditLogsTable).values({
            actorUserId: user.id,
            actorName: user.fullName || "User",
            actorRole: user.role,
            action: "PASSWORD_RESET_REQUESTED",
            resourceType: "user",
            resourceId: user.id,
            ipAddress: typeof req.ip === "string" ? req.ip.slice(0, 45) : null,
            metadata: { event: "PASSWORD_RESET_REQUESTED" },
          });
        } catch (auditErr) {
          logger.warn({ err: auditErr }, "Failed to write audit log for PASSWORD_RESET_REQUESTED");
        }

        // Send OTP via project's real email provider (SMTP / Resend)
        const emailResult = await sendPasswordResetOtpEmail(cleanEmail, otp, user.fullName, directToken);
        if (!emailResult.success) {
          logger.warn({ userId: user.id }, "Password reset OTP email could not be delivered");
        }
      } else {
        // Account enumeration protection: perform constant-time simulated hash
        crypto.createHash("sha256").update(cleanEmail + "constant_delay_salt").digest("hex");
      }
    } catch (error) {
      logAuthFailure(req, "/api/auth/password/forgot", "requesting password reset", error);
    }

    // Always return safe, generic response to prevent account enumeration
    const responsePayload: Record<string, unknown> = {
      success: true,
      status: "otp_sent",
      message: "If an account exists for this email, we’ll send a verification code.",
    };

    res.status(200).json(responsePayload);
  }
);

// 2. Verify Password Reset OTP
router.post(
  ["/auth/password/verify-otp", "/auth/verify-password-reset-otp"],
  async (req, res): Promise<void> => {
    const parsed = verifyPasswordResetOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        status: "invalid_request",
        message: parsed.error.issues[0]?.message || "Please enter a valid 6-digit verification code.",
      });
      return;
    }

    const cleanEmail = normalizeEmail(parsed.data.email);
    const { otp } = parsed.data;

    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
      if (!user) {
        res.status(400).json({
          success: false,
          status: "invalid_code",
          message: "The verification code is invalid or expired.",
        });
        return;
      }

      // Query active, unconsumed password reset OTP token for this user
      const [token] = await db
        .select()
        .from(authTokensTable)
        .where(
          and(
            eq(authTokensTable.userId, user.id),
            eq(authTokensTable.purpose, "PASSWORD_RESET_OTP"),
            isNull(authTokensTable.consumedAt),
            gt(authTokensTable.expiresAt, new Date())
          )
        )
        .orderBy(desc(authTokensTable.createdAt))
        .limit(1);

      if (!token) {
        res.status(400).json({
          success: false,
          status: "invalid_code",
          message: "The verification code is invalid or expired.",
        });
        return;
      }

      // Check max failed attempts (brute force protection, max 5 attempts)
      if ((token.attemptCount || 0) >= 5) {
        await db
          .update(authTokensTable)
          .set({ consumedAt: new Date() })
          .where(eq(authTokensTable.id, token.id));

        try {
          await db.insert(auditLogsTable).values({
            actorUserId: user.id,
            actorName: user.fullName || "User",
            actorRole: user.role,
            action: "PASSWORD_RESET_FAILED",
            resourceType: "user",
            resourceId: user.id,
            ipAddress: typeof req.ip === "string" ? req.ip.slice(0, 45) : null,
            metadata: { reason: "max_attempts_exceeded" },
          });
        } catch {
          // Ignore audit error
        }

        res.status(429).json({
          success: false,
          status: "too_many_attempts",
          message: "Too many failed attempts. Please request a new verification code.",
        });
        return;
      }

      // Cryptographically compare OTP hashes using timingSafeEqual
      const incomingHash = hashAuthToken(otp);
      const incomingBuf = Buffer.from(incomingHash, "utf-8");
      const storedBuf = Buffer.from(token.tokenHash, "utf-8");
      const isMatch = incomingBuf.length === storedBuf.length && crypto.timingSafeEqual(incomingBuf, storedBuf);

      if (!isMatch) {
        const nextAttempts = (token.attemptCount || 0) + 1;
        if (nextAttempts >= 5) {
          // Lock out and invalidate this OTP
          await db
            .update(authTokensTable)
            .set({ attemptCount: nextAttempts, consumedAt: new Date() })
            .where(eq(authTokensTable.id, token.id));

          res.status(429).json({
            success: false,
            status: "too_many_attempts",
            message: "Too many failed attempts. Please request a new verification code.",
          });
          return;
        }

        await db
          .update(authTokensTable)
          .set({ attemptCount: nextAttempts })
          .where(eq(authTokensTable.id, token.id));

        res.status(400).json({
          success: false,
          status: "invalid_code",
          message: "The verification code is invalid or expired.",
        });
        return;
      }

      // OTP is valid! Mark it consumed immediately (single-use rule)
      await db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(eq(authTokensTable.id, token.id));

      // Issue short-lived password-reset authorization token (15 minutes)
      const resetToken = crypto.randomBytes(32).toString("base64url");
      const resetTokenHash = hashAuthToken(resetToken);
      const authExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.insert(authTokensTable).values({
        userId: user.id,
        tokenHash: resetTokenHash,
        purpose: "PASSWORD_RESET_AUTH",
        expiresAt: authExpiresAt,
        attemptCount: 0,
      });

      // Audit log: PASSWORD_RESET_OTP_VERIFIED
      try {
        await db.insert(auditLogsTable).values({
          actorUserId: user.id,
          actorName: user.fullName || "User",
          actorRole: user.role,
          action: "PASSWORD_RESET_OTP_VERIFIED",
          resourceType: "user",
          resourceId: user.id,
          ipAddress: typeof req.ip === "string" ? req.ip.slice(0, 45) : null,
          metadata: { event: "PASSWORD_RESET_OTP_VERIFIED" },
        });
      } catch {
        // Ignore audit error
      }

      res.status(200).json({
        success: true,
        status: "otp_verified",
        resetToken,
        message: "Verification code confirmed. You can now set a new password.",
      });
    } catch (error) {
      logAuthFailure(req, "/api/auth/password/verify-otp", "verifying password reset otp", error);
      res.status(500).json({
        success: false,
        status: "server_error",
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

// 3. Reset Password with Reset Authorization Token
router.post(
  ["/auth/password/reset", "/auth/reset-password"],
  async (req, res): Promise<void> => {
    const parsed = passwordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Please provide matching passwords of at least 8 characters.";
      res.status(400).json({
        success: false,
        status: "invalid_request",
        message: msg,
      });
      return;
    }

    const rawToken = parsed.data.resetToken || parsed.data.token || "";
    const { password } = parsed.data;

    try {
      const tokenHash = hashAuthToken(rawToken);

      // Find active reset authorization token
      const [token] = await db
        .select()
        .from(authTokensTable)
        .where(
          and(
            eq(authTokensTable.tokenHash, tokenHash),
            or(
              eq(authTokensTable.purpose, "PASSWORD_RESET_AUTH"),
              eq(authTokensTable.purpose, "PASSWORD_RESET"),
              eq(authTokensTable.purpose, "PASSWORD_RESET_OTP")
            ),
            isNull(authTokensTable.consumedAt),
            gt(authTokensTable.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!token) {
        res.status(400).json({
          success: false,
          status: "invalid_token",
          message: "This password reset session is invalid or expired. Please start over.",
        });
        return;
      }

      // Verify user account exists and is valid
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, token.userId)).limit(1);
      if (!user) {
        res.status(400).json({
          success: false,
          status: "user_not_found",
          message: "Account could not be found.",
        });
        return;
      }

      // Hash new password using existing secure scrypt hashing
      const newPasswordHash = hashPassword(password);

      // Atomically:
      // 1. Update user password
      await db
        .update(usersTable)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      // 2. Mark current reset authorization token as consumed
      await db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(eq(authTokensTable.id, token.id));

      // 3. Invalidate any remaining unconsumed password reset OTPs or auth tokens for this user
      await db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(authTokensTable.userId, user.id),
            or(
              eq(authTokensTable.purpose, "PASSWORD_RESET_OTP"),
              eq(authTokensTable.purpose, "PASSWORD_RESET_AUTH"),
              eq(authTokensTable.purpose, "PASSWORD_RESET")
            ),
            isNull(authTokensTable.consumedAt)
          )
        );

      // 4. Invalidate all active user sessions so old sessions cannot be hijacked
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));

      // 5. Audit log: PASSWORD_RESET_SUCCESS
      try {
        await db.insert(auditLogsTable).values({
          actorUserId: user.id,
          actorName: user.fullName || "User",
          actorRole: user.role,
          action: "PASSWORD_RESET_SUCCESS",
          resourceType: "user",
          resourceId: user.id,
          ipAddress: typeof req.ip === "string" ? req.ip.slice(0, 45) : null,
          metadata: { event: "PASSWORD_RESET_SUCCESS" },
        });
      } catch {
        // Ignore audit error
      }

      // 6. Send confirmation email (non-blocking)
      void sendPasswordResetConfirmationEmail(user.email, user.fullName);

      res.status(200).json({
        success: true,
        status: "reset_success",
        message: "Your password has been updated successfully. Please log in with your new password.",
      });
    } catch (error) {
      logAuthFailure(req, "/api/auth/password/reset", "updating password after reset", error);
      res.status(500).json({
        success: false,
        status: "server_error",
        message: "Your password could not be updated. Please try again.",
      });
    }
  }
);

router.post("/auth/password/change", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ status: "unauthorized", message: "Please log in to change your password." });
    return;
  }
  const parsed = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }).safeParse(req.body);
  if (!parsed.success || !verifyPassword(parsed.data.currentPassword, req.user!.passwordHash || "")) {
    res.status(400).json({ status: "invalid_password", message: "Current password is incorrect or the new password is invalid." });
    return;
  }
  await db.update(usersTable).set({ passwordHash: hashPassword(parsed.data.newPassword), updatedAt: new Date() }).where(eq(usersTable.id, req.user!.id));
  res.json({ status: "updated", message: "Password changed successfully." });
});

// Social authentication was removed from the product. Keep the old paths
// explicitly unavailable so stale clients cannot initiate an OAuth flow.
router.use((req, res, next) => {
  if (/^\/auth\/(google|facebook)(\/|$)/.test(req.path)) {
    res.status(404).json({ status: "not_found", message: "Social authentication is not supported." });
    return;
  }
  next();
});

// --------------------------------------------------------------------------
// Legacy OAuth handlers retained below only for source compatibility.
// --------------------------------------------------------------------------
router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const frontendUrl = getFrontendUrl();

  if (!clientId || !clientSecret) {
    const errorMsg = "Google OAuth is not configured yet. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env.";
    if (req.accepts("html")) {
      res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent(errorMsg)}`);
    } else {
      res.status(501).json({ status: "not_configured", message: errorMsg });
    }
    return;
  }

  const redirectUrl = typeof req.query.redirectUrl === "string" ? req.query.redirectUrl : "/";
  const state = generateOAuthState("google", redirectUrl);

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });

  const callbackUrl = `${getApiBaseUrl(req)}/api/auth/google/callback`;
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  res.redirect(googleAuthUrl.toString());
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const frontendUrl = getFrontendUrl();
  const { code, state, error } = req.query;

  if (error) {
    req.log.warn({ error }, "Google OAuth reported user cancellation or error");
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (typeof code !== "string" || typeof state !== "string") {
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent("Missing authorization code or state.")}`);
    return;
  }

  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  const stateValidation = verifyOAuthState(state, "google");
  if (!stateValidation.valid || cookieState !== state) {
    req.log.warn("Google OAuth state mismatch or expired");
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent("OAuth state validation failed or expired. Please try again.")}`);
    return;
  }
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()!;
  const callbackUrl = `${getApiBaseUrl(req)}/api/auth/google/callback`;

  try {
    // 1. Exchange code for Google access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Failed to exchange Google OAuth code.");
    }

    // 2. Fetch Google User Profile
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileResponse.json() as { sub: string; email: string; name?: string; email_verified?: boolean };

    if (!profileResponse.ok || !profileData.email) {
      throw new Error("Unable to retrieve verified email from Google account.");
    }

    const cleanEmail = normalizeEmail(profileData.email);

    // 3. Find or Create User
    let [user] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, cleanEmail), eq(usersTable.providerAccountId, profileData.sub)))
      .limit(1);

    if (user) {
      const updates: Record<string, any> = { lastLoginAt: new Date() };
      if (!user.providerAccountId) {
        updates.providerAccountId = profileData.sub;
        updates.authProvider = user.authProvider || "google";
        updates.emailVerified = profileData.email_verified ?? true;
        updates.fullName = user.fullName || profileData.name || cleanEmail.split("@")[0];
      }
      if (!user.customerId) {
        updates.customerId = generateCustomerId();
      }
      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated;
    } else {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          customerId: generateCustomerId(),
          email: cleanEmail,
          fullName: profileData.name || cleanEmail.split("@")[0],
          authProvider: "google",
          providerAccountId: profileData.sub,
          emailVerified: profileData.email_verified ?? true,
          status: "active",
          lastLoginAt: new Date(),
          passwordHash: null,
        })
        .returning();
      user = newUser;
    }

    // 4. Create Session
    await createSession(user.id, res);
    const dest = stateValidation.redirectUrl && stateValidation.redirectUrl.startsWith("/") ? stateValidation.redirectUrl : "/";
    res.redirect(`${frontendUrl}${dest.includes("?") ? `${dest}&` : `${dest}?`}auth_success=1`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth token exchange or profile fetch failed");
    const msg = err instanceof Error ? err.message : "Google authentication encountered an unexpected error.";
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent(msg)}`);
  }
});

// --------------------------------------------------------------------------
// 6. Facebook OAuth 2.0 Integration
// --------------------------------------------------------------------------
router.get("/auth/facebook", (req, res): void => {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  const frontendUrl = getFrontendUrl();

  if (!appId || !appSecret) {
    const errorMsg = "Facebook OAuth is not configured yet. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in backend .env.";
    if (req.accepts("html")) {
      res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent(errorMsg)}`);
    } else {
      res.status(501).json({ status: "not_configured", message: errorMsg });
    }
    return;
  }

  const redirectUrl = typeof req.query.redirectUrl === "string" ? req.query.redirectUrl : "/";
  const state = generateOAuthState("facebook", redirectUrl);

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });

  const callbackUrl = `${getApiBaseUrl(req)}/api/auth/facebook/callback`;
  const fbAuthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  fbAuthUrl.searchParams.set("client_id", appId);
  fbAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  fbAuthUrl.searchParams.set("state", state);
  fbAuthUrl.searchParams.set("scope", "email,public_profile");

  res.redirect(fbAuthUrl.toString());
});

router.get("/auth/facebook/callback", async (req, res): Promise<void> => {
  const frontendUrl = getFrontendUrl();
  const { code, state, error, error_description } = req.query;

  if (error) {
    req.log.warn({ error, error_description }, "Facebook OAuth reported cancellation or error");
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent(String(error_description || error))}`);
    return;
  }

  if (typeof code !== "string" || typeof state !== "string") {
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent("Missing authorization code or state.")}`);
    return;
  }

  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  const stateValidation = verifyOAuthState(state, "facebook");
  if (!stateValidation.valid || cookieState !== state) {
    req.log.warn("Facebook OAuth state mismatch or expired");
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent("OAuth state validation failed or expired. Please try again.")}`);
    return;
  }
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

  const appId = process.env.FACEBOOK_APP_ID?.trim()!;
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim()!;
  const callbackUrl = `${getApiBaseUrl(req)}/api/auth/facebook/callback`;

  try {
    // 1. Exchange code for Facebook Access Token
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", callbackUrl);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || "Failed to exchange Facebook OAuth code.");
    }

    // 2. Fetch Facebook User Profile
    const profileUrl = new URL("https://graph.facebook.com/me");
    profileUrl.searchParams.set("fields", "id,name,email");
    profileUrl.searchParams.set("access_token", tokenData.access_token);

    const profileResponse = await fetch(profileUrl.toString());
    const profileData = await profileResponse.json() as { id: string; name?: string; email?: string };

    if (!profileResponse.ok || !profileData.id) {
      throw new Error("Unable to retrieve profile from Facebook account.");
    }

    const email = profileData.email ? normalizeEmail(profileData.email) : `fb_${profileData.id}@facebook.user.zelevos`;

    // 3. Find or Create User
    let [user] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, email), eq(usersTable.providerAccountId, profileData.id)))
      .limit(1);

    if (user) {
      const updates: Record<string, any> = { lastLoginAt: new Date() };
      if (!user.providerAccountId) {
        updates.providerAccountId = profileData.id;
        updates.authProvider = user.authProvider || "facebook";
        updates.fullName = user.fullName || profileData.name || email.split("@")[0];
      }
      if (!user.customerId) {
        updates.customerId = generateCustomerId();
      }
      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated;
    } else {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          customerId: generateCustomerId(),
          email,
          fullName: profileData.name || email.split("@")[0],
          authProvider: "facebook",
          providerAccountId: profileData.id,
          emailVerified: Boolean(profileData.email),
          status: "active",
          lastLoginAt: new Date(),
          passwordHash: null,
        })
        .returning();
      user = newUser;
    }

    // 4. Create Session
    await createSession(user.id, res);
    const dest = stateValidation.redirectUrl && stateValidation.redirectUrl.startsWith("/") ? stateValidation.redirectUrl : "/";
    res.redirect(`${frontendUrl}${dest.includes("?") ? `${dest}&` : `${dest}?`}auth_success=1`);
  } catch (err) {
    req.log.error({ err }, "Facebook OAuth token exchange or profile fetch failed");
    const msg = err instanceof Error ? err.message : "Facebook authentication encountered an unexpected error.";
    res.redirect(`${frontendUrl}/?oauth_error=${encodeURIComponent(msg)}`);
  }
});

export default router;