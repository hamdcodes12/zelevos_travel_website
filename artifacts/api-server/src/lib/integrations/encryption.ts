import crypto from "crypto";
import type { PlaintextCredentials } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM ENCRYPTION AT REST & SECURITY UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte (256-bit) encryption key from the environment.
 * Prioritizes INTEGRATION_ENCRYPTION_KEY, with secure fallback to SESSION_SECRET.
 */
function getEncryptionKey(): Buffer {
  const customKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (customKey) {
    if (customKey.length === 64) {
      return Buffer.from(customKey, "hex");
    }
    return crypto.createHash("sha256").update(customKey).digest();
  }

  const sessionSecret = process.env.SESSION_SECRET || "thinkatic-integration-master-salt-2026";
  return crypto.createHash("sha256").update(sessionSecret).digest();
}

/**
 * Encrypts a PlaintextCredentials object using AES-256-GCM.
 * Never stores plaintext secrets.
 */
export function encryptCredentials(credentials: PlaintextCredentials): {
  encrypted_data: string;
  iv: string;
  auth_tag: string;
  key_masked: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const jsonPayload = JSON.stringify(credentials);
  let encrypted = cipher.update(jsonPayload, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // Generate masked key for safe user display (e.g. ••••••••1234)
  const primarySecret =
    credentials.api_key ||
    credentials.access_token ||
    credentials.client_secret ||
    credentials.webhook_secret ||
    credentials.password ||
    "";
  const keyMasked = maskSecret(primarySecret);

  return {
    encrypted_data: encrypted,
    iv: iv.toString("hex"),
    auth_tag: authTag,
    key_masked: keyMasked,
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext record into PlaintextCredentials.
 */
export function decryptCredentials(encryptedData: string, ivHex: string, authTagHex: string): PlaintextCredentials {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted) as PlaintextCredentials;
}

/**
 * Masks a secret string preserving only the last 4 characters if long enough.
 * Example: "sk_live_9998881234" -> "••••••••1234"
 */
export function maskSecret(secret: string): string {
  if (!secret || typeof secret !== "string") return "••••••••";
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "••••";
  const last4 = trimmed.slice(-4);
  return `••••••••${last4}`;
}

/**
 * Generates an HMAC-SHA256 signature for payload verification.
 */
export function generateHmacSignature(rawBody: string, secret: string, encoding: "hex" | "base64" = "hex"): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest(encoding);
}

/**
 * Constant-time comparison between signature and expected digest.
 * Defeats timing attacks on webhooks.
 */
export function verifyHmacSignature(
  rawBody: string,
  secret: string,
  providedSignature: string,
  encoding: "hex" | "base64" = "hex"
): boolean {
  if (!providedSignature || !secret || !rawBody) return false;

  // Normalize provided signature (remove sha256= prefix if present)
  let cleanProvided = providedSignature.trim();
  if (cleanProvided.startsWith("sha256=")) {
    cleanProvided = cleanProvided.slice(7);
  }

  const expected = generateHmacSignature(rawBody, secret, encoding);

  if (Buffer.byteLength(cleanProvided) !== Buffer.byteLength(expected)) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(cleanProvided), Buffer.from(expected));
}

/**
 * Generates a signed OAuth state token to prevent CSRF in OAuth flows.
 */
export function generateOAuthState(payload: {
  tenantId: string;
  provider: string;
  redirectUri?: string;
}): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const data = JSON.stringify({ ...payload, nonce, timestamp });
  const dataB64 = Buffer.from(data, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(dataB64)
    .digest("base64url");
  return `${dataB64}.${signature}`;
}

/**
 * Validates a signed OAuth state token and enforces 10-minute expiry.
 */
export function verifyOAuthState(stateToken: string): {
  valid: boolean;
  data?: { tenantId: string; provider: string; redirectUri?: string };
  error?: string;
} {
  if (!stateToken || !stateToken.includes(".")) {
    return { valid: false, error: "Invalid state token structure" };
  }

  const [dataB64, providedSig] = stateToken.split(".");
  const expectedSig = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(dataB64)
    .digest("base64url");

  if (
    Buffer.byteLength(providedSig) !== Buffer.byteLength(expectedSig) ||
    !crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
  ) {
    return { valid: false, error: "Invalid state token signature" };
  }

  try {
    const raw = Buffer.from(dataB64, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);

    // 10-minute expiration window for OAuth state
    if (Date.now() - parsed.timestamp > 10 * 60 * 1000) {
      return { valid: false, error: "OAuth state token has expired" };
    }

    return { valid: true, data: parsed };
  } catch {
    return { valid: false, error: "Malformed OAuth state token" };
  }
}
