import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, authTokensTable } from "@workspace/db";
import {
  OAUTH_STATE_COOKIE,
  createSession,
  destroySession,
  generateOAuthState,
  generateCustomerId,
  hashPassword,
  normalizeEmail,
  publicUser,
  verifyOAuthState,
  verifyPassword,
  createRefreshToken,
  verifyRefreshToken,
} from "../lib/auth";
import { getSupabaseConfigStatus } from "../lib/supabase";

const router: IRouter = Router();

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
  req.log.error({
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
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  const hasFacebook = Boolean(process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim());

  res.json({
    supabase: getSupabaseConfigStatus(),
    google: {
      enabled: hasGoogle,
      clientId: hasGoogle ? process.env.GOOGLE_CLIENT_ID?.trim() : null,
      message: hasGoogle
        ? "Google OAuth is enabled."
        : "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env.",
    },
    facebook: {
      enabled: hasFacebook,
      appId: hasFacebook ? process.env.FACEBOOK_APP_ID?.trim() : null,
      message: hasFacebook
        ? "Facebook OAuth is enabled."
        : "Facebook OAuth is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in backend .env.",
    },
  });
});

// --------------------------------------------------------------------------
// 2. Email & Password Sign Up
// --------------------------------------------------------------------------
router.post("/auth/signup", async (req, res): Promise<void> => {
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
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ status: "email_taken", message: "An account with that email already exists. Please log in instead." });
      return;
    }

    operation = "inserting user";
    const customerId = generateCustomerId();
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
        lastLoginAt: new Date(),
      })
      .returning();

    operation = "creating session";
    await createSession(user.id, res);
    res.status(201).json({ user: publicUser(user) });
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
// 3. Email & Password Login
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
        status: "oauth_account",
        message: `This account was registered using ${user.authProvider || "social login"}. Please continue with ${user.authProvider === "google" ? "Google" : user.authProvider === "facebook" ? "Facebook" : "social sign-in"}.`,
      });
      return;
    }

    if (!verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ status: "invalid_credentials", message: "Email or password is incorrect." });
      return;
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
    res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Failed to log out user");
    res.status(500).json({ status: "database_error", message: "Logout could not be completed." });
  }
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

// --------------------------------------------------------------------------
// 5. Google OAuth 2.0 Integration
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

    const email = profileData.email ? normalizeEmail(profileData.email) : `fb_${profileData.id}@facebook.user.wayora`;

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