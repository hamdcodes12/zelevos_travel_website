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
import { authRateLimit, sensitiveRateLimit } from "./lib/rate-limit";
import { requireProductionSupabaseConfig } from "./lib/supabase";

const app: Express = express();

requireProductionSupabaseConfig();

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === "production" ? ["https://zelevos.com"] : configuredOrigins;

if (process.env.NODE_ENV === "production" && configuredOrigins.some((origin) => origin !== "https://zelevos.com")) {
  throw new Error("Production CORS configuration must contain only https://zelevos.com.");
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
  path.resolve(process.cwd(), "../wayora/dist/public"),
  path.resolve(process.cwd(), "artifacts/wayora/dist/public"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../wayora/dist/public"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../artifacts/wayora/dist/public"),
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

const apiCors = cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS policy."));
  },
});

app.use("/api", apiCors);
app.use(cookieParser());
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRateLimit);
app.use("/api/payments", sensitiveRateLimit);
app.use("/api", authMiddleware);
app.use("/api", router);

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
  req.log?.error({ err: error }, "Unhandled request error");
  if (res.headersSent) return;
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : 500;
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    status: statusCode === 404 ? "not_found" : "internal_error",
    message: statusCode === 404 ? "Resource not found." : "An unexpected server error occurred.",
  });
});

export default app;
