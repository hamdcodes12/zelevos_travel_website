import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@workspace/db";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
  partnerId?: string | null;
  totpEnabled?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to enforce role-based access control.
 * Checks both req.user and req.admin, mapping admin portal sessions to 'admin' role.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Check if admin session is present
    if ((req as any).admin) {
      const adminRole = ((req as any).admin.role || "admin") as UserRole;
      if (allowedRoles.includes(adminRole) || allowedRoles.includes("admin")) {
        next();
        return;
      }
    }

    // 2. Check standard authenticated user
    const user = req.user as any;
    if (!user) {
      res.status(401).json({
        status: "unauthorized",
        message: "Authentication required to access this resource.",
      });
      return;
    }

    const userRole = (user.role || "customer") as UserRole;

    // Super admin has access to everything
    if (userRole === "admin") {
      next();
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        status: "forbidden",
        message: `Forbidden: role '${userRole}' lacks permission to access this endpoint.`,
      });
      return;
    }

    next();
  };
}

/**
 * Ensures vendor requests are strictly scoped to their assigned vendorId
 */
export function requireVendorScope() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if ((req as any).admin) {
      next();
      return;
    }
    const user = req.user as any;
    if (!user || user.role !== "vendor" || !user.vendorId) {
      res.status(403).json({
        status: "forbidden",
        message: "Active verified vendor profile required.",
      });
      return;
    }
    next();
  };
}

/**
 * Ensures partner requests are strictly scoped to their assigned partnerId
 */
export function requirePartnerScope() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if ((req as any).admin) {
      next();
      return;
    }
    const user = req.user as any;
    if (!user || user.role !== "partner" || !user.partnerId) {
      res.status(403).json({
        status: "forbidden",
        message: "Active approved partner profile required.",
      });
      return;
    }
    next();
  };
}
