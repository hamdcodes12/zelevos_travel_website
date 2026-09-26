import { createHmac, randomBytes } from "node:crypto";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(length = 20): string {
  const bytes = randomBytes(length);
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32ToBuffer(base32Str: string): Buffer {
  const cleaned = base32Str.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]!);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Calculates a standard 6-digit TOTP token for a given counter/time step.
 */
function generateHOTP(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const token = (code % 1_000_000).toString().padStart(6, "0");
  return token;
}

/**
 * Generates current TOTP token for a base32 secret.
 */
export function generateTotp(secretBase32: string, time = Date.now(), stepSeconds = 30): string {
  const secretBuffer = base32ToBuffer(secretBase32);
  const counter = Math.floor(time / 1000 / stepSeconds);
  return generateHOTP(secretBuffer, counter);
}

/**
 * Verifies a 6-digit TOTP token against a base32 secret with drift window (+-1 step = 90s window).
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  time = Date.now(),
  stepSeconds = 30,
  window = 1
): boolean {
  if (!/^\d{6}$/.test(token.trim())) return false;

  const cleanToken = token.trim();
  const secretBuffer = base32ToBuffer(secretBase32);
  const currentStep = Math.floor(time / 1000 / stepSeconds);

  for (let errorStep = -window; errorStep <= window; errorStep++) {
    const expected = generateHOTP(secretBuffer, currentStep + errorStep);
    if (expected === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Generates the standard key uri for authenticator apps (Google Authenticator, Microsoft Authenticator, 1Password).
 */
export function getTotpAuthUrl(email: string, secretBase32: string, issuer = "Zelevos"): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
