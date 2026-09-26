import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Request, Response } from "express";
import {
  db,
  sessionsTable,
  usersTable,
  adminUsersTable,
  adminSessionsTable,
  type User,
  type AdminUser,
} from "@workspace/db";

export const AUTH_COOKIE = "zelevos_session";
export const ADMIN_COOKIE = "zelevos_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return secret || "local-development-session-secret";
}

export function getRefreshSecret(): string {
  const secret = process.env.REFRESH_SECRET?.trim() || sessionSecret();
  return secret;
}

export function createRefreshToken(userId: string): string {
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = Buffer.from(JSON.stringify({ userId, nonce, iat: Date.now(), exp: expiresAt })).toString("base64url");
  const sig = createHash("sha256").update(`${getRefreshSecret()}:${payload}`).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expectedSig = createHash("sha256").update(`${getRefreshSecret()}:${payload}`).digest("hex");
    const sigBuf = Buffer.from(sig, "utf-8");
    const expBuf = Buffer.from(expectedSig, "utf-8");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now() || typeof parsed.userId !== "string") return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256")
    .update(`${sessionSecret()}:${token}`)
    .digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function generateNextCustomerId(): Promise<string> {
  try {
    const existing = await db.select({ customerId: usersTable.customerId }).from(usersTable);
    let maxNum = 0;
    for (const row of existing) {
      if (row.customerId && row.customerId.startsWith("ZLV-CUS-")) {
        const numPart = parseInt(row.customerId.replace("ZLV-CUS-", ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `ZLV-CUS-${String(nextNum).padStart(6, "0")}`;
  } catch {
    const random6 = Math.floor(100000 + Math.random() * 900000);
    return `ZLV-CUS-${random6}`;
  }
}

export function generateCustomerId(): string {
  const random6 = Math.floor(100000 + Math.random() * 900000);
  return `ZLV-CUS-${random6}`;
}

export async function generateNextVendorId(): Promise<string> {
  try {
    const { vendorsTable } = await import("@workspace/db");
    const existing = await db.select({ vendorId: vendorsTable.vendorId }).from(vendorsTable);
    let maxNum = 0;
    for (const row of existing) {
      if (row.vendorId && row.vendorId.startsWith("ZLV-VND-")) {
        const numPart = parseInt(row.vendorId.replace("ZLV-VND-", ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `ZLV-VND-${String(nextNum).padStart(6, "0")}`;
  } catch {
    const random6 = Math.floor(100000 + Math.random() * 900000);
    return `ZLV-VND-${random6}`;
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

export function publicUser(user: User) {
  return {
    id: user.id,
    customerId: user.customerId ?? null,
    email: user.email,
    fullName: user.fullName ?? null,
    phone: user.phone ?? null,
    authProvider: user.authProvider ?? "email",
    role: user.role,
    vendorId: user.vendorId ?? null,
    emailVerified: user.emailVerified ?? false,
    status: user.status ?? "active",
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function publicAdmin(admin: AdminUser) {
  return {
    id: admin.id,
    adminId: admin.adminId,
    lastLoginAt: admin.lastLoginAt ?? null,
    createdAt: admin.createdAt,
  };
}

export const OAUTH_STATE_COOKIE = "zelevos_oauth_state";

export function generateOAuthState(provider: "google" | "facebook", redirectUrl?: string): string {
  const nonce = randomBytes(16).toString("hex");
  const data = JSON.stringify({ provider, nonce, redirectUrl: redirectUrl || "/", timestamp: Date.now() });
  const signature = createHash("sha256").update(`${sessionSecret()}:${data}`).digest("hex");
  return Buffer.from(JSON.stringify({ data, signature })).toString("base64url");
}

export function verifyOAuthState(stateString: string, provider: "google" | "facebook"): { valid: boolean; redirectUrl?: string } {
  try {
    const raw = Buffer.from(stateString, "base64url").toString("utf8");
    const { data, signature } = JSON.parse(raw);
    const expectedSig = createHash("sha256").update(`${sessionSecret()}:${data}`).digest("hex");
    if (signature !== expectedSig) return { valid: false };
    const parsed = JSON.parse(data);
    if (parsed.provider !== provider) return { valid: false };
    // Expire state after 15 minutes
    if (Date.now() - parsed.timestamp > 15 * 60 * 1000) return { valid: false };
    return { valid: true, redirectUrl: parsed.redirectUrl };
  } catch {
    return { valid: false };
  }
}

export async function createSession(userId: string, response: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  response.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroySession(request: Request, response: Response) {
  const token = request.cookies?.[AUTH_COOKIE];
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
  }
  response.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function userFromRequest(request: Request): Promise<User | null> {
  const token = request.cookies?.[AUTH_COOKIE];
  if (!token) return null;

  const [session] = await db
    .select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.tokenHash, hashSessionToken(token)))
    .limit(1);

  if (!session) return null;
  if (session.session.expiresAt <= new Date()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, session.session.id));
    return null;
  }
  return session.user;
}

export async function createAdminSession(adminId: string, response: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  await db.insert(adminSessionsTable).values({
    adminId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  response.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroyAdminSession(request: Request, response: Response) {
  const token = request.cookies?.[ADMIN_COOKIE];
  if (token) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.tokenHash, hashSessionToken(token)));
  }
  response.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function adminFromRequest(request: Request): Promise<AdminUser | null> {
  const token = request.cookies?.[ADMIN_COOKIE];
  if (!token) return null;

  const [record] = await db
    .select({ session: adminSessionsTable, admin: adminUsersTable })
    .from(adminSessionsTable)
    .innerJoin(adminUsersTable, eq(adminSessionsTable.adminId, adminUsersTable.id))
    .where(eq(adminSessionsTable.tokenHash, hashSessionToken(token)))
    .limit(1);

  if (!record) return null;
  if (record.session.expiresAt <= new Date()) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, record.session.id));
    return null;
  }
  return record.admin;
}

export async function removeExpiredSessions() {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
  await db.delete(adminSessionsTable).where(lt(adminSessionsTable.expiresAt, new Date()));
}