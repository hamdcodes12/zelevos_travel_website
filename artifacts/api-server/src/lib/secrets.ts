import crypto from "node:crypto";

let devSessionSecret: string | null = null;
let devRefreshSecret: string | null = null;
let devDocumentSecret: string | null = null;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters in production.");
    }
    return secret;
  }
  if (secret) return secret;
  if (!devSessionSecret) {
    devSessionSecret = crypto.randomBytes(32).toString("hex");
  }
  return devSessionSecret;
}

export function getRefreshSecret(): string {
  const secret = process.env.REFRESH_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("REFRESH_SECRET must be at least 32 characters in production.");
    }
    return secret;
  }
  if (secret) return secret;
  if (!devRefreshSecret) {
    devRefreshSecret = crypto.randomBytes(32).toString("hex");
  }
  return devRefreshSecret;
}

export function getDocumentSigningSecret(): string {
  const dedicated = process.env.DOCUMENT_SIGNING_SECRET?.trim();
  if (dedicated && dedicated.length >= 32) return dedicated;
  if (process.env.NODE_ENV === "production") {
    const fallback = process.env.SESSION_SECRET?.trim();
    if (fallback && fallback.length >= 32) return fallback;
    throw new Error("DOCUMENT_SIGNING_SECRET (or SESSION_SECRET) must be at least 32 characters in production.");
  }
  if (dedicated) return dedicated;
  const fallback = process.env.SESSION_SECRET?.trim();
  if (fallback) return fallback;
  if (!devDocumentSecret) {
    devDocumentSecret = crypto.randomBytes(32).toString("hex");
  }
  return devDocumentSecret;
}
