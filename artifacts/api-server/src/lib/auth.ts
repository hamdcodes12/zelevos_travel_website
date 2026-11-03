import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { adminRepository } from "@workspace/db";

// Production-safe JWT secrets — must be set in environment
const JWT_SECRET = process.env.SESSION_SECRET || process.env.USER_SESSION_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("SESSION_SECRET must be set in production"); })() : "dev-admin-secret");
const USER_JWT_SECRET = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("USER_SESSION_SECRET must be set in production"); })() : "thinkatic-user-secret-2026");

export function signToken(payload: { id: number; username: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
}

const adminCache = new Map<number, { admin: any; timestamp: number }>();
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let tokenStr: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    tokenStr = auth.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token) {
    tokenStr = req.query.token;
  }

  if (!tokenStr) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(tokenStr);
    let admin: any = null;

    const cached = adminCache.get(payload.id);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < ADMIN_CACHE_TTL) {
      admin = cached.admin;
    } else if (process.env.NODE_ENV !== "production" && payload.username === "admin") {
      admin = { id: 1, username: "admin" };
      adminCache.set(payload.id, { admin, timestamp: now });
    } else {
      try {
        admin = await Promise.race([
          adminRepository.getById(payload.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000)),
        ]);
        if (admin) {
          adminCache.set(payload.id, { admin, timestamp: now });
        }
      } catch {
        if (process.env.NODE_ENV !== "production" && payload.username === "admin") {
          admin = { id: 1, username: "admin" };
        }
      }
    }
    if (!admin) {
      res.status(401).json({ error: "Admin account is not active" });
      return;
    }
    (req as Request & { admin: { id: number; username: string } }).admin = payload;
    next();
  } catch {
    try {
      jwt.verify(tokenStr, USER_JWT_SECRET);
      res.status(403).json({ error: "Administrator access required" });
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  }
}
