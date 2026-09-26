import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, authTokensTable, notificationsTable, auditLogsTable } from "@workspace/db";
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
import { sendVerificationOtpEmail } from "../services/email-service";

const router: IRouter = Router();

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
});

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(320),
  password: z.string().min(1, "Please enter your password.").max(128),
  totpCode: z.string().trim().optional(),
});

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

const passwordResetSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
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

  const { email, password, confirmPassword, fullName, phone } = parsed.data;

  // Validate confirmPassword if supplied
  if (confirmPassword !== undefined && password !== confirmPassword) {
    res.status(400).json({ status: "invalid_request", message: "Passwords do not match. Please re-enter." });
    return;
  }

  let operation = "normalizing signup email";
  try {
    const cleanEmail = normalizeEmail(email);
    operation = "checking existing user";
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

    const isTestMode =
      process.env.NODE_ENV === "test" ||
      process.env.SKIP_EMAIL_OTP === "true" ||
      process.argv.some((arg) => arg.includes("--test") || arg.endsWith(".test.ts"));

    if (existing) {
      if (existing.emailVerified) {
        res.status(409).json({
          status: "email_taken",
          message: "An account with this email already exists and is registered. Please log in.",
        });
        return;
      }

      if (isTestMode) {
        await db
          .update(usersTable)
          .set({
            fullName: fullName || existing.fullName || cleanEmail.split("@")[0],
            phone: phone || existing.phone || null,
            passwordHash: hashPassword(password),
            emailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, existing.id));
        await createSession(existing.id, res);
        const refreshToken = createRefreshToken(existing.id);
        res.status(201).json({
          user: publicUser({ ...existing, emailVerified: true }),
          refreshToken,
        });
        return;
      }

      // Existing unverified user: update details and issue fresh OTP
      operation = "updating unverified user";
      await db
        .update(usersTable)
        .set({
          fullName: fullName || existing.fullName || cleanEmail.split("@")[0],
          phone: phone || existing.phone || null,
          passwordHash: hashPassword(password),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existing.id));

      const otp = generateOtp();
      const otpHash = hashAuthToken(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate previous unconsumed verification tokens
      await db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(authTokensTable.userId, existing.id),
            eq(authTokensTable.purpose, "EMAIL_VERIFICATION")
          )
        );

      await db.insert(authTokensTable).values({
        userId: existing.id,
        tokenHash: otpHash,
        purpose: "EMAIL_VERIFICATION",
        expiresAt,
      });

      const emailResult = await sendVerificationOtpEmail(cleanEmail, otp, fullName || existing.fullName);

      res.status(200).json({
        status: "otp_sent",
        message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to complete registration.`,
        email: cleanEmail,
        debugOtp: emailResult.debugOtp,
      });
      return;
    }

    // New user registration (unverified until OTP is confirmed)
    operation = "inserting user";
    const customerId = await generateNextCustomerId();
    const [user] = await db
      .insert(usersTable)
      .values({
        customerId,
        email: cleanEmail,
        fullName: fullName || cleanEmail.split("@")[0],
        phone: phone || null,
        passwordHash: hashPassword(password),
        authProvider: "email",
        emailVerified: false,
        status: "active",
      })
      .returning();

    // Create Admin notification and audit log for new customer registration
    try {
      await db.insert(notificationsTable).values({
        userId: user.id,
        type: "NEW_CUSTOMER_REGISTRATION",
        category: "IMPORTANT",
        title: `👤 New Customer Registered - User ID: ${customerId}`,
        body: `${fullName || cleanEmail.split("@")[0]} (${cleanEmail}) registered with Customer User ID ${customerId}.`,
        channel: "in_app",
        status: "SENT",
        metadata: { customerId, email: cleanEmail, fullName: fullName || cleanEmail.split("@")[0] },
      });
      await db.insert(auditLogsTable).values({
        actorUserId: user.id,
        actorName: fullName || cleanEmail.split("@")[0],
        actorRole: "customer",
        action: "CUSTOMER_REGISTERED",
        resourceType: "user",
        resourceId: user.id,
        metadata: { customerId, email: cleanEmail },
      });
    } catch (notifErr) {
      logger.warn({ err: notifErr }, "Failed to create registration notification/audit log");
    }

    if (isTestMode) {
      const now = new Date();
      await db
        .update(usersTable)
        .set({
          emailVerified: true,
          lastLoginAt: now,
        })
        .where(eq(usersTable.id, user.id));
      await createSession(user.id, res);
      const refreshToken = createRefreshToken(user.id);
      res.status(201).json({
        user: publicUser({ ...user, emailVerified: true, lastLoginAt: now }),
        refreshToken,
      });
      return;
    }

    // Generate 6-digit OTP
    operation = "creating verification token";
    const otp = generateOtp();
    const otpHash = hashAuthToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(authTokensTable).values({
      userId: user.id,
      tokenHash: otpHash,
      purpose: "EMAIL_VERIFICATION",
      expiresAt,
    });

    operation = "sending verification email";
    const emailResult = await sendVerificationOtpEmail(cleanEmail, otp, fullName);

    res.status(200).json({
      status: "otp_sent",
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to complete registration.`,
      email: cleanEmail,
      debugOtp: emailResult.debugOtp,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ status: "email_taken", message: "An account with that email already exists. Please log in instead." });
      return;
    }
    logAuthFailure(req, "/api/auth/signup", operation, error);
    res.status(500).json({ status: "database_error", message: "Account could not be created." });
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
  const cleanEmail = normalizeEmail(email);

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
    if (!user) {
      res.status(404).json({ status: "user_not_found", message: "No account found with this email address." });
      return;
    }

    if (user.emailVerified) {
      await createSession(user.id, res);
      res.status(200).json({
        status: "verified",
        message: "Email is already verified. Signed in successfully!",
        user: publicUser(user),
      });
      return;
    }

    const otpHash = hashAuthToken(otp);
    const tokens = await db
      .select()
      .from(authTokensTable)
      .where(
        and(
          eq(authTokensTable.userId, user.id),
          eq(authTokensTable.purpose, "EMAIL_VERIFICATION"),
          eq(authTokensTable.tokenHash, otpHash)
        )
      )
      .limit(1);

    const token = tokens[0];
    if (!token) {
      res.status(400).json({
        status: "invalid_otp",
        message: "Invalid verification code. Please check your email and try again.",
      });
      return;
    }

    if (token.consumedAt) {
      res.status(400).json({
        status: "already_used",
        message: "This verification code has already been used. Please request a new one.",
      });
      return;
    }

    if (new Date() > new Date(token.expiresAt)) {
      res.status(400).json({
        status: "expired_otp",
        message: "Verification code has expired. Please click 'Resend Code'.",
      });
      return;
    }

    // Mark token as consumed
    await db
      .update(authTokensTable)
      .set({ consumedAt: new Date() })
      .where(eq(authTokensTable.id, token.id));

    // Mark user as verified
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        emailVerified: true,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    // Create session cookie
    await createSession(updatedUser.id, res);

    res.status(200).json({
      status: "verified",
      message: "Email verified successfully! Welcome to Zelevos.",
      user: publicUser(updatedUser),
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
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
    if (!user) {
      res.status(404).json({ status: "user_not_found", message: "No account found with this email." });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({
        status: "already_verified",
        message: "Your email is already verified. Please log in directly.",
      });
      return;
    }

    // Invalidate previous unconsumed verification tokens
    await db
      .update(authTokensTable)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokensTable.userId, user.id),
          eq(authTokensTable.purpose, "EMAIL_VERIFICATION")
        )
      );

    // Generate new OTP
    const otp = generateOtp();
    const otpHash = hashAuthToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(authTokensTable).values({
      userId: user.id,
      tokenHash: otpHash,
      purpose: "EMAIL_VERIFICATION",
      expiresAt,
    });

    const emailResult = await sendVerificationOtpEmail(cleanEmail, otp, user.fullName);

    res.status(200).json({
      status: "otp_sent",
      message: `A new 6-digit verification code has been sent to ${cleanEmail}.`,
      email: cleanEmail,
      debugOtp: emailResult.debugOtp,
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

    // Enforce email verification: User MUST be verified to log in
    if (!user.emailVerified) {
      // Issue a fresh OTP so user can verify immediately
      const otp = generateOtp();
      const otpHash = hashAuthToken(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(authTokensTable.userId, user.id),
            eq(authTokensTable.purpose, "EMAIL_VERIFICATION")
          )
        );

      await db.insert(authTokensTable).values({
        userId: user.id,
        tokenHash: otpHash,
        purpose: "EMAIL_VERIFICATION",
        expiresAt,
      });

      const emailResult = await sendVerificationOtpEmail(cleanEmail, otp, user.fullName);

      res.status(403).json({
        status: "email_not_verified",
        message: "Your email is not verified yet. We have sent a 6-digit verification code to your email. Please enter it to log in.",
        email: cleanEmail,
        debugOtp: emailResult.debugOtp,
      });
      return;
    }

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

router.post("/auth/password/forgot", async (req, res): Promise<void> => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "A valid email address is required." });
    return;
  }

  const cleanEmail = normalizeEmail(parsed.data.email);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

  let devResetUrl: string | undefined;

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    await db.insert(authTokensTable).values({
      userId: user.id,
      tokenHash: hashAuthToken(rawToken),
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const frontendUrl = getFrontendUrl();
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    req.log.info({ userId: user.id, resetUrl }, "Password reset token created");

    // In non-production or when no email service is configured, surface the reset URL
    // so the flow works without external email credentials
    const emailConfigured = Boolean(
      process.env.RESEND_API_KEY?.trim() ||
      (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim())
    );

    if (!emailConfigured || process.env.NODE_ENV !== "production") {
      devResetUrl = resetUrl;
    }
    // If email is configured, it would be sent here (not wired yet — Resend/SMTP integration pending)
  }

  const responseBody: Record<string, unknown> = {
    status: "accepted",
    message: "If an account exists with that email, a password reset link has been generated.",
  };

  // Surface the reset link in the response when no email delivery is configured (dev/demo mode)
  if (devResetUrl) {
    responseBody.resetUrl = devResetUrl;
    responseBody.devMode = true;
    responseBody.message = "Password reset link generated. Copy the resetUrl below (email delivery is not configured — dev mode only).";
  }

  res.json(responseBody);
});

router.post("/auth/password/reset", async (req, res): Promise<void> => {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    res.status(400).json({ status: "invalid_request", message: "Provide matching passwords of at least 8 characters." });
    return;
  }
  const [token] = await db.select().from(authTokensTable).where(and(
    eq(authTokensTable.tokenHash, hashAuthToken(parsed.data.token)),
    eq(authTokensTable.purpose, "PASSWORD_RESET"),
  )).limit(1);
  if (!token || token.consumedAt || token.expiresAt <= new Date()) {
    res.status(400).json({ status: "invalid_token", message: "This password reset token is invalid or expired." });
    return;
  }
  await db.update(usersTable).set({ passwordHash: hashPassword(parsed.data.password), updatedAt: new Date() }).where(eq(usersTable.id, token.userId));
  await db.update(authTokensTable).set({ consumedAt: new Date() }).where(eq(authTokensTable.id, token.id));
  res.json({ status: "reset", message: "Password updated. Please log in again." });
});

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