import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

/**
 * Cleanup expired rate limit records periodically to prevent memory leaks (ZEL-13)
 */
export function cleanupExpiredRecords(): void {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}

export function getRateLimitStoreSize(): number {
  return store.size;
}

export function clearRateLimitStore(): void {
  store.clear();
}

// Clean expired keys every 5 minutes (unref so tests do not hang)
setInterval(cleanupExpiredRecords, 300_000).unref();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  keyPrefix?: string;
  /** Distinct bucket name so limiters mounted on the same path never share counters. */
  bucket?: string;
  /** Extra per-account key (for example an application id in the URL) besides the body-derived one. */
  accountKeyFn?: (req: Request) => string | null;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = "Too many requests. Please try again later.", statusCode = 429, keyPrefix, bucket = "default", accountKeyFn } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting in automated test environment unless explicitly asserted
    if (process.env.NODE_ENV === "test" && !process.env.ENABLE_TEST_RATE_LIMIT) {
      next();
      return;
    }

    // Never manually trust x-forwarded-for; use Express req.ip configured via trust proxy (ZEL-11)
    const ip = req.ip || "127.0.0.1";
    // Normalize route key to avoid memory leak with dynamic URL parameters (ZEL-13)
    const routeKey = keyPrefix || req.baseUrl || req.route?.path || req.path.split("/").slice(0, 3).join("/");
    const now = Date.now();

    const ipKey = `ip:${bucket}:${ip}:${routeKey}`;

    // Account-based limiting (normalized email/identifier/adminId) (ZEL-10 AC3)
    const accountKeys: string[] = [];
    if (req.body && typeof req.body === "object") {
      const candidate = req.body.email || req.body.identifier || req.body.adminId || req.body.username;
      if (typeof candidate === "string" && candidate.trim()) {
        accountKeys.push(`acct:${bucket}:${candidate.trim().toLowerCase().slice(0, 254)}:${routeKey}`);
      }
    }
    const extraAccount = accountKeyFn ? accountKeyFn(req) : null;
    if (extraAccount) {
      accountKeys.push(`acct:${bucket}:${extraAccount.trim().toLowerCase().slice(0, 254)}:${routeKey}`);
    }

    const keysToCheck = [ipKey, ...accountKeys];

    // Check if any bucket exceeded
    for (const key of keysToCheck) {
      const record = store.get(key);
      if (record && now <= record.resetAt && record.count >= max) {
        const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
        res.setHeader("Retry-After", retryAfterSeconds);
        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", 0);
        res.status(statusCode).json({
          status: "rate_limited",
          message,
          retryAfterSeconds,
        });
        return;
      }
    }

    // Increment all applicable buckets
    let highestCount = 0;
    for (const key of keysToCheck) {
      let record = store.get(key);
      if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + windowMs };
      } else {
        record.count++;
      }
      store.set(key, record);
      if (record.count > highestCount) {
        highestCount = record.count;
      }
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - highestCount));
    next();
  };
}

// 1. Auth routes rate limiter: 10 attempts per 15 minutes
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  bucket: "auth",
  message: "Too many authentication attempts. Please try again in 15 minutes.",
});
export const authRateLimit = authRateLimiter;

// 2. Admin login rate limiter: 10 attempts per 15 minutes (ZEL-10)
export const adminLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  bucket: "admin-login",
  message: "Too many admin login attempts. Please try again in 15 minutes.",
});

// 3. Partner login / OTP rate limiter: 10 attempts per 15 minutes (ZEL-10)
export const partnerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  bucket: "partner",
  message: "Too many partner authentication attempts. Please try again in 15 minutes.",
});

// 4. 2FA TOTP brute force protection: 5 attempts per 15 minutes (ZEL-10)
export const totpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  bucket: "totp",
  message: "Too many 2FA verification attempts. Account locked temporarily for security.",
});

// Conditional TOTP limiter for endpoints where totpCode is optional/in body
export const totpConditionalLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === "object" && req.body.totpCode) {
    return totpRateLimiter(req, res, next);
  }
  next();
};

// 5. Sensitive operations (payments): 30 requests per minute
export const sensitiveRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  bucket: "payments",
  message: "Too many requests. Please try again shortly.",
});

// 6. Support ticket creation limiter: 10 requests per 15 minutes (ZEL-08 spam prevention)
export const supportTicketRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  bucket: "support-ticket",
  message: "Too many support tickets submitted. Please wait before creating another ticket.",
});

// 7. General API limiter: 200 requests per minute
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  bucket: "api",
  message: "API rate limit exceeded. Please throttle your requests.",
});

// 8. Vendor / supplier portal credential endpoints: 10 attempts per 15 minutes per IP and per account
export const vendorLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  bucket: "vendor-login",
  message: "Too many vendor login attempts. Please try again in 15 minutes.",
});

// 9. Supplier self-registration: 10 applications per hour per IP
export const supplierRegisterRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  bucket: "supplier-register",
  message: "Too many supplier applications from this network. Please try again later.",
});

// 10. Application status / resubmit (password-proof endpoints): 10 attempts per 15 minutes per IP and
//     per application. The application id lives in the URL (/application/:id/resubmit), so key on it too.
export const supplierApplicationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  bucket: "supplier-application",
  message: "Too many attempts. Please try again in 15 minutes.",
  accountKeyFn: (req) => {
    const match = /^\/([^/]+)\/resubmit\/?$/.exec(req.path);
    return match ? decodeURIComponent(match[1]) : null;
  },
});

// 11. Anonymous supplier document uploads: 30 files per 15 minutes per IP
export const supplierUploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  bucket: "supplier-upload",
  message: "Too many uploads. Please try again in 15 minutes.",
});

// 12. Google Maps proxy endpoints (public, paid upstream API): one shared 30/min/IP budget across
// /maps/autocomplete, /maps/route and /maps/static (round-2 fix, P3).
export const mapsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  bucket: "maps",
  keyPrefix: "maps",
  message: "Too many location lookups. Please slow down and try again shortly.",
});
