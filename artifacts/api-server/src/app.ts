import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { redactSecretsMiddleware } from "./middlewares/redact-secrets";
import {
  apiRateLimiter,
  authRateLimiter,
  adminLoginRateLimiter,
  partnerRateLimiter,
  totpRateLimiter,
  totpConditionalLimiter,
  sensitiveRateLimit,
  vendorLoginRateLimiter,
  supplierRegisterRateLimiter,
  supplierApplicationRateLimiter,
  supplierUploadRateLimiter,
  mapsRateLimiter,
  couponRateLimiter,
  publicFormRateLimiter,
  loginLockoutMiddleware,
} from "./middlewares/rate-limiter";
import { securityHeadersMiddleware } from "./middlewares/security-headers";
import { requireProductionSupabaseConfig } from "./lib/supabase";
import { assertProductionPaymentConfig } from "./services/payment-service";
import { validateEmailConfiguration } from "./services/email-service";

const app: Express = express();

const trustProxyEnv = process.env.TRUST_PROXY;
const trustProxySetting = trustProxyEnv !== undefined
  ? (trustProxyEnv === "true"
      ? true
      : trustProxyEnv === "false"
      ? false
      : !isNaN(Number(trustProxyEnv))
      ? Number(trustProxyEnv)
      : trustProxyEnv)
  : (process.env.NODE_ENV === "production" || process.env.RENDER ? 1 : false);

app.set("trust proxy", trustProxySetting);
app.disable("x-powered-by");
app.use(securityHeadersMiddleware);

requireProductionSupabaseConfig();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEBUG_OTP === "true") {
  throw new Error("ALLOW_DEBUG_OTP is strictly forbidden in production mode.");
}

// Fail closed at startup: production must never be reachable with the test payment provider or without a
// webhook secret (round-2 fix, P2) — never a runtime surprise on the first real payment.
assertProductionPaymentConfig();
validateEmailConfiguration();

if (process.env.NODE_ENV !== "production" && process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
  logger.warn("SECURITY WARNING: Live Razorpay key detected in non-production environment! Do NOT use live payment credentials in development/test.");
}

const defaultLocalOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const trustedProductionOrigins = [
  "https://zelevos.com",
  "https://www.zelevos.com",
  "https://zelevos.onrender.com",
];
const allowedOrigins = Array.from(new Set([
  ...trustedProductionOrigins,
  ...configuredOrigins,
  ...(process.env.NODE_ENV === "production" ? [] : defaultLocalOrigins),
]));

if (process.env.NODE_ENV === "production" && configuredOrigins.some((origin) => origin === "*" || !origin.startsWith("https://"))) {
  throw new Error("Production CORS configuration must contain only explicit HTTPS origins.");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const frontendCandidates = [
  path.resolve(process.cwd(), "../zelevos/dist/public"),
  path.resolve(process.cwd(), "artifacts/zelevos/dist/public"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../zelevos/dist/public"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../artifacts/zelevos/dist/public"),
];
const frontendRoot = frontendCandidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));

if (frontendRoot) {
  logger.info({ frontendRoot }, "Frontend production assets configured");
  app.use("/assets", (req, _res, next) => {
    const requestedPath = path.resolve(frontendRoot, "assets", `.${req.path}`);
    const insideAssetRoot = requestedPath.startsWith(`${path.resolve(frontendRoot, "assets")}${path.sep}`);
    req.log?.info({ requestedPath: insideAssetRoot ? requestedPath : "<invalid-path>", exists: insideAssetRoot && fs.existsSync(requestedPath) }, "Static asset request");
    next();
  });
  const staticHeaders = (res: express.Response, filePath: string) => {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return;
    }
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  };
  app.use("/assets", express.static(path.join(frontendRoot, "assets"), { setHeaders: staticHeaders }));
  app.use(express.static(frontendRoot, { setHeaders: staticHeaders }));
}

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    try {
      const { hostname } = new URL(origin);
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".local") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.")
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

const apiCors = cors({
  credentials: true,
  preflightContinue: true,
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
});

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin);
  logger.info({
    path: req.path,
    method: req.method,
    origin: origin || null,
    allowed,
  }, "API CORS origin check");
  if (origin && !allowed) {
    res.status(403).json({ status: "forbidden", message: "Origin not allowed by CORS policy." });
    return;
  }
  next();
});
app.use("/api", apiCors);
app.use("/api", (req, res, next) => {
  if (req.method === "OPTIONS") {
    res.status(200).json({ status: "ok" });
    return;
  }
  next();
});
app.use(cookieParser());
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Global and route-specific rate limiting (ZEL-10, ZEL-11, ZEL-13, ZEL-17)
app.use("/api", apiRateLimiter);
app.use(
  [
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/register",
    "/api/auth/resend-otp",
    "/api/auth/verify-otp",
    "/api/auth/password",
    "/api/auth/forgot-password",
    "/api/auth/verify-password-reset-otp",
    "/api/auth/reset-password",
    "/api/auth/resend-password-reset-otp",
  ],
  authRateLimiter
);
app.use(["/api/auth/login", "/api/admin/login"], totpConditionalLimiter);
app.use(["/api/auth/2fa/enable", "/api/auth/2fa/disable"], totpRateLimiter);
app.use("/api/admin/login", adminLoginRateLimiter);
app.use(
  [
    "/api/partners/login",
    "/api/partners/register",
    "/api/partners/password",
  ],
  partnerRateLimiter
);
app.use("/api/payments", sensitiveRateLimit);
app.use("/api/vendor/login", vendorLoginRateLimiter);
app.use(["/api/suppliers/register", "/api/vendor/register"], supplierRegisterRateLimiter);
app.use(["/api/suppliers/application", "/api/suppliers/application-status"], supplierApplicationRateLimiter);
app.use(["/api/suppliers/upload-document", "/api/vendor/upload-document"], supplierUploadRateLimiter);
app.use(["/api/maps/autocomplete", "/api/maps/route", "/api/maps/static"], mapsRateLimiter);

// Login lockout protection (5 failed attempts per account/IP locks out for 15 minutes)
app.use(
  [
    "/api/auth/login",
    "/api/admin/login",
    "/api/partners/login",
    "/api/vendor/login",
  ],
  loginLockoutMiddleware
);

// Coupon & Referral validation rate limiter
app.use(
  [
    "/api/partners/validate-code",
    "/api/custom-trips/validate-referral",
  ],
  couponRateLimiter
);

// Public form submissions rate limiter (only throttles new form POSTs, not GETs or document streams)
app.use(
  [
    "/api/custom-trips",
    "/api/support",
  ],
  (req, res, next) => {
    if (req.method !== "POST") return next();
    if (req.path.includes("/documents") || req.path.includes("/upload-document") || req.path.includes("/status")) {
      return next();
    }
    return publicFormRateLimiter(req, res, next);
  }
);

// Never let credential material (hashes, TOTP secrets, temporary passwords) leave in a JSON response
app.use("/api", redactSecretsMiddleware);

app.use("/api", authMiddleware);
app.use("/api", router);

// Guarantee that any unhandled /api/* request ALWAYS returns valid JSON, never HTML
app.use("/api", (req, res) => {
  res.status(404).json({
    status: "not_found",
    message: `API endpoint ${req.method} ${req.originalUrl || req.url} not found.`,
  });
});

if (frontendRoot) {
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/api" || req.path.startsWith("/assets/") || !req.accepts("html")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendRoot, "index.html"), { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  });
}

app.use((error: unknown, req: any, res: any, _next: unknown) => {
  const logFn = req.log?.error ? req.log.error.bind(req.log) : logger.error.bind(logger);
  logFn({ err: error }, "Unhandled request error");
  if (res.headersSent) return;

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Handle body-parser JSON syntax errors
  if (error instanceof SyntaxError && "body" in error && "status" in error && (error as any).status === 400) {
    res.status(400).json({
      status: "invalid_json",
      message: "Malformed JSON payload provided.",
    });
    return;
  }

  const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : (typeof error === "object" && error !== null && "status" in error && typeof (error as any).status === "number"
      ? (error as any).status
      : 500);

  const message = typeof error === "object" && error !== null && "message" in error && typeof (error as any).message === "string"
    ? (error as any).message
    : (statusCode === 404 ? "Resource not found." : "An unexpected server error occurred.");

  const statusLabel = statusCode === 404
    ? "not_found"
    : statusCode === 400
    ? "invalid_request"
    : statusCode === 403
    ? "forbidden"
    : statusCode === 401
    ? "unauthorized"
    : "internal_error";

  const safeMessage = process.env.NODE_ENV === "production" && statusCode >= 500
    ? "An unexpected server error occurred. Please try again later."
    : message;

  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    status: statusLabel,
    message: safeMessage,
  });
});

export default app;
