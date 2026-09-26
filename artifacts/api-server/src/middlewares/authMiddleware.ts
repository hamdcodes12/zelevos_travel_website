import type { NextFunction, Request, Response } from "express";
import { userFromRequest, adminFromRequest } from "../lib/auth";
import type { User, AdminUser } from "@workspace/db";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      admin?: AdminUser;
      isAuthenticated(): this is Request & { user: User };
      isAdminAuthenticated(): this is Request & { admin: AdminUser };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    req.user = (await userFromRequest(req)) ?? undefined;
    req.admin = (await adminFromRequest(req)) ?? undefined;
  } catch (error) {
    const logFn = req.log?.error ? req.log.error.bind(req.log) : logger.error.bind(logger);
    logFn({ err: error }, "Failed to load auth session");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).json({ status: "auth_error", message: "Authentication could not be checked." });
    return;
  }
  req.isAuthenticated = function isAuthenticated(): this is Request & { user: User } {
    return Boolean(this.user);
  };
  req.isAdminAuthenticated = function isAdminAuthenticated(): this is Request & { admin: AdminUser } {
    return Boolean(this.admin);
  };
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ status: "unauthorized", message: "Please log in to continue." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAdminAuthenticated()) {
    res.status(401).json({ status: "unauthorized", message: "Admin access required. Please log in as an administrator." });
    return;
  }
  next();
}