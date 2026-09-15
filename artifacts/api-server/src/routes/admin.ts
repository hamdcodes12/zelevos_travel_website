import { Router, type IRouter } from "express";
import { eq, desc, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  usersTable,
  bookingsTable,
  adminUsersTable,
  auditLogsTable,
  paymentTransactionsTable,
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

const router: IRouter = Router();

const adminLoginSchema = z.object({
  adminId: z.string().trim().min(1, "Admin ID is required.").max(100),
  password: z.string().min(1, "Password is required.").max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long.").max(128),
  confirmNewPassword: z.string().min(8).max(128).optional(),
});

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
    req.log.error({ err: error }, "Failed to authenticate admin");
    res.status(500).json({ status: "database_error", message: "Admin login could not be completed." });
  }
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  try {
    await destroyAdminSession(req, res);
    res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Failed to log out admin");
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

    // 2. Bookings metrics - include ALL kinds
    const allBookings = await db.select().from(bookingsTable);
    const totalFlightBookings = allBookings.length; // renamed to totalBookings in response
    const confirmedBookings = allBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "CONFIRMED").length;
    const cancelledBookings = allBookings.filter((b: typeof bookingsTable.$inferSelect) => b.status === "CANCELLED").length;

    const totalPaymentAmount = allBookings
      .filter((b: typeof bookingsTable.$inferSelect) => b.status === "CONFIRMED" || b.paymentStatus === "PAID" || b.paymentStatus === "CAPTURED" || b.paymentStatus === "PAYMENT_CONFIRMED")
      .reduce((acc: number, b: typeof bookingsTable.$inferSelect) => acc + (b.amount || 0), 0);

    const refundAmount = allBookings
      .filter((b: typeof bookingsTable.$inferSelect) => b.status === "CANCELLED")
      .reduce((acc: number, b: typeof bookingsTable.$inferSelect) => acc + (b.refundAmount || 0), 0);

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
      const origin = segments[0]?.origin || "DEL";
      const dest = segments[segments.length - 1]?.destination || "BOM";
      const airline = segments[0]?.airline || "Airline";
      const flightNumber = segments[0]?.flightNumber || "";
      const departureTime = segments[0]?.departureTime || booking.createdAt;

      return {
        id: booking.id,
        bookingReference: booking.bookingReference,
        pnr: booking.pnr ?? "Pending",
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
        totalBookings: totalFlightBookings,
        totalFlightBookings,
        confirmedBookings,
        cancelledBookings,
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
        cancellationDetails: b.cancellationDetails ?? null,
        refundAmount: b.refundAmount ?? null,
        emailStatus: b.emailStatus,
        createdAt: b.createdAt,
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
        const pnrMatch = b.pnr.toLowerCase().includes(search);
        const refMatch = b.bookingReference.toLowerCase().includes(search);
        const nameMatch = b.customer.fullName.toLowerCase().includes(search);
        const emailMatch = b.customer.email.toLowerCase().includes(search);
        const flightMatch = b.flight.toLowerCase().includes(search);
        const routeMatch = b.route.toLowerCase().includes(search);
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
        ...booking,
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
        status: transaction.status,
        refundStatus: isRefunded ? "REFUNDED" : "NONE",
        refundAmount: transaction.refundAmount,
        createdAt: transaction.createdAt,
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

export default router;
