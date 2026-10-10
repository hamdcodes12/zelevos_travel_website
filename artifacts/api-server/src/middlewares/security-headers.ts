import type { Request, Response, NextFunction } from "express";

/**
 * Enterprise-grade security headers middleware (Section D, Phase 9)
 * - Strict HSTS
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: SAMEORIGIN
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy
 * - Content-Security-Policy (Report-Only with Razorpay, Supabase, Google Fonts allowlists)
 * - Removal of X-Powered-By
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Remove identifying server headers
  res.removeHeader("X-Powered-By");

  // 2. MIME sniffing protection
  res.setHeader("X-Content-Type-Options", "nosniff");

  // 3. Clickjacking protection (same-origin iframe embedding only)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // 4. Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // 5. Restrict dangerous browser features (allow geolocation on self for customer & driver trip safety)
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self \"https://checkout.razorpay.com\")"
  );

  // 6. Strict Transport Security (HSTS)
  if (process.env.NODE_ENV === "production" || req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // 7. Content-Security-Policy in Report-Only mode
  // Allows Razorpay, Supabase, Google Fonts, OpenStreetMap tiles, Unsplash, and application assets
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://*.supabase.co https://*.razorpay.com https://placehold.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
    "connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://*.supabase.co https://api.resend.com",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "frame-ancestors 'self'",
  ];

  res.setHeader("Content-Security-Policy-Report-Only", cspDirectives.join("; "));

  next();
}
