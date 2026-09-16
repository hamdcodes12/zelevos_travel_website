import "./lib/env";
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
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS policy."));
  },
}));
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
app.use(authMiddleware);

app.use("/api", router);

app.use((error: unknown, req: any, res: any, _next: unknown) => {
  req.log?.error({ err: error }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ status: "internal_error", message: "An unexpected server error occurred." });
});

export default app;
