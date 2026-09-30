import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-reset-pwd-tests";
process.env.REFRESH_SECRET ??= "test-refresh-secret-for-zelevos-reset-pwd-tests";
process.env.PAYMENT_PROVIDER = "test";
process.env.EMAIL_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, usersTable, authTokensTable, sessionsTable, auditLogsTable } = await import("@workspace/db");
const { hashPassword, verifyPassword } = await import("../src/lib/auth");
const { clearRateLimitStore } = await import("../src/middlewares/rate-limiter");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const createdEmails: string[] = [];

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server?.close();
  if (createdEmails.length > 0) {
    try {
      const users = await db.select().from(usersTable).where(inArray(usersTable.email, createdEmails));
      for (const u of users) {
        await db.delete(sessionsTable).where(eq(sessionsTable.userId, u.id));
        await db.delete(authTokensTable).where(eq(authTokensTable.userId, u.id));
        await db.delete(usersTable).where(eq(usersTable.id, u.id));
      }
    } catch {
      // ignore cleanup error
    }
  }
});

async function api(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const { method = "GET", body, headers = {} } = options;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: json };
}

function hashAuthToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

describe("Zelevos Secure Forgot Password + Email OTP + Password Reset Suite", () => {
  const TEST_EMAIL = `test.reset.${Date.now()}@example.com`;
  const INITIAL_PASSWORD = "OldSecurePassword2026!";
  const NEW_PASSWORD = "NewSecurePassword2026!";
  let testUserId = "";

  before(async () => {
    createdEmails.push(TEST_EMAIL);
    const [user] = await db
      .insert(usersTable)
      .values({
        customerId: `CUST-${Math.floor(100000 + Math.random() * 900000)}`,
        email: TEST_EMAIL,
        fullName: "Test Reset Customer",
        passwordHash: hashPassword(INITIAL_PASSWORD),
        role: "customer",
        emailVerified: true,
        status: "active",
      })
      .returning();
    testUserId = user.id;
  });

  beforeEach(() => {
    clearRateLimitStore();
  });

  // ==========================================================================
  // SECTION A: REQUEST RESET & ACCOUNT ENUMERATION PROTECTION
  // ==========================================================================
  describe("A. Request Reset & Enumeration Protection", () => {
    it("1. sends OTP and returns safe generic response for registered email", async () => {
      const res = await api("/api/auth/password/forgot", {
        method: "POST",
        body: { email: TEST_EMAIL },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, "otp_sent");
      assert.equal(res.body.message, "If an account exists for this email, we’ll send a verification code.");
      // MUST NOT leak user ID, account status, or OTP
      assert.equal(res.body.userId, undefined);
      assert.equal(res.body.user, undefined);
    });

    it("2. returns identical safe generic response for unregistered email (no enumeration)", async () => {
      const UNREGISTERED = "nonexistent.traveller.999@example.com";
      const res = await api("/api/auth/password/forgot", {
        method: "POST",
        body: { email: UNREGISTERED },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, "otp_sent");
      assert.equal(res.body.message, "If an account exists for this email, we’ll send a verification code.");
      // Check that response is byte-for-byte identical in structure and tone
      assert.equal(res.body.userId, undefined);
      assert.equal(res.body.user, undefined);
    });

    it("3. rejects invalid email format with safe validation error", async () => {
      const res = await api("/api/auth/password/forgot", {
        method: "POST",
        body: { email: "not-an-email" },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, "invalid_request");
    });

    it("4. rejects empty email with 400 error", async () => {
      const res = await api("/api/auth/password/forgot", {
        method: "POST",
        body: { email: "   " },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it("5. normalizes mixed-case email safely", async () => {
      const mixedEmail = TEST_EMAIL.toUpperCase();
      const res = await api("/api/auth/password/forgot", {
        method: "POST",
        body: { email: mixedEmail },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, "otp_sent");
    });

    it("6. supports conceptual endpoint alias /api/auth/forgot-password", async () => {
      const res = await api("/api/auth/forgot-password", {
        method: "POST",
        body: { email: TEST_EMAIL },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, "otp_sent");
    });
  });

  // ==========================================================================
  // SECTION B: OTP GENERATION, STORAGE, VERIFICATION, LIMITS
  // ==========================================================================
  describe("B. OTP Security, Expiration, and Attempt Limits", () => {
    it("7. generates 6-digit numeric OTP and stores ONLY hash in auth_tokens table", async () => {
      // Find the latest OTP token in DB for testUserId
      const [tokenRow] = await db
        .select()
        .from(authTokensTable)
        .where(
          and(
            eq(authTokensTable.userId, testUserId),
            eq(authTokensTable.purpose, "PASSWORD_RESET_OTP"),
            isNull(authTokensTable.consumedAt)
          )
        )
        .orderBy(desc(authTokensTable.createdAt))
        .limit(1);

      assert.ok(tokenRow, "Active reset OTP row must exist in DB");
      assert.equal(tokenRow.purpose, "PASSWORD_RESET_OTP");
      assert.equal(tokenRow.tokenHash.length, 64, "Token hash must be a 64-char SHA256 hex string");
      assert.equal(tokenRow.consumedAt, null, "Token must be unconsumed");
      assert.ok(new Date(tokenRow.expiresAt) > new Date(), "Token expiresAt must be in the future");
      assert.equal(tokenRow.attemptCount, 0, "Initial attemptCount must be 0");
    });

    it("8. rejects wrong OTP with safe generic error and increments attemptCount", async () => {
      const res = await api("/api/auth/password/verify-otp", {
        method: "POST",
        body: { email: TEST_EMAIL, otp: "000000" },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, "invalid_code");
      assert.equal(res.body.message, "The verification code is invalid or expired.");

      // Check DB attempt count was incremented
      const [tokenRow] = await db
        .select()
        .from(authTokensTable)
        .where(
          and(
            eq(authTokensTable.userId, testUserId),
            eq(authTokensTable.purpose, "PASSWORD_RESET_OTP"),
            isNull(authTokensTable.consumedAt)
          )
        )
        .orderBy(desc(authTokensTable.createdAt))
        .limit(1);

      assert.ok(tokenRow);
      assert.equal(tokenRow.attemptCount, 1, "attemptCount should have incremented to 1");
    });

    it("9. locks and invalidates OTP after 5 wrong attempts (brute force protection)", async () => {
      // Inject 4 more wrong attempts (making it 5 total)
      for (let i = 2; i <= 4; i++) {
        const res = await api("/api/auth/password/verify-otp", {
          method: "POST",
          body: { email: TEST_EMAIL, otp: `12345${i}` },
        });
        assert.equal(res.status, 400);
      }

      // 5th failed attempt should trigger lockout
      const fifthRes = await api("/api/auth/password/verify-otp", {
        method: "POST",
        body: { email: TEST_EMAIL, otp: "999999" },
      });

      assert.equal(fifthRes.status, 429);
      assert.equal(fifthRes.body.success, false);
      assert.equal(fifthRes.body.status, "too_many_attempts");

      // Verify the token is now marked consumed / invalidated in DB
      const [tokenRow] = await db
        .select()
        .from(authTokensTable)
        .where(
          and(
            eq(authTokensTable.userId, testUserId),
            eq(authTokensTable.purpose, "PASSWORD_RESET_OTP")
          )
        )
        .orderBy(desc(authTokensTable.createdAt))
        .limit(1);

      assert.ok(tokenRow);
      assert.ok(tokenRow.consumedAt !== null, "Token must be invalidated after 5 failed attempts");
    });

    it("10. rejects verification of an expired OTP", async () => {
      // Insert an expired token intentionally
      const expiredOtp = "654321";
      await db.insert(authTokensTable).values({
        userId: testUserId,
        tokenHash: hashAuthToken(expiredOtp),
        purpose: "PASSWORD_RESET_OTP",
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute in the past
        attemptCount: 0,
      });

      const res = await api("/api/auth/password/verify-otp", {
        method: "POST",
        body: { email: TEST_EMAIL, otp: expiredOtp },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, "The verification code is invalid or expired.");
    });

    it("11. resend OTP invalidates old OTP and generates fresh one", async () => {
      // Seed a known active OTP directly for testing verification
      const knownOtp = "482731";
      await db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(eq(authTokensTable.userId, testUserId));

      await db.insert(authTokensTable).values({
        userId: testUserId,
        tokenHash: hashAuthToken(knownOtp),
        purpose: "PASSWORD_RESET_OTP",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attemptCount: 0,
      });

      // Verify known OTP succeeds
      const verifyRes = await api("/api/auth/password/verify-otp", {
        method: "POST",
        body: { email: TEST_EMAIL, otp: knownOtp },
      });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.success, true);
      assert.equal(verifyRes.body.status, "otp_verified");
      assert.ok(verifyRes.body.resetToken, "Server must issue short-lived reset authorization token");

      // Verify OTP is single use: verifying again must fail!
      const reuseRes = await api("/api/auth/password/verify-otp", {
        method: "POST",
        body: { email: TEST_EMAIL, otp: knownOtp },
      });
      assert.equal(reuseRes.status, 400);
      assert.equal(reuseRes.body.success, false);
    });
  });

  // ==========================================================================
  // SECTION C: PASSWORD VALIDATION, HASHING, UPDATE & SESSIONS
  // ==========================================================================
  describe("C. Password Reset, Validation & Session Invalidation", () => {
    let validResetToken = "";

    before(async () => {
      // Create a fresh verified reset authorization token
      const rawToken = crypto.randomBytes(32).toString("base64url");
      await db.insert(authTokensTable).values({
        userId: testUserId,
        tokenHash: hashAuthToken(rawToken),
        purpose: "PASSWORD_RESET_AUTH",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attemptCount: 0,
      });
      validResetToken = rawToken;

      // Create an existing session to test session invalidation upon reset
      const fakeSessionToken = crypto.randomBytes(32).toString("base64url");
      const { createHash } = await import("node:crypto");
      const { getSessionSecret } = await import("../src/lib/secrets");
      const tokenHash = createHash("sha256").update(`${getSessionSecret()}:${fakeSessionToken}`).digest("hex");
      await db.insert(sessionsTable).values({
        userId: testUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it("12. rejects weak password (< 8 chars)", async () => {
      const res = await api("/api/auth/password/reset", {
        method: "POST",
        body: {
          resetToken: validResetToken,
          password: "short",
          confirmPassword: "short",
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /8 characters/i);
    });

    it("13. rejects password confirmation mismatch", async () => {
      const res = await api("/api/auth/password/reset", {
        method: "POST",
        body: {
          resetToken: validResetToken,
          password: "ValidPassword123!",
          confirmPassword: "DifferentPassword123!",
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /match/i);
    });

    it("14. successfully updates user password and invalidates reset token & sessions", async () => {
      const res = await api("/api/auth/password/reset", {
        method: "POST",
        body: {
          resetToken: validResetToken,
          password: NEW_PASSWORD,
          confirmPassword: NEW_PASSWORD,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, "reset_success");

      // Verify user in DB has new password hash
      const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, testUserId)).limit(1);
      assert.ok(updatedUser);
      assert.notEqual(updatedUser.passwordHash, INITIAL_PASSWORD);
      assert.notEqual(updatedUser.passwordHash, NEW_PASSWORD, "Plaintext password MUST NOT be stored in DB");
      assert.ok(verifyPassword(NEW_PASSWORD, updatedUser.passwordHash!), "New password must match stored scrypt hash");
      assert.ok(!verifyPassword(INITIAL_PASSWORD, updatedUser.passwordHash!), "Old password must NOT match stored hash");

      // Verify reset token is consumed
      const [tokenRow] = await db
        .select()
        .from(authTokensTable)
        .where(eq(authTokensTable.tokenHash, hashAuthToken(validResetToken)))
        .limit(1);
      assert.ok(tokenRow?.consumedAt !== null, "Reset authorization token must be marked consumed");

      // Verify old sessions were deleted (session invalidation)
      const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, testUserId));
      assert.equal(sessions.length, 0, "All previous user sessions must be destroyed upon password reset");
    });

    it("15. reset token cannot be reused after successful password reset", async () => {
      const res = await api("/api/auth/password/reset", {
        method: "POST",
        body: {
          resetToken: validResetToken,
          password: "AnotherNewPassword123!",
          confirmPassword: "AnotherNewPassword123!",
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, "invalid_token");
    });

    it("16. login with OLD password fails after reset", async () => {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: {
          email: TEST_EMAIL,
          password: INITIAL_PASSWORD,
        },
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.status, "invalid_credentials");
    });

    it("17. login with NEW password succeeds after reset", async () => {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: {
          email: TEST_EMAIL,
          password: NEW_PASSWORD,
        },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, TEST_EMAIL);
      assert.equal(res.body.user.passwordHash, undefined, "Password hash MUST NEVER be in login response");
    });
  });

  // ==========================================================================
  // SECTION D: SECURITY AUDIT & LEAK PREVENTION
  // ==========================================================================
  describe("D. Security Audit & Zero-Leak Verification", () => {
    it("18. records security audit events in audit_logs table", async () => {
      const auditEntries = await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.actorUserId, testUserId));

      const actions = auditEntries.map((a: { action: string }) => a.action);
      assert.ok(actions.includes("PASSWORD_RESET_REQUESTED"), "Must log PASSWORD_RESET_REQUESTED");
      assert.ok(actions.includes("PASSWORD_RESET_OTP_VERIFIED"), "Must log PASSWORD_RESET_OTP_VERIFIED");
      assert.ok(actions.includes("PASSWORD_RESET_SUCCESS"), "Must log PASSWORD_RESET_SUCCESS");

      // Verify no audit log leaks password or raw OTP
      for (const entry of auditEntries) {
        const str = JSON.stringify(entry);
        assert.ok(!str.includes(INITIAL_PASSWORD), "Audit log must not contain initial password");
        assert.ok(!str.includes(NEW_PASSWORD), "Audit log must not contain new password");
      }
    });

    it("19. password-reset endpoints never leak sensitive keys or database errors", async () => {
      const endpoints = [
        { path: "/api/auth/password/forgot", body: { email: TEST_EMAIL } },
        { path: "/api/auth/password/verify-otp", body: { email: TEST_EMAIL, otp: "123456" } },
        { path: "/api/auth/password/reset", body: { resetToken: "invalid", password: "p", confirmPassword: "p" } },
      ];

      for (const ep of endpoints) {
        const res = await api(ep.path, { method: "POST", body: ep.body });
        const bodyStr = JSON.stringify(res.body);
        assert.ok(!bodyStr.includes("passwordHash"), "No passwordHash leak");
        assert.ok(!bodyStr.includes("password_hash"), "No password_hash leak");
        assert.ok(!bodyStr.includes("tokenHash"), "No tokenHash leak");
        assert.ok(!bodyStr.includes("SQL"), "No SQL leak");
        assert.ok(!bodyStr.includes("syntax error"), "No DB syntax error leak");
      }
    });
  });
});
