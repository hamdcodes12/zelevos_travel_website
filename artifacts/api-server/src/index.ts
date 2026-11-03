import dns from "node:dns";
// On Windows / Node.js 18+, default IPv6 lookup can cause 20-25s socket timeouts when reaching cloud HTTPS APIs like Supabase.
// Setting ipv4first ensures fast, deterministic connection establishment.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

import app from "./app";
import { logger } from "./lib/logger";

process.on("unhandledRejection", (reason: any) => {
  console.error("Unhandled Promise Rejection:", reason);
  logger.error({ reason: reason?.message || reason, stack: reason?.stack }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (err: any) => {
  console.error("Uncaught Exception:", err);
  logger.error({ err: err?.message || err, stack: err?.stack }, "Uncaught Exception");
});

import { validateEnvironment, logValidationResults } from "./lib/validate-env";
import { initStorage, getStorageRoot } from "./lib/storageService";
import { checkDatabaseConnection } from "@workspace/db";

// Validate environment variables before starting server
const validationResult = validateEnvironment();
logValidationResults(validationResult);

if (!validationResult.valid) {
  console.error("\n❌ Server startup aborted due to configuration errors.\n");
  process.exit(1);
}

// Initialize Supabase persistent storage
try {
  await initStorage();
  logger.info("Supabase Storage private buckets verified");
} catch (err: any) {
  logger.warn({ error: err.message }, "Supabase storage verification note");
}

// Verify database connectivity
try {
  const dbStatus = await checkDatabaseConnection();
  if (dbStatus.ok) {
    logger.info({ type: dbStatus.type }, "Database connection verified successfully");
  } else {
    logger.warn({ details: dbStatus.details, type: dbStatus.type }, "Database connection check note");
  }
} catch (dbErr: any) {
  logger.warn({ error: dbErr.message }, "Database connectivity check encountered an issue");
}

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env["HOST"] || "0.0.0.0";

const server = app.listen(port, host, () => {
  logger.info({ port, host }, "Server listening");
});

// Configure upload timeouts without keeping long idle sockets that trigger Windows libuv issues
server.keepAliveTimeout = 5000;  // 5 seconds safe keep-alive
server.headersTimeout = 65000;   // 65 seconds for headers
server.requestTimeout = 300000;  // 5 minutes for full 25MB body upload

server.on("connection", (socket: any) => {
  socket.on("error", () => {});
});

server.on("clientError", (err: any, socket: any) => {
  if (err.code === "ECONNRESET" || !socket.writable) {
    try { socket.destroy(); } catch {}
    return;
  }
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch {}
});

server.on("error", (err: any) => {
  logger.error({ err }, "HTTP Server error event");
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

