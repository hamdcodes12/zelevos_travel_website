import crypto from "node:crypto";
import { createRequire } from "node:module";
import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  emailOtpsTable,
  usersTable,
  customersTable,
  auditLogsTable,
  notificationsTable,
} from "@workspace/db";
import { generateNextCustomerId, hashPassword } from "../lib/auth";
import { sendVerificationOtpEmail } from "./email-service";
import { logger } from "../lib/logger";

const require = createRequire(import.meta.url);
let disposableDomainSet: Set<string>;
try {
  const disposableList: string[] = require("disposable-email-domains");
  disposableDomainSet = new Set(disposableList.map((d: string) => d.toLowerCase()));
} catch {
  disposableDomainSet = new Set(["mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com", "throwawaymail.com"]);
}

export function isDisposableEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  return disposableDomainSet.has(parts[1]);
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

export function generateCryptographicOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const maskedLocal = local.length <= 2 ? `${local[0]}***` : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

export type RequestOtpResult =
  | { success: true; message: string; email: string }
  | { success: false; status: number; code: string; message: string };

export async function requestSignupOtp(params: {
  email: string;
  fullName?: string;
  phone?: string;
  password?: string;
  referralCode?: string;
  ipAddress?: string;
}): Promise<RequestOtpResult> {
  const cleanEmail = params.email.trim().toLowerCase();

  // 1. Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return {
      success: false,
      status: 400,
      code: "invalid_email",
      message: "Please enter a valid email address.",
    };
  }

  // 2. Block disposable emails
  if (isDisposableEmail(cleanEmail)) {
    return {
      success: false,
      status: 400,
      code: "disposable_email",
      message: "Please use a standard email provider. Disposable email addresses are not accepted.",
    };
  }

  // 3. Check if email already registered and active
  const [existingUser] = await db
    .select({ id: usersTable.id, status: usersTable.status, emailVerified: usersTable.emailVerified })
    .from(usersTable)
    .where(eq(usersTable.email, cleanEmail))
    .limit(1);

  if (existingUser) {
    return {
      success: false,
      status: 409,
      code: "email_taken",
      message: "An account with this email already exists. Please log in.",
    };
  }

  const now = new Date();
  const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 4. Rate limit: 1 send per 60 seconds per email
  const [recentOtp] = await db
    .select({ id: emailOtpsTable.id })
    .from(emailOtpsTable)
    .where(
      and(
        eq(emailOtpsTable.email, cleanEmail),
        eq(emailOtpsTable.purpose, "signup"),
        gte(emailOtpsTable.createdAt, sixtySecondsAgo)
      )
    )
    .limit(1);

  if (recentOtp) {
    return {
      success: false,
      status: 429,
      code: "rate_limit_exceeded",
      message: "A verification code was recently sent. Please wait 60 seconds before requesting another.",
    };
  }

  // 5. Rate limit: 5 sends per hour per email
  const hourlyCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailOtpsTable)
    .where(
      and(
        eq(emailOtpsTable.email, cleanEmail),
        gte(emailOtpsTable.createdAt, oneHourAgo)
      )
    );

  const hourlyEmailCount = Number(hourlyCountResult[0]?.count || 0);
  if (hourlyEmailCount >= 5) {
    return {
      success: false,
      status: 429,
      code: "rate_limit_exceeded",
      message: "Too many verification requests for this email address. Please try again in an hour.",
    };
  }

  // 6. Rate limit: 15 per hour per IP (if IP provided)
  if (params.ipAddress) {
    const ipCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailOtpsTable)
      .where(
        and(
          eq(emailOtpsTable.ipAddress, params.ipAddress),
          gte(emailOtpsTable.createdAt, oneHourAgo)
        )
      );
    const ipCount = Number(ipCountResult[0]?.count || 0);
    if (ipCount >= 15) {
      return {
        success: false,
        status: 429,
        code: "rate_limit_exceeded",
        message: "Too many requests from your network. Please try again later.",
      };
    }
  }

  // 7. Invalidate any existing unconsumed signup OTPs for this email
  await db
    .update(emailOtpsTable)
    .set({ consumedAt: now })
    .where(
      and(
        eq(emailOtpsTable.email, cleanEmail),
        eq(emailOtpsTable.purpose, "signup"),
        isNull(emailOtpsTable.consumedAt)
      )
    );

  // 8. Generate cryptographically secure OTP & hash
  const rawOtp = generateCryptographicOtp();
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  // Store password hash in metadata (never plain password)
  const passwordHash = params.password ? hashPassword(params.password) : null;
  const metadata = {
    fullName: params.fullName?.trim() || cleanEmail.split("@")[0],
    phone: params.phone?.trim() || null,
    passwordHash,
    referralCode: params.referralCode?.trim() || null,
  };

  await db.insert(emailOtpsTable).values({
    email: cleanEmail,
    otpHash,
    purpose: "signup",
    expiresAt,
    attemptCount: 0,
    ipAddress: params.ipAddress || null,
    metadata,
  });

  // 9. Dispatch branded verification email
  const emailResult = await sendVerificationOtpEmail(cleanEmail, rawOtp, metadata.fullName);

  if (!emailResult.success) {
    logger.warn({ email: maskEmail(cleanEmail) }, "[Email Service] Verification OTP email dispatch failed.");
    return {
      success: false,
      status: 502,
      code: "email_delivery_failed",
      message: "We couldn't send the verification email right now. Please try again later.",
    };
  }

  logger.info({ email: maskEmail(cleanEmail) }, "[Auth] Verification OTP issued for signup");

  return {
    success: true,
    message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to complete registration.`,
    email: cleanEmail,
  };
}

export type VerifyOtpResult =
  | { success: true; user: any; message: string }
  | { success: false; status: number; code: string; message: string };

export async function verifySignupOtp(params: {
  email: string;
  otp: string;
  ipAddress?: string;
}): Promise<VerifyOtpResult> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanOtp = params.otp.trim().replace(/\D/g, "");

  if (cleanOtp.length !== 6) {
    return {
      success: false,
      status: 400,
      code: "invalid_format",
      message: "Please enter the complete 6-digit verification code.",
    };
  }

  const now = new Date();

  // Find latest unconsumed OTP record for signup
  const [record] = await db
    .select()
    .from(emailOtpsTable)
    .where(
      and(
        eq(emailOtpsTable.email, cleanEmail),
        eq(emailOtpsTable.purpose, "signup"),
        isNull(emailOtpsTable.consumedAt)
      )
    )
    .orderBy(desc(emailOtpsTable.createdAt))
    .limit(1);

  if (!record) {
    return {
      success: false,
      status: 400,
      code: "invalid_or_expired",
      message: "The verification code is invalid or has expired. Please request a new code.",
    };
  }

  // Check expiration (10 min)
  if (now > record.expiresAt) {
    await db.update(emailOtpsTable).set({ consumedAt: now }).where(eq(emailOtpsTable.id, record.id));
    return {
      success: false,
      status: 400,
      code: "expired_otp",
      message: "The verification code has expired. Please request a new one.",
    };
  }

  // Check max 5 attempts
  if (record.attemptCount >= 5) {
    await db.update(emailOtpsTable).set({ consumedAt: now }).where(eq(emailOtpsTable.id, record.id));
    return {
      success: false,
      status: 429,
      code: "too_many_attempts",
      message: "Too many incorrect attempts. This code has been invalidated. Please request a new code.",
    };
  }

  // Compare hash
  const inputHash = hashOtp(cleanOtp);
  if (inputHash !== record.otpHash) {
    const newAttemptCount = record.attemptCount + 1;
    if (newAttemptCount >= 5) {
      await db.update(emailOtpsTable).set({ attemptCount: newAttemptCount, consumedAt: now }).where(eq(emailOtpsTable.id, record.id));
      return {
        success: false,
        status: 429,
        code: "too_many_attempts",
        message: "Too many incorrect attempts. This code has been invalidated. Please request a new code.",
      };
    }

    await db.update(emailOtpsTable).set({ attemptCount: newAttemptCount }).where(eq(emailOtpsTable.id, record.id));
    return {
      success: false,
      status: 400,
      code: "invalid_otp",
      message: "Invalid verification code. Please check your email and try again.",
    };
  }

  // OTP is correct! Mark consumed
  await db.update(emailOtpsTable).set({ consumedAt: now }).where(eq(emailOtpsTable.id, record.id));

  // Check if account was created concurrently
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, cleanEmail))
    .limit(1);

  if (existingUser) {
    // If user already existed, update verified status
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        emailVerified: true,
        emailVerifiedAt: existingUser.emailVerifiedAt || now,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(usersTable.id, existingUser.id))
      .returning();

    return {
      success: true,
      user: updatedUser,
      message: "Email verified successfully! Welcome to Zelevos.",
    };
  }

  // Create new user now
  const metadata = (record.metadata || {}) as Record<string, any>;
  const customerId = await generateNextCustomerId();

  const [newUser] = await db
    .insert(usersTable)
    .values({
      customerId,
      email: cleanEmail,
      fullName: metadata.fullName || cleanEmail.split("@")[0],
      phone: metadata.phone || null,
      passwordHash: metadata.passwordHash || null,
      authProvider: "email",
      emailVerified: true,
      emailVerifiedAt: now,
      status: "active",
      referralCodeUsed: metadata.referralCode || null,
      referredAt: metadata.referralCode ? now : null,
      lastLoginAt: now,
    })
    .returning();

  // Create corresponding record in customersTable
  try {
    await db.insert(customersTable).values({
      userId: newUser.id,
      customerId,
      fullName: metadata.fullName || cleanEmail.split("@")[0],
      email: cleanEmail,
      phone: metadata.phone || null,
      preferences: {},
    });
  } catch (custErr) {
    logger.warn({ err: custErr, userId: newUser.id }, "Failed to create customer table record upon signup");
  }

  // Create notification and audit log
  try {
    await db.insert(notificationsTable).values({
      userId: newUser.id,
      type: "NEW_CUSTOMER_REGISTRATION",
      category: "IMPORTANT",
      title: `👤 New Customer Registered - User ID: ${customerId}`,
      body: `${metadata.fullName || cleanEmail.split("@")[0]} (${cleanEmail}) registered and verified.`,
      channel: "in_app",
      status: "SENT",
      metadata: { customerId, email: cleanEmail },
    });

    await db.insert(auditLogsTable).values({
      actorUserId: newUser.id,
      actorName: metadata.fullName || cleanEmail.split("@")[0],
      actorRole: "customer",
      action: "CUSTOMER_REGISTERED",
      resourceType: "user",
      resourceId: newUser.id,
      ipAddress: params.ipAddress || null,
      metadata: { customerId, email: cleanEmail, verified: true },
    });
  } catch (logErr) {
    logger.warn({ err: logErr }, "Failed to write signup audit logs");
  }

  logger.info({ email: maskEmail(cleanEmail), userId: newUser.id }, "[Auth] Customer signup verified and created successfully");

  return {
    success: true,
    user: newUser,
    message: "Email verified successfully! Welcome to Zelevos.",
  };
}
