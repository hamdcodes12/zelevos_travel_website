import crypto from "node:crypto";
import { logger } from "./logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM ENCRYPTION FOR MEETING PASSWORDS AT REST
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const customKey = process.env.MEETING_ENCRYPTION_KEY || process.env.BANK_ENCRYPTION_KEY;
  if (customKey) {
    if (customKey.length === 64) {
      return Buffer.from(customKey, "hex");
    }
    return crypto.createHash("sha256").update(customKey).digest();
  }
  const sessionSecret = process.env.SESSION_SECRET || "thinkatic-meeting-secret-salt-2026-secure";
  return crypto.createHash("sha256").update(sessionSecret).digest();
}

/**
 * Encrypts a meeting password using AES-256-GCM.
 * Output format: ivHex:authTagHex:encryptedHex
 */
export function encryptMeetingPassword(plaintext: string): string {
  if (!plaintext || !plaintext.trim()) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext.trim(), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted meeting password.
 * Returns plaintext password or empty string on failure.
 */
export function decryptMeetingPassword(payload: string): string {
  if (!payload || !payload.trim()) return "";
  if (!payload.includes(":")) return payload; // Legacy plaintext fallback
  try {
    const parts = payload.split(":");
    if (parts.length !== 3) return payload;
    const [ivHex, authTagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    logger.error({ err }, "Decryption failure on sensitive meeting credential");
    return "";
  }
}

/**
 * Validates that a meeting link is a valid web URL with allowed schemes.
 * Disallows dangerous schemes like javascript:, data:, file:, vbscript:.
 */
export function validateMeetingUrl(urlString?: string | null): { valid: boolean; normalized?: string; error?: string } {
  if (!urlString || !urlString.trim()) {
    return { valid: true, normalized: "" };
  }
  const trimmed = urlString.trim();
  const lower = trimmed.toLowerCase();

  // Block dangerous pseudo-protocols
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:")
  ) {
    return { valid: false, error: "Dangerous or unsupported meeting URL protocol" };
  }

  try {
    let parsed: URL;
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      // Auto-prefix https:// if user entered domain like meet.google.com/xyz
      parsed = new URL(`https://${trimmed}`);
    } else {
      parsed = new URL(trimmed);
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, error: "Meeting link must use https:// or http://" };
    }

    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, error: "Invalid meeting URL format" };
  }
}
