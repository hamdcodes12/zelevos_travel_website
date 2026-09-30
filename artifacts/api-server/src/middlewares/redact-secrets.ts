import type { NextFunction, Request, Response } from "express";

/**
 * Defense in depth: several handlers return raw database rows. Whatever a handler returns,
 * credential material must never leave the server in a JSON response.
 */
const SENSITIVE_KEYS = new Set([
  "passwordHash",
  "password_hash",
  "temporaryPassword",
  "temporary_password",
  "totpSecret",
  "totp_secret",
  "tokenHash",
  "token_hash",
  "password",
  "newPassword",
  "confirmPassword",
  ...(process.env.NODE_ENV === "production" ? ["otp", "debugOtp", "debug_otp", "resetCode", "debugResetUrl"] : []),
]);

const MAX_DEPTH = 12;

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1));
  }

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(source)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    output[key] = redactSecrets(inner, depth + 1);
  }
  return output;
}

export function redactSecretsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => originalJson(redactSecrets(body))) as typeof res.json;
  next();
}
