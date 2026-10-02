import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { eq, desc, or, sql, and, inArray, gte, lte, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  usersTable,
  bookingsTable,
  adminUsersTable,
  auditLogsTable,
  paymentTransactionsTable,
  broadcastsTable,
  broadcastRecipientsTable,
  notificationsTable,
  vendorsTable,
  vendorDocumentsTable,
  vendorServicesTable,
  vendorInvoicesTable,
  supportTicketsTable,
  adminNotificationsTable,
  adminNotificationReadsTable,
  adminTicketReadsTable,
  refundsTable,
  paymentsTable,
  customTripRequestsTable,
  sessionsTable,
  customersTable,
} from "@workspace/db";
import {
  createAdminSession,
  destroyAdminSession,
  hashPassword,
  verifyPassword,
  publicAdmin,
  publicUser,
} from "../lib/auth";
import { requireAdmin } from "../middlewares/authMiddleware";
import { generateBase32Secret, getTotpAuthUrl, verifyTotp } from "../services/totp-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const adminLoginSchema = z.object({
  adminId: z.string().trim().min(1, "Admin ID is required.").max(100),
  password: z.string().min(1, "Password is required.").max(128),
  totpCode: z.string().trim().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long.").max(128),
  confirmNewPassword: z.string().min(8).max(128).optional(),
});

function publicAdminBooking(booking: typeof bookingsTable.$inferSelect) {
  if (booking.kind !== "HOTEL") return booking;
  const payload = { ...(booking.payload || {}) } as Record<string, unknown>;
  const fareSnapshot = { ...(booking.fareSnapshot || {}) } as Record<string, unknown>;
  delete payload.rateKey;
  delete fareSnapshot.rateKey;
  return { ...booking, payload, fareSnapshot };
}

// --------------------------------------------------------------------------
// 1. Admin Authentication (Login, Logout, Me, Change Password)
// --------------------------------------------------------------------------

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Admin ID and password are required.";
    res.status(400).json({ status: "invalid_request", message: msg });
    return;
  }

  const { adminId, password } = parsed.data;

  try {
    const cleanId = adminId.trim().toLowerCase();
    const [admin] = await db
      .select()
      .from(adminUsersTable)
      .where(sql`lower(${adminUsersTable.adminId}) = ${cleanId}`)
      .limit(1);

    if (!admin) {
      try {
        await db.insert(auditLogsTable).values({
          action: "ADMIN_LOGIN_FAILED",
          resourceType: "admin",
          ipAddress: req.ip,
          metadata: { attemptedAdminId: cleanId, reason: "unknown_admin" },
        });
      } catch {}
      res.status(401).json({ status: "invalid_credentials", message: "Invalid Admin ID or password." });
      return;
    }

    if (!verifyPassword(password, admin.passwordHash)) {
      try {
        await db.insert(auditLogsTable).values({
          actorAdminId: admin.id,
          action: "ADMIN_LOGIN_FAILED",
          resourceType: "admin",
          resourceId: admin.id,
          ipAddress: req.ip,
          metadata: { attemptedAdminId: cleanId, reason: "invalid_password" },
        });
      } catch {}
      res.status(401).json({ status: "invalid_credentials", message: "Invalid Admin ID or password." });
      return;
    }

    // Two-Factor Authentication check (Section 25)
    if (admin.totpEnabled && admin.totpSecret) {
      const code = parsed.data.totpCode;
      if (!code) {
        res.status(200).json({
          status: "2fa_required",
          require2fa: true,
          message: "Two-factor authentication code is required to complete admin login.",
        });
        return;
      }
      if (!verifyTotp(admin.totpSecret, code)) {
        try {
          await db.insert(auditLogsTable).values({
            actorAdminId: admin.id,
            action: "ADMIN_LOGIN_FAILED",
            resourceType: "admin",
            resourceId: admin.id,
            ipAddress: req.ip,
            metadata: { attemptedAdminId: cleanId, reason: "invalid_totp_code" },
          });
        } catch {}
        res.status(401).json({ status: "invalid_2fa", message: "Invalid two-factor authentication code." });
        return;
      }
    }

    // Update lastLoginAt
    await db
      .update(adminUsersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsersTable.id, admin.id));
    admin.lastLoginAt = new Date();

    await createAdminSession(admin.id, res);
    await db.insert(auditLogsTable).values({ actorAdminId: admin.id, action: "ADMIN_LOGIN", resourceType: "admin", resourceId: admin.id, ipAddress: req.ip, metadata: {} });
    res.json({ admin: publicAdmin(admin) });
  } catch (error) {
    const logFn = req.log?.error ? req.log.error.bind(req.log) : logger.error.bind(logger);
    logFn({ err: error }, "Failed to authenticate admin");
    res.status(500).json({ status: "database_error", message: "Admin login could not be completed." });
  }
});

router.post("/admin/2fa/setup", requireAdmin, async (req, res): Promise<void> => {
  const secret = generateBase32Secret(20);
  const authUrl = getTotpAuthUrl(req.admin!.adminId, secret, "Zelevos Admin");
  res.json({ status: "success", secret, authUrl });
});

router.post("/admin/2fa/enable", requireAdmin, async (req, res): Promise<void> => {
  const schema = z.object({ secret: z.string().min(16), token: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !verifyTotp(parsed.data.secret, parsed.data.token)) {
    res.status(400).json({ status: "invalid_code", message: "Invalid 2FA verification code or secret." });
    return;
  }
  await db.update(adminUsersTable).set({ totpEnabled: true, totpSecret: parsed.data.secret }).where(eq(adminUsersTable.id, req.admin!.id));
  res.json({ status: "success", message: "2FA successfully enabled for your admin account." });
});

router.post("/admin/2fa/disable", requireAdmin, async (req, res): Promise<void> => {
  const schema = z.object({ token: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (req.admin!.totpSecret && (!parsed.success || !verifyTotp(req.admin!.totpSecret, parsed.data.token))) {
    res.status(400).json({ status: "invalid_code", message: "Invalid 2FA code to disable 2FA." });
    return;
  }
  await db.update(adminUsersTable).set({ totpEnabled: false, totpSecret: null }).where(eq(adminUsersTable.id, req.admin!.id));
  res.json({ status: "success", message: "2FA successfully disabled." });
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  try {
    await destroyAdminSession(req, res);
    res.status(200).json({ status: "success", message: "Admin logged out successfully." });
  } catch (error) {
    const logFn = req.log?.error ? req.log.error.bind(req.log) : logger.error.bind(logger);
    logFn({ err: error }, "Failed to log out admin");
    res.status(500).json({ status: "database_error", message: "Logout could not be completed." });
  }
});

router.get("/admin/me", requireAdmin, (req, res): void => {
  res.json({ admin: publicAdmin(req.admin!) });
});

router.post("/admin/change-password", requireAdmin, async (req, res): Promise<void> => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Invalid password parameters.";
    res.status(400).json({ status: "invalid_request", message: msg });
    return;
  }

  const { currentPassword, newPassword, confirmNewPassword } = parsed.data;

  if (confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
    res.status(400).json({ status: "invalid_request", message: "New passwords do not match." });
    return;
  }

  try {
    const [admin] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, req.admin!.id))
      .limit(1);

    if (!admin) {
      res.status(404).json({ status: "not_found", message: "Admin account not found." });
      return;
    }

    if (!verifyPassword(currentPassword, admin.passwordHash)) {
      res.status(400).json({ status: "invalid_password", message: "Current password is incorrect." });
      return;
    }

    const newHash = hashPassword(newPassword);
    await db
      .update(adminUsersTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(adminUsersTable.id, admin.id));

    await db.insert(auditLogsTable).values({ actorAdminId: req.admin!.id, action: "ADMIN_PASSWORD_CHANGED", resourceType: "admin", resourceId: req.admin!.id, ipAddress: req.ip, metadata: {} });

    res.json({ success: true, message: "Admin password changed successfully." });
  } catch (error) {
    req.log.error({ err: error }, "Failed to update admin password");
    res.status(500).json({ status: "database_error", message: "Password update could not be completed." });
  }
});

// --------------------------------------------------------------------------
// 2. Admin Dashboard Overview & Stats
// --------------------------------------------------------------------------

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Customers count
    const allUsers = await db.select().from(usersTable);
    const totalCustomers = allUsers.length;
    const newCustomers = allUsers.filter((u: typeof usersTable.$inferSelect) => u.createdAt >= thirtyDaysAgo).length;

    // 2. Flight booking metrics and payment-ledger reconciliation.
    const allBookings = await db.select().from(bookingsTable);
    const flightBookings = allBookings.filter((b: typeof bookingsTable.$inferSelect) => b.kind === "FLIGHT");
    const payments = await db.select().from(paymentTransactionsTable);
    const totalFlightBookings = flightBookings.length;
    const confirmedBookings = flightBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "CONFIRMED").length;
    const pendingBookings = flightBookings.filter((b: typeof bookingsTable.$inferSelect) => ["SEARCHED", "SELECTED", "VALIDATING", "PAYMENT_PENDING", "PAID", "BOOKING_PENDING"].includes(b.status)).length;
    const failedBookings = flightBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "FAILED").length;
    const cancelledBookings = flightBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "CANCELLED").length;
    const refundPendingBookings = flightBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "REFUND_PENDING" || b.paymentStatus === "REFUND_PENDING").length;
    const refundedBookings = flightBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "REFUNDED" || b.paymentStatus === "REFUNDED").length;
    const totalBookingValue = flightBookings.reduce((sum: number, booking: typeof bookingsTable.$inferSelect) => sum + (booking.amount || 0), 0);
    const totalPaymentAmount = payments
      .filter((payment: typeof paymentTransactionsTable.$inferSelect) => ["CAPTURED", "PAID", "PAYMENT_CONFIRMED"].includes(payment.status))
      .reduce((sum: number, payment: typeof paymentTransactionsTable.$inferSelect) => sum + (payment.capturedAmount ?? payment.amount ?? 0), 0);
    const refundAmount = payments.reduce((sum: number, payment: typeof paymentTransactionsTable.$inferSelect) => sum + (payment.refundAmount || 0), 0);

    // Additional real metrics for the 8 Dashboard Stat Cards
    const activeBookings = allBookings.filter((b: typeof bookingsTable.$inferSelect) => ["CONFIRMED", "PAID", "IN_PROGRESS", "BOOKING_PENDING"].includes(b.status)).length;
    const pendingOperations = allBookings.filter((b: typeof bookingsTable.$inferSelect) => ["PENDING", "VALIDATING", "BOOKING_PENDING", "PAYMENT_PENDING"].includes(b.status)).length;
    const pendingPayments = payments.filter((p: typeof paymentTransactionsTable.$inferSelect) => ["CREATED", "PENDING", "PROCESSING"].includes(p.status)).length;

    let approvedVendors = 0;
    try {
      const allVendors = await db.select().from(vendorsTable);
      approvedVendors = allVendors.filter((v: typeof vendorsTable.$inferSelect) => v.status === "APPROVED" || v.status === "active").length;
    } catch {}

    let openSupportTickets = 0;
    let unreadSupportTickets = 0;
    try {
      const tickets = await db.select().from(supportTicketsTable);
      openSupportTickets = tickets.filter((t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "PENDING").length;

      // Admin-specific support ticket unread count (Section 7, 9)
      const currentAdminId = req.admin?.id;
      if (currentAdminId) {
        const reads = await db
          .select()
          .from(adminTicketReadsTable)
          .where(eq(adminTicketReadsTable.adminId, currentAdminId));
        const readMap = new Map<string, Date>();
        for (const r of reads) {
          if (r.lastReadAt) readMap.set(r.ticketId, new Date(r.lastReadAt));
        }
        unreadSupportTickets = tickets.filter((t: any) => {
          const lr = readMap.get(t.id);
          const lm = t.lastMessageAt ? new Date(t.lastMessageAt) : new Date(t.createdAt);
          return !lr || lm > lr;
        }).length;
      }
    } catch {}

    // Admin-specific global notification unread count (Section 8, 22)
    let unreadNotifications = 0;
    try {
      const currentAdminId = req.admin?.id;
      if (currentAdminId) {
        const allAdminNotifs = await db.select({ id: adminNotificationsTable.id }).from(adminNotificationsTable);
        const readAdminNotifs = await db
          .select({ notificationId: adminNotificationReadsTable.notificationId })
          .from(adminNotificationReadsTable)
          .where(
            and(
              eq(adminNotificationReadsTable.adminId, currentAdminId),
              isNotNull(adminNotificationReadsTable.readAt)
            )
          );
        const readSet = new Set(readAdminNotifs.map((r: any) => r.notificationId));
        unreadNotifications = allAdminNotifs.filter((n: any) => !readSet.has(n.id)).length;
      }
    } catch {}

    // 3. Recent bookings (with user info)
    const recentBookingsRaw: Array<{ booking: typeof bookingsTable.$inferSelect; user: typeof usersTable.$inferSelect }> = await db
      .select({
        booking: bookingsTable,
        user: usersTable,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.ownerId, usersTable.id))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(5);

    const recentBookings = recentBookingsRaw.map(({ booking, user }) => {
      const segments = Array.isArray(booking.segments) ? (booking.segments as any[]) : [];
      const origin = segments[0]?.origin || "N/A";
      const dest = segments[segments.length - 1]?.destination || "N/A";
      const airline = segments[0]?.airline || segments[0]?.carrier || "N/A";
      const flightNumber = segments[0]?.flightNumber || "";
      const departureTime = segments[0]?.departureTime || booking.createdAt;

      return {
        id: booking.id,
        bookingReference: booking.bookingReference,
        pnr: booking.pnr ?? "Not issued",
        route: `${origin} → ${dest}`,
        flight: `${airline} ${flightNumber}`.trim(),
        travelDate: departureTime,
        amount: booking.amount,
        status: booking.status,
        paymentStatus: booking.paymentStatus ?? "PENDING",
        customerName: user.fullName || user.email.split("@")[0],
        customerEmail: user.email,
        customerId: user.customerId ?? null,
        createdAt: booking.createdAt,
      };
    });

    // 4. Recent customers
    const recentCustomersRaw = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(5);

    const recentCustomers = recentCustomersRaw.map((u: typeof usersTable.$inferSelect) => {
      const userBookings = allBookings.filter((b: typeof bookingsTable.$inferSelect) => b.ownerId === u.id);
      return {
        id: u.id,
        customerId: u.customerId ?? null,
        fullName: u.fullName || u.email.split("@")[0],
        email: u.email,
        phone: u.phone ?? null,
        authProvider: u.authProvider,
        status: u.status,
        bookingCount: userBookings.length,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
      };
    });

    res.json({
      metrics: {
        totalCustomers,
        newCustomers,
        activeBookings,
        pendingOperations,
        approvedVendors,
        revenue: totalPaymentAmount,
        pendingPayments,
        openSupportTickets,
        unreadSupportTickets,
        unreadNotifications,
        totalBookings: allBookings.length,
        totalFlightBookings,
        pendingBookings,
        confirmedBookings,
        failedBookings,
        cancelledBookings,
        refundPendingBookings,
        refundedBookings,
        totalBookingValue,
        totalPaymentAmount,
        refundAmount,
      },
      recentBookings,
      recentCustomers,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch admin stats");
    res.status(500).json({ status: "database_error", message: "Failed to compute stats." });
  }
});

// --------------------------------------------------------------------------
// 2B. Admin Notifications Center (Section 8, 22, 23, 33)
// --------------------------------------------------------------------------

router.get("/admin/notifications", requireAdmin, async (req, res): Promise<void> => {
  const currentAdminId = req.admin!.id;
  try {
    const allNotifs = await db
      .select()
      .from(adminNotificationsTable)
      .orderBy(desc(adminNotificationsTable.createdAt))
      .limit(100);

    const reads = await db
      .select()
      .from(adminNotificationReadsTable)
      .where(eq(adminNotificationReadsTable.adminId, currentAdminId));

    const readMap = new Map<string, { readAt: Date | null; dismissedAt: Date | null }>();
    for (const r of reads) {
      readMap.set(r.notificationId, {
        readAt: r.readAt ? new Date(r.readAt) : null,
        dismissedAt: r.dismissedAt ? new Date(r.dismissedAt) : null,
      });
    }

    const mapped = allNotifs
      .map((n: any) => {
        const r = readMap.get(n.id);
        const isRead = Boolean(r?.readAt);
        const isDismissed = Boolean(r?.dismissedAt);
        return {
          id: n.id,
          type: n.type,
          module: n.module,
          relatedId: n.relatedId,
          title: n.title,
          message: n.message,
          priority: n.priority,
          actionRequired: n.actionRequired,
          actionUrl: n.actionUrl,
          createdAt: n.createdAt,
          isRead,
          isDismissed,
          readAt: r?.readAt?.toISOString() || null,
        };
      })
      .filter((n: any) => !n.isDismissed);

    const allCount = mapped.length;
    const unreadCount = mapped.filter((n: any) => !n.isRead).length;
    const actionRequiredCount = mapped.filter((n: any) => n.actionRequired && !n.isRead).length;

    res.json({
      status: "success",
      notifications: mapped,
      allCount,
      unreadCount,
      actionRequiredCount,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch admin notifications");
    res.status(500).json({ status: "database_error", message: "Failed to load admin notifications." });
  }
});

router.post("/admin/notifications/:id/read", requireAdmin, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const currentAdminId = req.admin!.id;

  try {
    await db
      .insert(adminNotificationReadsTable)
      .values({
        adminId: currentAdminId,
        notificationId: id,
        readAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [adminNotificationReadsTable.adminId, adminNotificationReadsTable.notificationId],
        set: { readAt: new Date() },
      });

    res.json({ status: "success", message: "Notification marked as read." });
  } catch (error) {
    req.log.error({ err: error }, "Failed to mark admin notification as read");
    res.status(500).json({ status: "database_error", message: "Failed to mark notification as read." });
  }
});

router.post("/admin/notifications/read-all", requireAdmin, async (req, res): Promise<void> => {
  const currentAdminId = req.admin!.id;

  try {
    const allNotifs = await db.select({ id: adminNotificationsTable.id }).from(adminNotificationsTable);
    for (const n of allNotifs) {
      await db
        .insert(adminNotificationReadsTable)
        .values({
          adminId: currentAdminId,
          notificationId: n.id,
          readAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [adminNotificationReadsTable.adminId, adminNotificationReadsTable.notificationId],
          set: { readAt: new Date() },
        });
    }

    res.json({ status: "success", message: "All notifications marked as read." });
  } catch (error) {
    req.log.error({ err: error }, "Failed to mark all admin notifications as read");
    res.status(500).json({ status: "database_error", message: "Failed to mark all as read." });
  }
});

router.post("/admin/notifications/:id/dismiss", requireAdmin, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const currentAdminId = req.admin!.id;

  try {
    await db
      .insert(adminNotificationReadsTable)
      .values({
        adminId: currentAdminId,
        notificationId: id,
        readAt: new Date(),
        dismissedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [adminNotificationReadsTable.adminId, adminNotificationReadsTable.notificationId],
        set: { readAt: new Date(), dismissedAt: new Date() },
      });

    res.json({ status: "success", message: "Notification dismissed." });
  } catch (error) {
    req.log.error({ err: error }, "Failed to dismiss admin notification");
    res.status(500).json({ status: "database_error", message: "Failed to dismiss notification." });
  }
});// --------------------------------------------------------------------------
// 3. Customers Management (List, Search, Filter, Details, Archive & Restore)
// --------------------------------------------------------------------------

const archiveCustomerSchema = z.object({
  reason: z.string().trim().min(3, "Archive reason is required and must be at least 3 characters.").max(200),
  note: z.string().trim().max(1000).optional(),
});

router.get("/admin/customers", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "all";

  try {
    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const allBookings = await db.select().from(bookingsTable);
    const allAdmins = await db.select().from(adminUsersTable);
    const adminMap = new Map<string, string>(
      allAdmins.map((a: any) => [a.id, a.adminId])
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Lifecycle Filtering:
    // "archived": only archived customers
    // "new": non-archived registered within last 7 days
    // "active": non-archived status="active"
    // "suspended": non-archived status="suspended"
    // "all" (default): ALL non-archived customers (hides archived customers from normal active list)
    if (statusFilter === "archived") {
      users = users.filter((u: any) => u.isArchived || u.status === "archived");
    } else if (statusFilter === "new") {
      users = users.filter((u: any) => !u.isArchived && u.status !== "archived" && new Date(u.createdAt) >= sevenDaysAgo);
    } else if (statusFilter === "active") {
      users = users.filter((u: any) => !u.isArchived && u.status === "active");
    } else if (statusFilter === "suspended") {
      users = users.filter((u: any) => !u.isArchived && u.status === "suspended");
    } else {
      // Default: active / all non-archived
      users = users.filter((u: any) => !u.isArchived && u.status !== "archived");
    }

    if (search) {
      const bookingOwnerIds = new Set<string>();
      for (const b of allBookings) {
        if (
          (b.bookingReference && b.bookingReference.toLowerCase().includes(search)) ||
          (b.pnr && b.pnr.toLowerCase().includes(search)) ||
          (b.id && b.id.toLowerCase().includes(search))
        ) {
          if (b.ownerId) bookingOwnerIds.add(b.ownerId);
          if ((b as any).customerId) bookingOwnerIds.add((b as any).customerId);
        }
      }

      users = users.filter((u: any) => {
        const idMatch = (u.customerId && u.customerId.toLowerCase().includes(search)) || u.id.toLowerCase().includes(search);
        const nameMatch = u.fullName?.toLowerCase().includes(search);
        const emailMatch = u.email.toLowerCase().includes(search);
        const phoneMatch = u.phone?.toLowerCase().includes(search);
        const bookingMatch = bookingOwnerIds.has(u.id);
        return Boolean(idMatch || nameMatch || emailMatch || phoneMatch || bookingMatch);
      });
    }

    const customers = users.map((u: any) => {
      const userBookings = allBookings.filter((b: any) => b.ownerId === u.id || b.customerId === u.id);
      const totalBookingValue = userBookings
        .filter((b: any) => b.status === "CONFIRMED" || b.paymentStatus === "PAID")
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const isArchived = Boolean(u.isArchived || u.status === "archived");
      const isNew = !isArchived && new Date(u.createdAt) >= sevenDaysAgo;
      const archivedByName = u.archivedBy ? (adminMap.get(u.archivedBy) || null) : null;

      return {
        id: u.id,
        customerId: u.customerId ?? `CUST-${u.id.substring(0, 8).toUpperCase()}`,
        fullName: u.fullName || u.email.split("@")[0],
        email: u.email,
        phone: u.phone ?? null,
        authProvider: u.authProvider,
        status: isArchived ? "archived" : (u.status ?? "active"),
        isArchived,
        archivedAt: u.archivedAt ?? null,
        archivedBy: u.archivedBy ?? null,
        archivedByName,
        archiveReason: u.archiveReason ?? null,
        archiveNote: u.archiveNote ?? null,
        isNew,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
        bookingCount: userBookings.length,
        totalBookingValue,
      };
    });

    res.json({ customers });
  } catch (error) {
    req.log.error({ err: error }, "Failed to list customers for admin");
    res.status(500).json({ status: "database_error", message: "Failed to load customers." });
  }
});

router.get("/admin/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const condition = isUuid
      ? or(eq(usersTable.id, id), eq(usersTable.customerId, id))
      : eq(usersTable.customerId, id);

    const [user] = await db.select().from(usersTable).where(condition).limit(1);

    if (!user) {
      res.status(404).json({ status: "not_found", message: "Customer account not found." });
      return;
    }

    let archivedByName: string | null = null;
    if (user.archivedBy) {
      const [adminUser] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, user.archivedBy)).limit(1);
      if (adminUser) archivedByName = adminUser.adminId;
    }

    const customerBookings = await db
      .select()
      .from(bookingsTable)
      .where(or(eq(bookingsTable.ownerId, user.id), eq(bookingsTable.customerId, user.id)))
      .orderBy(desc(bookingsTable.createdAt));

    const formattedBookings = customerBookings.map((b: typeof bookingsTable.$inferSelect) => {
      const segments = Array.isArray(b.segments) ? (b.segments as any[]) : [];
      const origin = segments[0]?.origin || "DEL";
      const dest = segments[segments.length - 1]?.destination || "BOM";
      const airline = segments[0]?.airline || "Airline";
      const flightNumber = segments[0]?.flightNumber || "";
      const departureTime = segments[0]?.departureTime || b.createdAt;

      return {
        id: b.id,
        bookingReference: b.bookingReference,
        pnr: b.pnr ?? "Pending",
        ticketNumber: b.ticketNumber ?? null,
        flight: `${airline} ${flightNumber}`.trim(),
        route: `${origin} → ${dest}`,
        travelDate: departureTime,
        amount: b.amount,
        status: b.status,
        paymentStatus: b.paymentStatus ?? "PENDING",
        paymentId: b.paymentId ?? null,
        paymentOrderId: b.paymentOrderId ?? null,
        cancellationDetails: b.cancellationDetails ?? null,
        refundAmount: b.refundAmount ?? null,
        emailStatus: b.emailStatus,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    res.json({
      customer: {
        ...publicUser(user),
        archivedByName,
      },
      bookings: formattedBookings,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch customer details");
    res.status(500).json({ status: "database_error", message: "Failed to load customer details." });
  }
});

router.post("/admin/customers/:id/archive", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id).trim();
  const parsed = archiveCustomerSchema.safeParse(req.body);

  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Valid archive reason is required.";
    res.status(400).json({ status: "invalid_input", message: errorMsg });
    return;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const condition = isUuid
      ? or(eq(usersTable.id, id), eq(usersTable.customerId, id))
      : eq(usersTable.customerId, id);

    const [user] = await db.select().from(usersTable).where(condition).limit(1);

    if (!user) {
      res.status(404).json({ status: "not_found", message: "Customer account not found." });
      return;
    }

    if (user.isArchived || user.status === "archived") {
      res.status(400).json({ status: "already_archived", message: "Customer is already archived." });
      return;
    }

    const now = new Date();
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        status: "archived",
        isArchived: true,
        archivedAt: now,
        archivedBy: req.admin!.id,
        archiveReason: parsed.data.reason,
        archiveNote: parsed.data.note?.trim() || null,
        updatedAt: now,
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    // Revoke active sessions immediately
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));

    // Audit logging
    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      actorName: req.admin!.adminId,
      actorRole: "admin",
      action: "CUSTOMER_ARCHIVED",
      resourceType: "user",
      resourceId: user.id,
      previousValue: { status: user.status, isArchived: user.isArchived },
      newValue: {
        status: "archived",
        isArchived: true,
        archivedAt: now.toISOString(),
        archiveReason: parsed.data.reason,
      },
      ipAddress: req.ip,
      metadata: {
        customerId: user.customerId,
        email: user.email,
        fullName: user.fullName,
        reason: parsed.data.reason,
        note: parsed.data.note?.trim() || null,
      },
    });

    res.json({
      status: "success",
      message: "Customer successfully archived. Account is removed from active list and historical records remain intact.",
      customer: {
        ...publicUser(updatedUser),
        archivedByName: req.admin!.adminId,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to archive customer");
    res.status(500).json({ status: "database_error", message: "Unable to archive this customer. Please try again." });
  }
});

router.post("/admin/customers/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id).trim();

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const condition = isUuid
      ? or(eq(usersTable.id, id), eq(usersTable.customerId, id))
      : eq(usersTable.customerId, id);

    const [user] = await db.select().from(usersTable).where(condition).limit(1);

    if (!user) {
      res.status(404).json({ status: "not_found", message: "Customer account not found." });
      return;
    }

    if (!user.isArchived && user.status !== "archived") {
      res.status(400).json({ status: "not_archived", message: "Customer is not currently archived." });
      return;
    }

    const now = new Date();
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        status: "active",
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        archiveNote: null,
        updatedAt: now,
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    // Audit logging
    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      actorName: req.admin!.adminId,
      actorRole: "admin",
      action: "CUSTOMER_RESTORED",
      resourceType: "user",
      resourceId: user.id,
      previousValue: {
        status: user.status,
        isArchived: user.isArchived,
        archiveReason: user.archiveReason,
      },
      newValue: {
        status: "active",
        isArchived: false,
      },
      ipAddress: req.ip,
      metadata: {
        customerId: user.customerId,
        email: user.email,
        fullName: user.fullName,
        restoredAt: now.toISOString(),
      },
    });

    res.json({
      status: "success",
      message: "Customer successfully restored to active status.",
      customer: publicUser(updatedUser),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to restore customer");
    res.status(500).json({ status: "database_error", message: "Unable to restore this customer. Please try again." });
  }
});

router.delete("/admin/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id).trim();

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const condition = isUuid
      ? or(eq(usersTable.id, id), eq(usersTable.customerId, id))
      : eq(usersTable.customerId, id);

    const [user] = await db.select().from(usersTable).where(condition).limit(1);

    if (!user) {
      res.status(404).json({ status: "not_found", message: "Customer account not found." });
      return;
    }

    // Check for active or past bookings
    const bookings = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(eq(bookingsTable.ownerId, user.id))
      .limit(1);

    if (bookings.length > 0 && req.query.force !== "true") {
      res.status(400).json({
        status: "has_bookings",
        message: "Cannot permanently delete customer with booking history. Please archive the customer account instead.",
      });
      return;
    }

    // Clean up dependent customer records
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id)).catch(() => {});
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, user.id)).catch(() => {});
    await db.delete(customersTable).where(eq(customersTable.userId, user.id)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      actorName: req.admin!.adminId,
      actorRole: "admin",
      action: "CUSTOMER_DELETED",
      resourceType: "user",
      resourceId: user.id,
      previousValue: { email: user.email, customerId: user.customerId },
      ipAddress: req.ip,
      metadata: { customerId: user.customerId, email: user.email, deletedAt: new Date().toISOString() },
    });

    res.json({
      status: "success",
      message: `Customer ${user.customerId || user.email} permanently deleted.`,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete customer");
    res.status(500).json({ status: "database_error", message: "Unable to delete customer. Please try again." });
  }
});

// --------------------------------------------------------------------------
// 4. Bookings Management (All bookings across platform, search, filter, details, archive, delete)
// --------------------------------------------------------------------------

router.get("/admin/bookings", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
  const includeArchived = req.query.includeArchived === "true" || req.query.archived === "true";

  try {
    const raw: Array<{ booking: typeof bookingsTable.$inferSelect; user: typeof usersTable.$inferSelect }> = await db
      .select({
        booking: bookingsTable,
        user: usersTable,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.ownerId, usersTable.id))
      .orderBy(desc(bookingsTable.createdAt));

    let items = raw.map(({ booking, user }) => {
      const segments = Array.isArray(booking.segments) ? (booking.segments as any[]) : [];
      const isFlightBooking = booking.kind === "FLIGHT";
      const origin = isFlightBooking ? (segments[0]?.origin || "N/A") : "—";
      const dest = isFlightBooking ? (segments[segments.length - 1]?.destination || "N/A") : "—";
      const airline = isFlightBooking ? (segments[0]?.airline || segments[0]?.carrier || "Airline") : booking.kind;
      const flightNumber = isFlightBooking ? (segments[0]?.flightNumber || "") : "";
      const departureTime = isFlightBooking ? (segments[0]?.departureTime || booking.createdAt) : booking.createdAt;
      const payloadName = typeof (booking.payload as any)?.name === "string" ? (booking.payload as any).name : null;

      return {
        id: booking.id,
        kind: booking.kind,
        bookingReference: booking.bookingReference,
        pnr: booking.pnr ?? (isFlightBooking ? "Pending" : "N/A"),
        ticketNumber: booking.ticketNumber ?? null,
        route: isFlightBooking ? `${origin} → ${dest}` : (payloadName || booking.kind),
        flight: isFlightBooking ? `${airline} ${flightNumber}`.trim() : `${booking.kind} · DEMO`,
        airline,
        flightNumber,
        travelDate: departureTime,
        amount: booking.amount,
        status: booking.status,
        paymentStatus: booking.paymentStatus ?? "PENDING",
        paymentId: booking.paymentId ?? null,
        paymentOrderId: booking.paymentOrderId ?? null,
        refundAmount: booking.refundAmount ?? null,
        cancellationDetails: booking.cancellationDetails ?? null,
        isArchived: booking.isArchived ?? false,
        archivedAt: booking.archivedAt ?? null,
        archivedBy: booking.archivedBy ?? null,
        archiveReason: booking.archiveReason ?? null,
        customer: {
          id: user.id,
          customerId: user.customerId ?? null,
          fullName: user.fullName || user.email.split("@")[0],
          email: user.email,
          phone: user.phone ?? null,
        },
        createdAt: booking.createdAt,
      };
    });

    if (statusFilter === "ARCHIVED") {
      items = items.filter((b) => b.isArchived);
    } else {
      if (!includeArchived) {
        items = items.filter((b) => !b.isArchived);
      }
      if (statusFilter && statusFilter !== "ALL") {
        items = items.filter((b: (typeof items)[number]) => b.status === statusFilter);
      }
    }

    if (search) {
      items = items.filter((b: (typeof items)[number]) => {
        const pnrMatch = (b.pnr || "").toLowerCase().includes(search);
        const refMatch = (b.bookingReference || "").toLowerCase().includes(search);
        const nameMatch = (b.customer.fullName || "").toLowerCase().includes(search);
        const emailMatch = (b.customer.email || "").toLowerCase().includes(search);
        const flightMatch = (b.flight || "").toLowerCase().includes(search);
        const routeMatch = (b.route || "").toLowerCase().includes(search);
        return Boolean(pnrMatch || refMatch || nameMatch || emailMatch || flightMatch || routeMatch);
      });
    }

    res.json({ bookings: items });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch bookings for admin");
    res.status(500).json({ status: "database_error", message: "Failed to load bookings." });
  }
});

router.get("/admin/bookings/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);

  try {
    const records: Array<{ booking: typeof bookingsTable.$inferSelect; user: typeof usersTable.$inferSelect }> = await db
      .select({
        booking: bookingsTable,
        user: usersTable,
      })
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.ownerId, usersTable.id))
      .where(eq(bookingsTable.id, id))
      .limit(1);

    const record = records[0];
    if (!record) {
      res.status(404).json({ status: "not_found", message: "Booking record not found." });
      return;
    }

    const { booking, user } = record;

    res.json({
      booking: {
        ...publicAdminBooking(booking),
        isArchived: booking.isArchived ?? false,
        archivedAt: booking.archivedAt ?? null,
        archivedBy: booking.archivedBy ?? null,
        archiveReason: booking.archiveReason ?? null,
        customer: {
          id: user.id,
          customerId: user.customerId ?? null,
          fullName: user.fullName || user.email.split("@")[0],
          email: user.email,
          phone: user.phone ?? null,
        },
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch single booking detail");
    res.status(500).json({ status: "database_error", message: "Failed to load booking details." });
  }
});

router.post("/admin/bookings/:id/archive", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id).trim();
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Archived by administrator";

  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking record not found." });
      return;
    }

    if (booking.isArchived) {
      res.status(400).json({ status: "already_archived", message: "Booking is already archived." });
      return;
    }

    const now = new Date();
    const adminActor = req.admin?.adminId || "admin";
    const [updated] = await db
      .update(bookingsTable)
      .set({
        isArchived: true,
        archivedAt: now,
        archivedBy: adminActor,
        archiveReason: reason,
        updatedAt: now,
      })
      .where(eq(bookingsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      actorName: req.admin!.adminId,
      actorRole: "admin",
      action: "BOOKING_ARCHIVED",
      resourceType: "booking",
      resourceId: booking.id,
      previousValue: { isArchived: false, status: booking.status },
      newValue: { isArchived: true, archiveReason: reason },
      ipAddress: req.ip,
      metadata: {
        bookingId: booking.bookingId || booking.bookingReference,
        archivedAt: now.toISOString(),
        reason,
      },
    });

    res.json({
      status: "success",
      message: "Booking successfully archived.",
      booking: publicAdminBooking(updated),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to archive booking");
    res.status(500).json({ status: "database_error", message: "Failed to archive booking." });
  }
});

router.post("/admin/bookings/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id).trim();

  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking record not found." });
      return;
    }

    if (!booking.isArchived) {
      res.status(400).json({ status: "not_archived", message: "Booking is not archived." });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(bookingsTable)
      .set({
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        updatedAt: now,
      })
      .where(eq(bookingsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      actorName: req.admin!.adminId,
      actorRole: "admin",
      action: "BOOKING_RESTORED",
      resourceType: "booking",
      resourceId: booking.id,
      previousValue: { isArchived: true, archiveReason: booking.archiveReason },
      newValue: { isArchived: false },
      ipAddress: req.ip,
      metadata: {
        bookingId: booking.bookingId || booking.bookingReference,
        restoredAt: now.toISOString(),
      },
    });

    res.json({
      status: "success",
      message: "Booking successfully restored.",
      booking: publicAdminBooking(updated),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to restore booking");
    res.status(500).json({ status: "database_error", message: "Failed to restore booking." });
  }
});

router.delete("/admin/bookings/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id).trim();
  const force = req.query.force === "true";

  try {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking record not found." });
      return;
    }

    const hasFinancials = booking.paymentStatus === "CAPTURED" || (booking.amount && booking.amount > 0 && booking.status === "CONFIRMED");
    if (hasFinancials && !force) {
      res.status(400).json({
        status: "has_financial_records",
        message: "Cannot permanently delete a confirmed booking with captured payments. Please archive it instead to maintain financial audit trails.",
      });
      return;
    }

    // Clean up dependent payment transactions and audit logs or disassociate
    await db.delete(paymentTransactionsTable).where(eq(paymentTransactionsTable.bookingId, booking.id)).catch(() => {});
    await db.execute(sql`UPDATE custom_trip_requests SET booking_id = NULL WHERE booking_id = ${booking.id}`).catch(() => {});
    await db.delete(bookingsTable).where(eq(bookingsTable.id, booking.id));

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      actorName: req.admin!.adminId,
      actorRole: "admin",
      action: "BOOKING_DELETED",
      resourceType: "booking",
      resourceId: booking.id,
      previousValue: {
        bookingReference: booking.bookingReference,
        pnr: booking.pnr,
        status: booking.status,
        amount: booking.amount,
      },
      ipAddress: req.ip,
      metadata: { deletedAt: new Date().toISOString() },
    });

    res.json({
      status: "success",
      message: `Booking ${booking.bookingReference || booking.pnr || booking.id} permanently deleted.`,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete booking");
    res.status(500).json({ status: "database_error", message: "Failed to delete booking." });
  }
});

// --------------------------------------------------------------------------
// 5. Payments Audit (Order IDs, amounts, statuses, refund statuses, dates)
// --------------------------------------------------------------------------

router.get("/admin/payments", requireAdmin, async (req, res): Promise<void> => {
  try {
    const raw: Array<{
      transaction: typeof paymentTransactionsTable.$inferSelect;
      booking: typeof bookingsTable.$inferSelect | null;
      user: typeof usersTable.$inferSelect;
      customTrip: typeof customTripRequestsTable.$inferSelect | null;
    }> = await db
      .select({
        transaction: paymentTransactionsTable,
        booking: bookingsTable,
        user: usersTable,
        customTrip: customTripRequestsTable,
      })
      .from(paymentTransactionsTable)
      .innerJoin(usersTable, eq(paymentTransactionsTable.userId, usersTable.id))
      .leftJoin(bookingsTable, eq(paymentTransactionsTable.bookingId, bookingsTable.id))
      .leftJoin(customTripRequestsTable, eq(bookingsTable.id, customTripRequestsTable.bookingId))
      .orderBy(desc(paymentTransactionsTable.createdAt));

    const payments = raw.map(({ transaction, booking, user, customTrip }) => {
      const isRefunded = transaction.refundStatus !== "NONE" || transaction.refundAmount > 0;
      const masterBookingId = booking?.bookingId || booking?.bookingReference || null;

      return {
        id: transaction.id,
        provider: transaction.provider,
        paymentOrderId: transaction.providerOrderId ?? null,
        paymentId: transaction.providerPaymentId ?? null,
        bookingId: transaction.bookingId ?? "",
        masterBookingId,
        bookingReference: masterBookingId ?? "Pending",
        leadNumber: customTrip?.leadNumber ?? null,
        proposalId: customTrip?.id ?? null,
        receiptNumber: masterBookingId ? `REC-${masterBookingId}` : null,
        receiptUrl: masterBookingId ? `/api/bookings/${masterBookingId}/receipt/download` : null,
        pnr: booking?.pnr ?? "Pending",
        customer: {
          fullName: user.fullName || user.email.split("@")[0],
          email: user.email,
          phone: user.phone ?? null,
          customerId: user.customerId ?? customTrip?.customerId ?? null,
        },
        amount: transaction.amount,
        currency: transaction.currency,
        capturedAmount: transaction.capturedAmount,
        status: transaction.status,
        refundStatus: isRefunded ? "REFUNDED" : "NONE",
        refundAmount: transaction.refundAmount,
        failureReason: transaction.failureReason,
        webhookEventType: transaction.webhookEventType,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      };
    });

    res.json({ payments });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch payments for admin");
    res.status(500).json({ status: "database_error", message: "Failed to load payment records." });
  }
});

router.get("/admin/audit-logs", requireAdmin, async (_req, res): Promise<void> => {
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(200);
  res.json({ logs });
});

// --------------------------------------------------------------------------
// 6. Broadcasts & Offers Center (Admin)
// --------------------------------------------------------------------------

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const distUploadsDir = path.resolve(process.cwd(), "artifacts/zelevos/dist/public/uploads");
if (!fs.existsSync(distUploadsDir)) {
  fs.mkdirSync(distUploadsDir, { recursive: true });
}

const broadcastImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const unique = `broadcast-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

const broadcastUpload = multer({
  storage: broadcastImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

router.post("/admin/broadcasts/upload-image", requireAdmin, broadcastUpload.single("image"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ status: "invalid_request", message: "No image file provided." });
    return;
  }

  // Copy to dist uploads directory for immediate static web server delivery
  try {
    const targetPath = path.join(distUploadsDir, req.file.filename);
    fs.copyFileSync(req.file.path, targetPath);
  } catch (copyErr) {
    logger.warn({ err: copyErr }, "Could not copy image to frontend dist uploads directory");
  }

  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({ status: "success", url: publicUrl, filename: req.file.filename });
});

async function getTargetUsersForBroadcast(targetAudience: string, targetUserId?: string | null): Promise<Array<typeof usersTable.$inferSelect>> {
  if ((targetAudience === "SPECIFIC_USER" || targetAudience === "SPECIFIC_CUSTOMER") && targetUserId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    const cond = isUuid
      ? or(eq(usersTable.id, targetUserId), eq(usersTable.customerId, targetUserId), eq(usersTable.email, targetUserId.toLowerCase()))
      : or(eq(usersTable.customerId, targetUserId), eq(usersTable.email, targetUserId.toLowerCase()));
    return db.select().from(usersTable).where(cond);
  }

  if (targetAudience === "UPCOMING_TRIPS") {
    const confirmedBookings = await db.select({ ownerId: bookingsTable.ownerId, customerId: bookingsTable.customerId })
      .from(bookingsTable)
      .where(or(eq(bookingsTable.status, "CONFIRMED"), eq(bookingsTable.paymentStatus, "PAID")));
    const userIds = Array.from(new Set(confirmedBookings.map((b: any) => b.ownerId || b.customerId).filter(Boolean))) as string[];
    if (userIds.length === 0) return [];
    return db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  }

  if (targetAudience === "PAST_BOOKINGS") {
    const pastBookings = await db.select({ ownerId: bookingsTable.ownerId, customerId: bookingsTable.customerId })
      .from(bookingsTable)
      .where(or(eq(bookingsTable.status, "COMPLETED"), eq(bookingsTable.status, "CONFIRMED")));
    const userIds = Array.from(new Set(pastBookings.map((b: any) => b.ownerId || b.customerId).filter(Boolean))) as string[];
    if (userIds.length === 0) return [];
    return db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  }

  if (targetAudience === "PAYMENT_PENDING") {
    const pendingBookings = await db.select({ ownerId: bookingsTable.ownerId, customerId: bookingsTable.customerId })
      .from(bookingsTable)
      .where(or(eq(bookingsTable.paymentStatus, "PENDING"), eq(bookingsTable.status, "PAYMENT_PENDING")));
    const userIds = Array.from(new Set(pendingBookings.map((b: any) => b.ownerId || b.customerId).filter(Boolean))) as string[];
    if (userIds.length === 0) return [];
    return db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  }

  // ALL_CUSTOMERS default: returns all eligible customer accounts
  return db.select().from(usersTable).where(or(eq(usersTable.role, "customer"), isNull(usersTable.role)));
}

export async function dispatchBroadcast(broadcastId: string): Promise<{ success: boolean; deliveredCount: number }> {
  const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, broadcastId)).limit(1);
  if (!broadcast || broadcast.status === "CANCELLED" || broadcast.status === "EXPIRED" || broadcast.status === "REVOKED") {
    return { success: false, deliveredCount: 0 };
  }

  // Server-authoritative expiry check before dispatching
  if (broadcast.expiresAt && new Date(broadcast.expiresAt) <= new Date()) {
    await db.update(broadcastsTable)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(broadcastsTable.id, broadcast.id));
    return { success: false, deliveredCount: 0 };
  }

  const targetUsers = await getTargetUsersForBroadcast(broadcast.targetAudience, broadcast.targetUserId);
  let deliveredCount = 0;

  const chunkSize = 25;
  for (let i = 0; i < targetUsers.length; i += chunkSize) {
    const chunk = targetUsers.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (user) => {
        try {
          const [notif] = await db.insert(notificationsTable).values({
            userId: user.id,
            recipientEmail: user.email,
            type: "BROADCAST_ANNOUNCEMENT",
            category: broadcast.category || "ANNOUNCEMENT",
            title: broadcast.title,
            body: broadcast.message,
            imageUrl: broadcast.imageUrl,
            actionButton: broadcast.actionButton,
            actionUrl: broadcast.actionUrl,
            broadcastId: broadcast.id,
            channel: "in_app",
            status: "SENT",
            metadata: {
              broadcastId: broadcast.id,
              category: broadcast.category,
              priority: broadcast.priority || "NORMAL",
              expiresAt: broadcast.expiresAt ? broadcast.expiresAt.toISOString() : null,
              targetCustomerId: broadcast.targetCustomerId || null,
            },
          }).returning();

          await db.insert(broadcastRecipientsTable).values({
            broadcastId: broadcast.id,
            userId: user.id,
            notificationId: notif.id,
            status: "DELIVERED",
          });
          deliveredCount++;
        } catch (err) {
          logger.warn({ err, userId: user.id, broadcastId }, "Failed delivering broadcast to recipient");
        }
      })
    );
  }

  await db.update(broadcastsTable)
    .set({
      status: "SENT",
      sentAt: new Date(),
      totalRecipients: deliveredCount,
      updatedAt: new Date(),
    })
    .where(eq(broadcastsTable.id, broadcast.id));

  return { success: true, deliveredCount };
}

export async function sweepExpiredBroadcasts(): Promise<number> {
  try {
    const expiredBroadcasts = await db.select().from(broadcastsTable)
      .where(and(
        or(eq(broadcastsTable.status, "SENT"), eq(broadcastsTable.status, "SCHEDULED")),
        isNotNull(broadcastsTable.expiresAt),
        sql`${broadcastsTable.expiresAt} <= NOW()`
      ));

    for (const b of expiredBroadcasts) {
      await db.update(broadcastsTable)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(eq(broadcastsTable.id, b.id));

      await db.insert(auditLogsTable).values({
        actorRole: "system",
        action: "BROADCAST_EXPIRED",
        resourceType: "broadcast",
        resourceId: b.id,
        previousValue: { status: b.status },
        newValue: { status: "EXPIRED" },
        metadata: {
          title: b.title,
          expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
          expiredAutomatically: true,
        },
      });
    }
    return expiredBroadcasts.length;
  } catch (err) {
    logger.warn({ err }, "Error sweeping expired broadcasts");
    return 0;
  }
}

export async function dispatchScheduledBroadcasts(): Promise<void> {
  try {
    const dueBroadcasts = await db.select().from(broadcastsTable)
      .where(and(
        eq(broadcastsTable.status, "SCHEDULED"),
        sql`${broadcastsTable.scheduledAt} <= NOW()`
      ));

    for (const b of dueBroadcasts) {
      await dispatchBroadcast(b.id);
    }
  } catch (err) {
    logger.warn({ err }, "Error checking scheduled broadcasts");
  }
}

// Background scheduler runner
if (process.env.NODE_ENV !== "test") {
  const broadcastTimer = setInterval(() => {
    void dispatchScheduledBroadcasts();
    void sweepExpiredBroadcasts();
  }, 30000);
  broadcastTimer.unref();
}

const createBroadcastSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  message: z.string().trim().min(5, "Message must be at least 5 characters.").max(4000),
  category: z.enum(["ANNOUNCEMENT", "OFFER", "ALERT", "UPDATE", "POLICY"]).default("ANNOUNCEMENT"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  imageUrl: z.string().trim().nullable().optional(),
  actionButton: z.string().trim().max(80).nullable().optional(),
  actionUrl: z.string().trim().max(500).nullable().optional(),
  targetAudience: z.enum(["ALL_CUSTOMERS", "SPECIFIC_USER", "SPECIFIC_CUSTOMER", "UPCOMING_TRIPS", "PAST_BOOKINGS", "PAYMENT_PENDING"]).default("ALL_CUSTOMERS"),
  targetUserId: z.string().trim().nullable().optional(),
  targetCustomerId: z.string().trim().nullable().optional(),
  scheduledAt: z.string().trim().nullable().optional(),
  expiresAt: z.string().trim().nullable().optional(),
  idempotencyKey: z.string().trim().nullable().optional(),
});

router.get("/admin/broadcasts", requireAdmin, async (req, res): Promise<void> => {
  try {
    // 1. Automatically sweep any expired broadcasts so state is server-authoritative
    await sweepExpiredBroadcasts();

    const showArchived = req.query.archived === "true";
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "ALL";
    const categoryFilter = typeof req.query.category === "string" ? req.query.category.trim().toUpperCase() : "ALL";
    const audienceFilter = typeof req.query.targetAudience === "string" ? req.query.targetAudience.trim().toUpperCase() : "ALL";
    const searchQuery = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const fromDate = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from) : null;
    const toDate = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to) : null;

    let queryConditions = [eq(broadcastsTable.isArchived, showArchived)];

    if (statusFilter !== "ALL") {
      if (statusFilter === "ACTIVE") {
        queryConditions.push(eq(broadcastsTable.status, "SENT"));
      } else {
        queryConditions.push(eq(broadcastsTable.status, statusFilter));
      }
    }

    if (categoryFilter !== "ALL") {
      queryConditions.push(eq(broadcastsTable.category, categoryFilter));
    }

    if (audienceFilter !== "ALL") {
      queryConditions.push(eq(broadcastsTable.targetAudience, audienceFilter));
    }

    if (fromDate && !isNaN(fromDate.getTime())) {
      queryConditions.push(gte(broadcastsTable.createdAt, fromDate));
    }

    if (toDate && !isNaN(toDate.getTime())) {
      queryConditions.push(lte(broadcastsTable.createdAt, toDate));
    }

    let broadcasts = await db
      .select()
      .from(broadcastsTable)
      .where(and(...queryConditions))
      .orderBy(desc(broadcastsTable.createdAt));

    if (searchQuery) {
      broadcasts = broadcasts.filter((b: any) =>
        b.title.toLowerCase().includes(searchQuery) ||
        b.message.toLowerCase().includes(searchQuery) ||
        (b.category || "").toLowerCase().includes(searchQuery) ||
        (b.targetCustomerId || "").toLowerCase().includes(searchQuery)
      );
    }

    // Compute real analytics from all active (non-archived) broadcasts
    const allActive = await db
      .select({
        totalRecipients: broadcastsTable.totalRecipients,
        readCount: broadcastsTable.readCount,
        clickCount: broadcastsTable.clickCount,
      })
      .from(broadcastsTable)
      .where(eq(broadcastsTable.isArchived, false));

    const totalBroadcasts = allActive.length;
    const totalDelivered = allActive.reduce((acc: number, b: any) => acc + (b.totalRecipients || 0), 0);
    const totalReads = allActive.reduce((acc: number, b: any) => acc + (b.readCount || 0), 0);
    const totalClicks = allActive.reduce((acc: number, b: any) => acc + (b.clickCount || 0), 0);

    res.json({
      broadcasts,
      stats: {
        totalBroadcasts,
        totalDelivered,
        totalReads,
        totalClicks,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch broadcasts");
    res.status(500).json({ status: "database_error", message: "Failed to fetch broadcasts." });
  }
});

router.get("/admin/broadcasts/validate-customer/:idOrCustomerId", requireAdmin, async (req, res): Promise<void> => {
  const input = String(req.params.idOrCustomerId || "").trim();
  if (!input) {
    res.status(400).json({ status: "invalid_request", message: "Customer ID is required." });
    return;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
    const cond = isUuid
      ? or(eq(usersTable.id, input), eq(usersTable.customerId, input), eq(usersTable.email, input.toLowerCase()))
      : or(eq(usersTable.customerId, input), eq(usersTable.email, input.toLowerCase()));

    const [u] = await db.select({
      id: usersTable.id,
      customerId: usersTable.customerId,
      fullName: usersTable.fullName,
      email: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(cond).limit(1);

    if (!u) {
      res.status(404).json({ status: "user_not_found", message: "Customer not found." });
      return;
    }

    res.json({
      status: "success",
      customer: {
        id: u.id,
        customerId: u.customerId || `ZLV-CUS-${u.id.substring(0, 6).toUpperCase()}`,
        fullName: u.fullName || u.email.split("@")[0],
        email: u.email,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to validate customer");
    res.status(500).json({ status: "database_error", message: "Failed to validate customer." });
  }
});

router.post("/admin/broadcasts", requireAdmin, async (req, res): Promise<void> => {
  const parsed = createBroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: parsed.error.issues[0]?.message || "Invalid broadcast parameters." });
    return;
  }

  const {
    title,
    message,
    category,
    priority,
    imageUrl,
    actionButton,
    actionUrl,
    targetAudience,
    targetUserId,
    targetCustomerId,
    scheduledAt,
    expiresAt,
  } = parsed.data;

  try {
    let resolvedTargetUserId: string | null = null;
    let resolvedTargetCustomerId: string | null = null;

    if (targetAudience === "SPECIFIC_USER" || targetAudience === "SPECIFIC_CUSTOMER") {
      const identifier = (targetCustomerId || targetUserId || "").trim();
      if (!identifier) {
        res.status(400).json({ status: "invalid_request", message: "Customer ID is required for targeted customer offer." });
        return;
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      const cond = isUuid
        ? or(eq(usersTable.id, identifier), eq(usersTable.customerId, identifier), eq(usersTable.email, identifier.toLowerCase()))
        : or(eq(usersTable.customerId, identifier), eq(usersTable.email, identifier.toLowerCase()));
      const [u] = await db.select({
        id: usersTable.id,
        customerId: usersTable.customerId,
        fullName: usersTable.fullName,
        email: usersTable.email,
      }).from(usersTable).where(cond).limit(1);

      if (!u) {
        res.status(404).json({ status: "user_not_found", message: "Customer not found." });
        return;
      }
      resolvedTargetUserId = u.id;
      resolvedTargetCustomerId = u.customerId || identifier;
    }

    // Expiry validation
    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt <= new Date()) {
        res.status(400).json({ status: "invalid_request", message: "Expiry date/time must be in the future." });
        return;
      }
      if (scheduledAt && parsedExpiresAt <= new Date(scheduledAt)) {
        res.status(400).json({ status: "invalid_request", message: "Expiry date/time must be after the scheduled dispatch time." });
        return;
      }
    }

    const isScheduled = Boolean(scheduledAt && new Date(scheduledAt) > new Date());
    const initialStatus = isScheduled ? "SCHEDULED" : "SENT";

    // Double-click idempotency guard: prevent creating identical broadcast within 4 seconds
    const fourSecondsAgo = new Date(Date.now() - 4000);
    const [recentDuplicate] = await db.select().from(broadcastsTable).where(and(
      eq(broadcastsTable.createdByAdminId, req.admin!.id),
      eq(broadcastsTable.title, title),
      gte(broadcastsTable.createdAt, fourSecondsAgo)
    )).limit(1);

    if (recentDuplicate) {
      res.status(200).json({ status: "success", broadcast: recentDuplicate, duplicatePrevented: true });
      return;
    }

    const [broadcast] = await db.insert(broadcastsTable).values({
      title,
      message,
      category,
      priority: priority || "NORMAL",
      imageUrl: imageUrl || null,
      actionButton: actionButton || null,
      actionUrl: actionUrl || null,
      targetAudience: (targetAudience === "SPECIFIC_CUSTOMER" ? "SPECIFIC_USER" : targetAudience),
      targetUserId: resolvedTargetUserId,
      targetCustomerId: resolvedTargetCustomerId,
      status: initialStatus,
      scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: parsedExpiresAt,
      createdByAdminId: req.admin!.id,
      isArchived: false,
    }).returning();

    if (!isScheduled) {
      const result = await dispatchBroadcast(broadcast.id);
      broadcast.totalRecipients = result.deliveredCount;
      broadcast.status = "SENT";
      broadcast.sentAt = new Date();
    } else {
      // Estimate target count for scheduled broadcast
      const potentialUsers = await getTargetUsersForBroadcast(broadcast.targetAudience, resolvedTargetUserId);
      await db.update(broadcastsTable).set({ totalRecipients: potentialUsers.length }).where(eq(broadcastsTable.id, broadcast.id));
      broadcast.totalRecipients = potentialUsers.length;
    }

    const auditAction = isScheduled
      ? "BROADCAST_SCHEDULED"
      : ((targetAudience === "SPECIFIC_USER" || targetAudience === "SPECIFIC_CUSTOMER")
          ? "BROADCAST_TARGETED_TO_CUSTOMER"
          : "BROADCAST_SENT");

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      action: auditAction,
      resourceType: "broadcast",
      resourceId: broadcast.id,
      newValue: {
        title,
        category,
        priority: priority || "NORMAL",
        targetAudience: broadcast.targetAudience,
        targetCustomerId: resolvedTargetCustomerId,
        totalRecipients: broadcast.totalRecipients,
        expiresAt: parsedExpiresAt?.toISOString() || null,
      },
      metadata: { title, category, targetAudience, totalRecipients: broadcast.totalRecipients },
    });

    res.status(201).json({ status: "success", broadcast });
  } catch (error) {
    logger.error({ err: error }, "Failed to create broadcast");
    res.status(500).json({ status: "database_error", message: "Failed to create broadcast." });
  }
});

router.post("/admin/broadcasts/:id/revoke", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
    if (!broadcast) {
      res.status(404).json({ status: "not_found", message: "Broadcast not found." });
      return;
    }

    // Double-click safety: if already revoked, return gracefully
    if (broadcast.status === "REVOKED") {
      res.json({ status: "success", message: "Broadcast is already revoked.", broadcast });
      return;
    }

    if (broadcast.status === "CANCELLED" || broadcast.status === "DRAFT") {
      res.status(400).json({ status: "invalid_status", message: `Cannot revoke broadcast in ${broadcast.status} status.` });
      return;
    }

    const previousStatus = broadcast.status;
    const now = new Date();

    const [updated] = await db.update(broadcastsTable)
      .set({
        status: "REVOKED",
        revokedAt: now,
        revokedByAdminId: req.admin!.id,
        updatedAt: now,
      })
      .where(eq(broadcastsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      action: "BROADCAST_REVOKED",
      resourceType: "broadcast",
      resourceId: id,
      previousValue: { status: previousStatus },
      newValue: { status: "REVOKED", revokedAt: now.toISOString() },
      metadata: {
        title: broadcast.title,
        previousStatus,
        newStatus: "REVOKED",
        adminId: req.admin!.id,
      },
    });

    res.json({ status: "success", message: "Broadcast revoked successfully.", broadcast: updated });
  } catch (error) {
    logger.error({ err: error }, "Failed to revoke broadcast");
    res.status(500).json({ status: "database_error", message: "Failed to revoke broadcast." });
  }
});

router.post("/admin/broadcasts/:id/archive", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
    if (!broadcast) {
      res.status(404).json({ status: "not_found", message: "Broadcast not found." });
      return;
    }

    // Double-click safety
    if (broadcast.isArchived) {
      res.json({ status: "success", message: "Broadcast is already archived.", broadcast });
      return;
    }

    const now = new Date();

    const [updated] = await db.update(broadcastsTable)
      .set({
        isArchived: true,
        archivedAt: now,
        archivedByAdminId: req.admin!.id,
        updatedAt: now,
      })
      .where(eq(broadcastsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      action: "BROADCAST_ARCHIVED",
      resourceType: "broadcast",
      resourceId: id,
      previousValue: { isArchived: false },
      newValue: { isArchived: true, archivedAt: now.toISOString() },
      metadata: {
        title: broadcast.title,
        status: broadcast.status,
      },
    });

    res.json({ status: "success", message: "Broadcast removed from history (archived).", broadcast: updated });
  } catch (error) {
    logger.error({ err: error }, "Failed to archive broadcast");
    res.status(500).json({ status: "database_error", message: "Failed to archive broadcast." });
  }
});

router.post("/admin/broadcasts/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
    if (!broadcast) {
      res.status(404).json({ status: "not_found", message: "Broadcast not found." });
      return;
    }

    if (!broadcast.isArchived) {
      res.json({ status: "success", message: "Broadcast is not archived.", broadcast });
      return;
    }

    const now = new Date();

    // Restoring respects lifecycle status (e.g. EXPIRED stays EXPIRED, REVOKED stays REVOKED)
    const [updated] = await db.update(broadcastsTable)
      .set({
        isArchived: false,
        archivedAt: null,
        archivedByAdminId: null,
        updatedAt: now,
      })
      .where(eq(broadcastsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      action: "BROADCAST_RESTORED",
      resourceType: "broadcast",
      resourceId: id,
      previousValue: { isArchived: true },
      newValue: { isArchived: false },
      metadata: {
        title: broadcast.title,
        status: broadcast.status,
      },
    });

    res.json({ status: "success", message: "Broadcast restored to history.", broadcast: updated });
  } catch (error) {
    logger.error({ err: error }, "Failed to restore broadcast");
    res.status(500).json({ status: "database_error", message: "Failed to restore broadcast." });
  }
});

router.post("/admin/broadcasts/:id/cancel", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
    if (!broadcast) {
      res.status(404).json({ status: "not_found", message: "Broadcast not found." });
      return;
    }

    if (broadcast.status !== "SCHEDULED") {
      res.status(400).json({ status: "invalid_status", message: `Cannot cancel broadcast in ${broadcast.status} status.` });
      return;
    }

    const [updated] = await db.update(broadcastsTable)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(broadcastsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      action: "BROADCAST_CANCELLED",
      resourceType: "broadcast",
      resourceId: id,
      metadata: { title: broadcast.title },
    });

    res.json({ status: "success", broadcast: updated });
  } catch (error) {
    logger.error({ err: error }, "Failed to cancel broadcast");
    res.status(500).json({ status: "database_error", message: "Failed to cancel broadcast." });
  }
});

router.get("/admin/broadcasts/:id/recipients", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
    if (!broadcast) {
      res.status(404).json({ status: "not_found", message: "Broadcast not found." });
      return;
    }

    const recipientsRaw = await db
      .select({
        recipient: broadcastRecipientsTable,
        user: usersTable,
      })
      .from(broadcastRecipientsTable)
      .innerJoin(usersTable, eq(broadcastRecipientsTable.userId, usersTable.id))
      .where(eq(broadcastRecipientsTable.broadcastId, id));

    const recipients = recipientsRaw.map(
      ({
        recipient,
        user,
      }: {
        recipient: typeof broadcastRecipientsTable.$inferSelect;
        user: typeof usersTable.$inferSelect;
      }) => ({
        id: recipient.id,
        userId: user.id,
        customerId: user.customerId || `ZLV-CUS-${user.id.substring(0, 6).toUpperCase()}`,
        fullName: user.fullName || user.email.split("@")[0],
        email: user.email,
        status: recipient.status,
        readAt: recipient.readAt,
        clickedAt: recipient.clickedAt,
        createdAt: recipient.createdAt,
      })
    );

    res.json({ broadcast, recipients });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch broadcast recipients");
    res.status(500).json({ status: "database_error", message: "Failed to load recipients." });
  }
});

// --------------------------------------------------------------------------
// 7. User Information Search & Complete Customer Dossier (Admin)
// --------------------------------------------------------------------------

router.get("/admin/users/search", requireAdmin, async (req, res): Promise<void> => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
  try {
    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const allBookings = await db.select().from(bookingsTable);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (statusFilter === "archived") {
      users = users.filter((u: any) => u.isArchived || u.status === "archived");
    } else if (statusFilter === "active") {
      users = users.filter((u: any) => !u.isArchived && u.status === "active");
    } else if (statusFilter === "suspended") {
      users = users.filter((u: any) => !u.isArchived && u.status === "suspended");
    } else if (statusFilter === "new") {
      users = users.filter((u: any) => !u.isArchived && u.status !== "archived" && new Date(u.createdAt) >= sevenDaysAgo);
    } else if (statusFilter === "all_with_archived") {
      // Keep all
    } else {
      // Default: exclude archived from general active customer searches
      users = users.filter((u: any) => !u.isArchived && u.status !== "archived");
    }

    let bookingOwnerIds = new Set<string>();
    if (query) {
      const matchedBookings = allBookings.filter((b: any) =>
        (b.bookingReference || "").toLowerCase().includes(query) ||
        (b.pnr || "").toLowerCase().includes(query) ||
        (b.id || "").toLowerCase().includes(query)
      );
      for (const mb of matchedBookings) {
        if (mb.ownerId) bookingOwnerIds.add(mb.ownerId);
        if (mb.customerId) bookingOwnerIds.add(mb.customerId);
      }
    }

    if (query) {
      users = users.filter((u: any) => {
        const idMatch = (u.customerId || "").toLowerCase().includes(query) || (u.id || "").toLowerCase().includes(query);
        const nameMatch = (u.fullName || "").toLowerCase().includes(query);
        const emailMatch = (u.email || "").toLowerCase().includes(query);
        const phoneMatch = (u.phone || "").toLowerCase().includes(query);
        const bookingMatch = bookingOwnerIds.has(u.id);
        return idMatch || nameMatch || emailMatch || phoneMatch || bookingMatch;
      });
    }

    const results = users.map((u: any) => {
      const userBookings = allBookings.filter((b: any) => b.ownerId === u.id || b.customerId === u.id);
      const totalSpend = userBookings
        .filter((b: any) => b.status === "CONFIRMED" || b.paymentStatus === "PAID")
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const isArchived = Boolean(u.isArchived || u.status === "archived");
      const isNew = !isArchived && new Date(u.createdAt) >= sevenDaysAgo;

      return {
        id: u.id,
        customerId: u.customerId || `ZLV-CUS-${u.id.substring(0, 6).toUpperCase()}`,
        fullName: u.fullName || u.email.split("@")[0],
        email: u.email,
        phone: u.phone ?? null,
        status: isArchived ? "archived" : (u.status ?? "active"),
        isArchived,
        archivedAt: u.archivedAt ?? null,
        archiveReason: u.archiveReason ?? null,
        archiveNote: u.archiveNote ?? null,
        role: u.role,
        isNew,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
        bookingCount: userBookings.length,
        totalSpend,
      };
    });

    res.json({ users: results });
  } catch (error) {
    logger.error({ err: error }, "Failed to search users");
    res.status(500).json({ status: "database_error", message: "Failed to search users." });
  }
});

router.get("/admin/users/:userId/dossier", requireAdmin, async (req, res): Promise<void> => {
  const userIdParam = String(req.params.userId).trim();
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdParam);
    const cond = isUuid
      ? or(eq(usersTable.id, userIdParam), eq(usersTable.customerId, userIdParam))
      : eq(usersTable.customerId, userIdParam);

    const [user] = await db.select().from(usersTable).where(cond).limit(1);
    if (!user) {
      res.status(404).json({ status: "not_found", message: "Customer profile not found." });
      return;
    }

    const [
      bookings,
      transactions,
      userPayments,
      supportTickets,
      notifications,
      auditLogs,
      refunds,
    ] = await Promise.all([
      db.select().from(bookingsTable).where(or(eq(bookingsTable.ownerId, user.id), eq(bookingsTable.customerId, user.id))).orderBy(desc(bookingsTable.createdAt)),
      db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.userId, user.id)).orderBy(desc(paymentTransactionsTable.createdAt)),
      db.select().from(paymentsTable).where(eq(paymentsTable.userId, user.id)).orderBy(desc(paymentsTable.createdAt)),
      db.select().from(supportTicketsTable).where(or(eq(supportTicketsTable.userId, user.id), eq(supportTicketsTable.email, user.email.toLowerCase()))).orderBy(desc(supportTicketsTable.createdAt)),
      db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.id)).orderBy(desc(notificationsTable.createdAt)),
      db.select().from(auditLogsTable).where(or(eq(auditLogsTable.actorUserId, user.id), eq(auditLogsTable.resourceId, user.id))).orderBy(desc(auditLogsTable.createdAt)).limit(100),
      db.select().from(refundsTable).where(eq(refundsTable.requestedByUserId, user.id)).orderBy(desc(refundsTable.createdAt)),
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isNew = new Date(user.createdAt) >= sevenDaysAgo;

    const confirmedBookings = bookings.filter((b: any) => b.status === "CONFIRMED" || b.paymentStatus === "PAID");
    const totalSpend = confirmedBookings.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    const pendingPaymentsCount = bookings.filter((b: any) => b.paymentStatus === "PENDING" || b.status === "PAYMENT_PENDING").length;
    const openTicketsCount = supportTickets.filter((t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

    // Real activity timeline (NO fake historical events)
    const timelineEvents: Array<{
      id: string;
      eventType: string;
      title: string;
      description: string;
      timestamp: Date;
      badgeColor?: string;
      metadata?: any;
    }> = [];

    // Account registration
    timelineEvents.push({
      id: `acc-created-${user.id}`,
      eventType: "ACCOUNT_CREATED",
      title: "Account Registered",
      description: `Customer account registered with User ID ${user.customerId || "ZLV-CUS-NEW"} (${user.authProvider}).`,
      timestamp: new Date(user.createdAt),
      badgeColor: "blue",
    });

    // Last login
    if (user.lastLoginAt) {
      timelineEvents.push({
        id: `login-${user.id}-${new Date(user.lastLoginAt).getTime()}`,
        eventType: "USER_LOGIN",
        title: "Customer Login",
        description: `Logged in to Zelevos account.`,
        timestamp: new Date(user.lastLoginAt),
        badgeColor: "emerald",
      });
    }

    // Bookings
    for (const b of bookings) {
      timelineEvents.push({
        id: `bkg-${b.id}`,
        eventType: "BOOKING_CREATED",
        title: `Trip Booked: ${b.bookingReference || "Reference Pending"}`,
        description: `Booked trip for ${b.travelDate || "Date TBD"} (Amount: ₹${(b.amount || 0).toLocaleString("en-IN")}, Status: ${b.status}).`,
        timestamp: new Date(b.createdAt),
        badgeColor: "indigo",
        metadata: { bookingId: b.id, amount: b.amount, status: b.status },
      });
    }

    // Payment transactions
    for (const tx of transactions) {
      timelineEvents.push({
        id: `tx-${tx.id}`,
        eventType: "PAYMENT_TRANSACTION",
        title: `Payment ${tx.status}: ₹${(tx.amount || 0).toLocaleString("en-IN")}`,
        description: `Payment via ${tx.provider} (Order: ${tx.providerOrderId || "—"}, Status: ${tx.status}).`,
        timestamp: new Date(tx.createdAt),
        badgeColor: tx.status === "CAPTURED" || tx.status === "SUCCESS" ? "green" : "amber",
        metadata: { transactionId: tx.id, providerOrderId: tx.providerOrderId },
      });
    }

    // Support tickets
    for (const t of supportTickets) {
      timelineEvents.push({
        id: `tkt-${t.id}`,
        eventType: "SUPPORT_TICKET",
        title: `Support Ticket: ${t.ticketNumber} [${t.priority}]`,
        description: `Opened support ticket "${t.subject}" (Status: ${t.status}).`,
        timestamp: new Date(t.createdAt),
        badgeColor: "rose",
        metadata: { ticketNumber: t.ticketNumber, status: t.status },
      });
    }

    // Notifications delivered
    for (const n of notifications) {
      timelineEvents.push({
        id: `notif-${n.id}`,
        eventType: "NOTIFICATION_RECEIVED",
        title: `Received: ${n.title}`,
        description: `${n.body.substring(0, 120)}${n.body.length > 120 ? "..." : ""}`,
        timestamp: new Date(n.createdAt),
        badgeColor: "purple",
        metadata: { category: n.category, read: Boolean(n.readAt) },
      });
    }

    let archivedByName: string | null = null;
    if (user.archivedBy) {
      const [adminUser] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, user.archivedBy)).limit(1);
      if (adminUser) archivedByName = adminUser.adminId;
    }

    if (user.archivedAt) {
      timelineEvents.push({
        id: `archive-${user.id}-${new Date(user.archivedAt).getTime()}`,
        eventType: "CUSTOMER_ARCHIVED",
        title: "Customer Account Archived",
        description: `Customer account was archived by ${archivedByName || "Administrator"}. Reason: ${user.archiveReason || "Not specified"}${user.archiveNote ? ` (Admin Note: ${user.archiveNote})` : ""}. All historical bookings, payments, and tickets remain fully preserved.`,
        timestamp: new Date(user.archivedAt),
        badgeColor: "rose",
        metadata: { reason: user.archiveReason, note: user.archiveNote, archivedBy: user.archivedBy },
      });
    }

    // Sort timeline chronologically DESC
    timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Generate formatted invoices
    const invoices = bookings.map((b: any) => ({
      invoiceNumber: `INV-${(b.bookingReference || b.id.substring(0, 8)).toUpperCase()}`,
      bookingId: b.id,
      bookingReference: b.bookingReference,
      amount: b.amount,
      status: b.paymentStatus === "PAID" || b.status === "CONFIRMED" ? "PAID" : "PENDING",
      date: b.createdAt,
      downloadUrl: `/api/bookings/${b.id}/invoice`,
    }));

    res.json({
      user: {
        ...publicUser(user),
        isNew,
        archivedByName,
      },
      stats: {
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings.length,
        totalSpend,
        pendingPayments: pendingPaymentsCount,
        openTickets: openTicketsCount,
        notificationsCount: notifications.length,
      },
      bookings,
      payments: transactions.length > 0 ? transactions : userPayments,
      invoices,
      refunds,
      supportTickets,
      notifications,
      activityTimeline: timelineEvents,
      auditTrail: auditLogs,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch user dossier");
    res.status(500).json({ status: "database_error", message: "Failed to load customer dossier." });
  }
});

// --------------------------------------------------------------------------
// 8. Vendor Search & Vendor Dossier (Admin)
// --------------------------------------------------------------------------

router.get("/admin/vendors/search", requireAdmin, async (req, res): Promise<void> => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  try {
    let vendors = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt));
    if (query) {
      vendors = vendors.filter((v: any) => {
        const idMatch = (v.vendorId || "").toLowerCase().includes(query);
        const nameMatch = (v.businessName || "").toLowerCase().includes(query);
        const contactMatch = (v.contactName || "").toLowerCase().includes(query);
        const emailMatch = (v.email || "").toLowerCase().includes(query);
        const phoneMatch = (v.phone || "").toLowerCase().includes(query);
        return idMatch || nameMatch || contactMatch || emailMatch || phoneMatch;
      });
    }
    res.json({ vendors });
  } catch (error) {
    logger.error({ err: error }, "Failed to search vendors");
    res.status(500).json({ status: "database_error", message: "Failed to search vendors." });
  }
});

router.get("/admin/vendors/:vendorId/dossier", requireAdmin, async (req, res): Promise<void> => {
  const vendorIdParam = String(req.params.vendorId).trim();
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorIdParam);
    const cond = isUuid
      ? or(eq(vendorsTable.id, vendorIdParam), eq(vendorsTable.vendorId, vendorIdParam))
      : eq(vendorsTable.vendorId, vendorIdParam);

    const [vendor] = await db.select().from(vendorsTable).where(cond).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Vendor not found." });
      return;
    }

    const [services, documents, invoices, auditLogs] = await Promise.all([
      db.select().from(vendorServicesTable).where(eq(vendorServicesTable.vendorId, vendor.id)),
      db.select().from(vendorDocumentsTable).where(eq(vendorDocumentsTable.vendorId, vendor.id)),
      db.select().from(vendorInvoicesTable).where(eq(vendorInvoicesTable.vendorId, vendor.id)),
      db.select().from(auditLogsTable).where(eq(auditLogsTable.resourceId, vendor.id)).orderBy(desc(auditLogsTable.createdAt)).limit(50),
    ]);

    res.json({
      vendor,
      services,
      documents,
      invoices,
      auditLogs,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch vendor dossier");
    res.status(500).json({ status: "database_error", message: "Failed to load vendor dossier." });
  }
});

export default router;
