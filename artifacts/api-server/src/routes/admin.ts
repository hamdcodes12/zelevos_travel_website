import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { eq, desc, or, sql, and, inArray } from "drizzle-orm";
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
  refundsTable,
  paymentsTable,
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
      res.status(401).json({ status: "invalid_credentials", message: "Invalid Admin ID or password." });
      return;
    }

    if (!verifyPassword(password, admin.passwordHash)) {
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
    try {
      const tickets = await db.select().from(supportTicketsTable);
      openSupportTickets = tickets.filter((t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "PENDING").length;
    } catch {}

    let unreadNotifications = 0;
    try {
      const notifs = await db.select().from(notificationsTable);
      unreadNotifications = notifs.filter((n: any) => !n.readAt).length;
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
// 3. Customers Management (List, Search, Filter, Details)
// --------------------------------------------------------------------------

router.get("/admin/customers", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";

  try {
    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const allBookings = await db.select().from(bookingsTable);

    if (statusFilter && statusFilter !== "all") {
      users = users.filter((u: typeof usersTable.$inferSelect) => u.status === statusFilter);
    }

    if (search) {
      users = users.filter((u: typeof usersTable.$inferSelect) => {
        const idMatch = u.customerId?.toLowerCase().includes(search);
        const nameMatch = u.fullName?.toLowerCase().includes(search);
        const emailMatch = u.email.toLowerCase().includes(search);
        const phoneMatch = u.phone?.toLowerCase().includes(search);
        return Boolean(idMatch || nameMatch || emailMatch || phoneMatch);
      });
    }

    const customers = users.map((u: typeof usersTable.$inferSelect) => {
      const userBookings = allBookings.filter((b: typeof bookingsTable.$inferSelect) => b.ownerId === u.id);
      const totalBookingValue = userBookings
        .filter((b: typeof bookingsTable.$inferSelect) => b.status === "CONFIRMED" || b.paymentStatus === "PAID")
        .reduce((sum: number, b: typeof bookingsTable.$inferSelect) => sum + (b.amount || 0), 0);

      return {
        id: u.id,
        customerId: u.customerId ?? `CUST-${u.id.substring(0, 8).toUpperCase()}`,
        fullName: u.fullName || u.email.split("@")[0],
        email: u.email,
        phone: u.phone ?? null,
        authProvider: u.authProvider,
        status: u.status ?? "active",
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

    const customerBookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.ownerId, user.id))
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
      customer: publicUser(user),
      bookings: formattedBookings,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch customer details");
    res.status(500).json({ status: "database_error", message: "Failed to load customer details." });
  }
});

// --------------------------------------------------------------------------
// 4. Bookings Management (All bookings across platform, search, filter, details)
// --------------------------------------------------------------------------

router.get("/admin/bookings", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";

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

    if (statusFilter && statusFilter !== "ALL") {
      items = items.filter((b: (typeof items)[number]) => b.status === statusFilter);
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

// --------------------------------------------------------------------------
// 5. Payments Audit (Order IDs, amounts, statuses, refund statuses, dates)
// --------------------------------------------------------------------------

router.get("/admin/payments", requireAdmin, async (req, res): Promise<void> => {
  try {
    const raw: Array<{ transaction: typeof paymentTransactionsTable.$inferSelect; booking: typeof bookingsTable.$inferSelect | null; user: typeof usersTable.$inferSelect }> = await db
      .select({ transaction: paymentTransactionsTable, booking: bookingsTable, user: usersTable })
      .from(paymentTransactionsTable)
      .innerJoin(usersTable, eq(paymentTransactionsTable.userId, usersTable.id))
      .leftJoin(bookingsTable, eq(paymentTransactionsTable.bookingId, bookingsTable.id))
      .orderBy(desc(paymentTransactionsTable.createdAt));

    const payments = raw.map(({ transaction, booking, user }) => {
      const isRefunded = transaction.refundStatus !== "NONE" || transaction.refundAmount > 0;

      return {
        id: transaction.id,
        provider: transaction.provider,
        paymentOrderId: transaction.providerOrderId ?? null,
        paymentId: transaction.providerPaymentId ?? null,
        bookingId: transaction.bookingId ?? "",
        bookingReference: booking?.bookingReference ?? "Pending",
        pnr: booking?.pnr ?? "Pending",
        customer: {
          fullName: user.fullName || user.email.split("@")[0],
          email: user.email,
          customerId: user.customerId ?? null,
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
  if (targetAudience === "SPECIFIC_USER" && targetUserId) {
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

  // ALL_CUSTOMERS default
  return db.select().from(usersTable).where(eq(usersTable.role, "customer"));
}

export async function dispatchBroadcast(broadcastId: string): Promise<{ success: boolean; deliveredCount: number }> {
  const [broadcast] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, broadcastId)).limit(1);
  if (!broadcast || broadcast.status === "CANCELLED" || broadcast.status === "EXPIRED") {
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
            metadata: { broadcastId: broadcast.id, category: broadcast.category },
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
setInterval(() => {
  void dispatchScheduledBroadcasts();
}, 30000);

const createBroadcastSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  message: z.string().trim().min(5, "Message must be at least 5 characters.").max(4000),
  category: z.enum(["ANNOUNCEMENT", "OFFER", "ALERT", "UPDATE", "POLICY"]).default("ANNOUNCEMENT"),
  imageUrl: z.string().trim().optional(),
  actionButton: z.string().trim().max(80).optional(),
  actionUrl: z.string().trim().max(500).optional(),
  targetAudience: z.enum(["ALL_CUSTOMERS", "SPECIFIC_USER", "UPCOMING_TRIPS", "PAST_BOOKINGS", "PAYMENT_PENDING"]).default("ALL_CUSTOMERS"),
  targetUserId: z.string().trim().optional(),
  scheduledAt: z.string().trim().optional(),
});

router.get("/admin/broadcasts", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const broadcasts = await db.select().from(broadcastsTable).orderBy(desc(broadcastsTable.createdAt));
    res.json({ broadcasts });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch broadcasts");
    res.status(500).json({ status: "database_error", message: "Failed to fetch broadcasts." });
  }
});

router.post("/admin/broadcasts", requireAdmin, async (req, res): Promise<void> => {
  const parsed = createBroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: parsed.error.issues[0]?.message || "Invalid broadcast parameters." });
    return;
  }

  const { title, message, category, imageUrl, actionButton, actionUrl, targetAudience, targetUserId, scheduledAt } = parsed.data;

  try {
    let resolvedTargetUserId: string | null = null;
    if (targetAudience === "SPECIFIC_USER" && targetUserId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
      const cond = isUuid
        ? or(eq(usersTable.id, targetUserId), eq(usersTable.customerId, targetUserId), eq(usersTable.email, targetUserId.toLowerCase()))
        : or(eq(usersTable.customerId, targetUserId), eq(usersTable.email, targetUserId.toLowerCase()));
      const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(cond).limit(1);
      if (!u) {
        res.status(404).json({ status: "user_not_found", message: `Target customer "${targetUserId}" could not be found.` });
        return;
      }
      resolvedTargetUserId = u.id;
    }

    const isScheduled = Boolean(scheduledAt && new Date(scheduledAt) > new Date());
    const initialStatus = isScheduled ? "SCHEDULED" : "SENT";

    const [broadcast] = await db.insert(broadcastsTable).values({
      title,
      message,
      category,
      imageUrl: imageUrl || null,
      actionButton: actionButton || null,
      actionUrl: actionUrl || null,
      targetAudience,
      targetUserId: resolvedTargetUserId,
      status: initialStatus,
      scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt) : null,
      createdByAdminId: req.admin!.id,
    }).returning();

    if (!isScheduled) {
      const result = await dispatchBroadcast(broadcast.id);
      broadcast.totalRecipients = result.deliveredCount;
      broadcast.status = "SENT";
      broadcast.sentAt = new Date();
    } else {
      // Estimate target count for scheduled broadcast
      const potentialUsers = await getTargetUsersForBroadcast(targetAudience, resolvedTargetUserId);
      await db.update(broadcastsTable).set({ totalRecipients: potentialUsers.length }).where(eq(broadcastsTable.id, broadcast.id));
      broadcast.totalRecipients = potentialUsers.length;
    }

    await db.insert(auditLogsTable).values({
      actorAdminId: req.admin!.id,
      action: isScheduled ? "BROADCAST_SCHEDULED" : "BROADCAST_SENT",
      resourceType: "broadcast",
      resourceId: broadcast.id,
      metadata: { title, category, targetAudience, totalRecipients: broadcast.totalRecipients },
    });

    res.status(201).json({ status: "success", broadcast });
  } catch (error) {
    logger.error({ err: error }, "Failed to create broadcast");
    res.status(500).json({ status: "database_error", message: "Failed to create broadcast." });
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
    const recipientsRaw: Array<{ recipient: typeof broadcastRecipientsTable.$inferSelect; user: typeof usersTable.$inferSelect }> = await db
      .select({
        recipient: broadcastRecipientsTable,
        user: usersTable,
      })
      .from(broadcastRecipientsTable)
      .innerJoin(usersTable, eq(broadcastRecipientsTable.userId, usersTable.id))
      .where(eq(broadcastRecipientsTable.broadcastId, id));

    const recipients = recipientsRaw.map(({ recipient, user }) => ({
      id: recipient.id,
      userId: user.id,
      customerId: user.customerId || `ZLV-CUS-${user.id.substring(0, 6).toUpperCase()}`,
      fullName: user.fullName || user.email.split("@")[0],
      email: user.email,
      status: recipient.status,
      readAt: recipient.readAt,
      clickedAt: recipient.clickedAt,
      createdAt: recipient.createdAt,
    }));

    res.json({ recipients });
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
  try {
    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const allBookings = await db.select().from(bookingsTable);

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
        const idMatch = (u.customerId || "").toLowerCase().includes(query);
        const nameMatch = (u.fullName || "").toLowerCase().includes(query);
        const emailMatch = (u.email || "").toLowerCase().includes(query);
        const phoneMatch = (u.phone || "").toLowerCase().includes(query);
        const bookingMatch = bookingOwnerIds.has(u.id);
        return idMatch || nameMatch || emailMatch || phoneMatch || bookingMatch;
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const results = users.map((u: any) => {
      const userBookings = allBookings.filter((b: any) => b.ownerId === u.id || b.customerId === u.id);
      const totalSpend = userBookings
        .filter((b: any) => b.status === "CONFIRMED" || b.paymentStatus === "PAID")
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const isNew = new Date(u.createdAt) >= sevenDaysAgo;

      return {
        id: u.id,
        customerId: u.customerId || `ZLV-CUS-${u.id.substring(0, 6).toUpperCase()}`,
        fullName: u.fullName || u.email.split("@")[0],
        email: u.email,
        phone: u.phone ?? null,
        status: u.status ?? "active",
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
