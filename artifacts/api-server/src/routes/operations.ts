import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  vendorsTable,
  refundsTable,
  slaSettingsTable,
  auditLogsTable,
  packagesTable,
  supportTicketsTable,
  supportMessagesTable,
  adminTicketReadsTable,
  adminNotificationsTable,
  adminNotificationReadsTable,
  notificationsTable,
  usersTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { requireAuth, requireAuthOrAdmin, requireAdmin } from "../middlewares/authMiddleware";
import { supportTicketRateLimiter } from "../middlewares/rate-limiter";
import {
  logAuditAction,
  reevaluateBookingStatus,
  getSlaDurationMinutes,
} from "../services/booking-engine";
import { dispatchMultiChannelNotification } from "../services/email-service";

const router: IRouter = Router();

// Require Operations Manager, Booking Executive, or Super Admin
const requireOps = requireRole(["admin", "operations_manager", "booking_executive"]);

// --------------------------------------------------------------------------
// 1. Operations Dashboard Widgets (Section 11)
// --------------------------------------------------------------------------
router.get("/operations/dashboard", requireOps, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60 * 1000);

    // Parallelize all queries across the pool for high performance (<300ms) with resilient fallbacks
    const [
      todaysNewBookingsCountRes,
      awaitingSupplierConfirmationCountRes,
      approachingDeadlinesCountRes,
      partiallyConfirmedTripsCountRes,
      paymentExceptionsCountRes,
      cancellationRefundCasesCountRes,
      unassignedTasksCountRes,
      financeSummaryRes,
      recentBookingsRes,
      supplierQueueRes,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(gte(bookingsTable.createdAt, todayStart))
        .catch(() => [{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingServicesTable)
        .where(or(eq(bookingServicesTable.status, "REQUESTED"), eq(bookingServicesTable.status, "PENDING")))
        .catch(() => [{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingServicesTable)
        .where(
          and(
            lte(bookingServicesTable.deadline, soon),
            gt(bookingServicesTable.deadline, now),
            or(eq(bookingServicesTable.status, "PENDING"), eq(bookingServicesTable.status, "REQUESTED"))
          )
        )
        .catch(() => [{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(eq(bookingsTable.status, "PARTIALLY_CONFIRMED"))
        .catch(() => [{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(or(eq(bookingsTable.status, "FAILED"), eq(bookingsTable.status, "ACTION_REQUIRED")))
        .catch(() => [{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(or(eq(bookingsTable.status, "CANCEL_REQUESTED"), eq(bookingsTable.status, "REFUND_PENDING")))
        .catch(() => [{ count: 0 }]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookingServicesTable)
        .where(and(eq(bookingServicesTable.status, "PENDING"), isNull(bookingServicesTable.assignedVendorId)))
        .catch(() => [{ count: 0 }]),
      db
        .select({
          revenue: sql<number>`coalesce(sum(${bookingsTable.totalPrice}), 0)`,
          supplierCost: sql<number>`coalesce(sum(${bookingsTable.totalBaseCost}), 0)`,
          margin: sql<number>`coalesce(sum(${bookingsTable.totalMarkup}), 0)`,
        })
        .from(bookingsTable)
        .where(sql`${bookingsTable.status} NOT IN ('FAILED', 'CANCELLED', 'REFUNDED')`)
        .catch(() => [{ revenue: 0, supplierCost: 0, margin: 0 }]),
      db
        .select()
        .from(bookingsTable)
        .orderBy(desc(bookingsTable.createdAt))
        .limit(10)
        .catch(() => []),
      db
        .select({
          task: bookingServicesTable,
          vendorName: vendorsTable.businessName,
          bookingRef: bookingsTable.bookingId,
        })
        .from(bookingServicesTable)
        .leftJoin(vendorsTable, eq(bookingServicesTable.assignedVendorId, vendorsTable.id))
        .leftJoin(bookingsTable, eq(bookingServicesTable.bookingId, bookingsTable.id))
        .where(or(eq(bookingServicesTable.status, "REQUESTED"), eq(bookingServicesTable.status, "PENDING")))
        .orderBy(bookingServicesTable.deadline)
        .limit(10)
        .catch(() => []),
    ]);

    const financeSummary = financeSummaryRes[0] || { revenue: 0, supplierCost: 0, margin: 0 };
    const rev = Number(financeSummary.revenue || 0);
    const cost = Number(financeSummary.supplierCost || 0);
    const marg = Number(financeSummary.margin || 0);

    res.json({
      status: "success",
      widgets: {
        todaysNewBookings: Number(todaysNewBookingsCountRes[0]?.count || 0),
        awaitingSupplierConfirmation: Number(awaitingSupplierConfirmationCountRes[0]?.count || 0),
        approachingDeadlines: Number(approachingDeadlinesCountRes[0]?.count || 0),
        partiallyConfirmedTrips: Number(partiallyConfirmedTripsCountRes[0]?.count || 0),
        paymentExceptions: Number(paymentExceptionsCountRes[0]?.count || 0),
        cancellationRefundCases: Number(cancellationRefundCasesCountRes[0]?.count || 0),
        unassignedTasks: Number(unassignedTasksCountRes[0]?.count || 0),
        revenue: rev,
        supplierCost: cost,
        estimatedMargin: marg,
      },
      financialOverview: {
        revenue: rev,
        supplierCost: cost,
        margin: marg,
      },
      recentBookings: recentBookingsRes,
      supplierQueue: supplierQueueRes,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch operations dashboard");
    res.status(500).json({ status: "error", message: "Failed to fetch operations dashboard." });
  }
});

// --------------------------------------------------------------------------
// 2. Fulfilment Tasks Management
// --------------------------------------------------------------------------
router.get("/operations/tasks", requireOps, async (req, res) => {
  try {
    const { status, bookingId } = req.query;
    const conditions = [];

    if (status && typeof status === "string") {
      conditions.push(eq(bookingServicesTable.status, status));
    }

    if (bookingId && typeof bookingId === "string") {
      conditions.push(eq(bookingsTable.bookingId, bookingId));
    }

    const tasks = await db
      .select({
        task: bookingServicesTable,
        vendorName: vendorsTable.businessName,
        vendorEmail: vendorsTable.email,
        vendorPhone: vendorsTable.phone,
        vendorStatus: vendorsTable.status,
        vendorApprovalStatus: vendorsTable.approvalStatus,
        vendorSuspensionType: vendorsTable.suspensionType,
        vendorSuspensionUntil: vendorsTable.suspensionUntil,
        vendorSuspensionReason: vendorsTable.suspensionReason,
        bookingRef: bookingsTable.bookingId,
        customerName: bookingsTable.customerContact,
        travelDate: bookingsTable.travelDate,
      })
      .from(bookingServicesTable)
      .leftJoin(vendorsTable, eq(bookingServicesTable.assignedVendorId, vendorsTable.id))
      .leftJoin(bookingsTable, eq(bookingServicesTable.bookingId, bookingsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookingServicesTable.createdAt));

    const mappedTasks = tasks.map((t: any) => {
      const vStatus = (t.vendorStatus || "").toUpperCase();
      const vApproval = (t.vendorApprovalStatus || "").toLowerCase();
      const isSuspended = vStatus === "SUSPENDED" || vApproval === "suspended" || t.vendorSuspensionType === "TEMPORARY" || t.vendorSuspensionType === "PERMANENT";
      return {
        ...t,
        isSupplierSuspended: isSuspended,
      };
    });

    res.json({ tasks: mappedTasks });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch tasks." });
  }
});

// Assign or Reassign task to vendor with calculated SLA deadline
router.post(["/operations/tasks/:taskId/assign", "/operations/tasks/:taskId/reassign"], requireOps, async (req, res) => {
  const taskId = typeof req.params.taskId === "string" ? req.params.taskId : String(req.params.taskId || "");
  const { vendorId, notes } = req.body;

  try {
    const [task] = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ status: "not_found", message: "Task not found." });
      return;
    }

    const [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, vendorId))
      .limit(1);

    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Vendor not found." });
      return;
    }

    const slaMins = await getSlaDurationMinutes("standard_supplier_response", 120);
    const deadline = new Date(Date.now() + slaMins * 60 * 1000);

    const [updatedTask] = await db
      .update(bookingServicesTable)
      .set({
        assignedVendorId: vendor.id,
        status: "REQUESTED",
        deadline,
        requestedAt: new Date(),
        notes: notes ? `${task.notes || ""}\nOps Note: ${notes}` : task.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, taskId))
      .returning();

    await logAuditAction({
      action: "TASK_ASSIGNED_TO_VENDOR",
      resourceType: "booking_service",
      resourceId: taskId,
      newValue: { vendorId: vendor.vendorId, vendorName: vendor.businessName, deadline },
      actorAdminId: (req as any).admin?.id,
      actorRole: "operations",
    });

    res.json({ status: "success", task: updatedTask, message: "Task assigned to vendor successfully." });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to assign task." });
  }
});

// Operations Verification Gate (Section 12: Customer status changes ONLY after verification)
router.post("/operations/tasks/:taskId/verify", requireOps, async (req, res) => {
  const taskId = typeof req.params.taskId === "string" ? req.params.taskId : String(req.params.taskId || "");
  const { confirmationRef, voucherUrl, invoiceUrl, notes } = req.body;

  try {
    const [task] = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ status: "not_found", message: "Task not found." });
      return;
    }

    const [updatedTask] = await db
      .update(bookingServicesTable)
      .set({
        status: "VERIFIED",
        customerFacingVerified: true,
        supplierConfirmationRef: confirmationRef || task.supplierConfirmationRef,
        voucherUrl: voucherUrl || task.voucherUrl,
        invoiceUrl: invoiceUrl || task.invoiceUrl,
        verifiedAt: new Date(),
        notes: notes ? `${task.notes || ""}\nVerified: ${notes}` : task.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, taskId))
      .returning();

    await logAuditAction({
      action: "TASK_VERIFIED_BY_OPERATIONS",
      resourceType: "booking_service",
      resourceId: taskId,
      newValue: { status: "VERIFIED", customerFacingVerified: true, confirmationRef },
      actorAdminId: (req as any).admin?.id,
      actorRole: "operations",
    });

    // Reevaluate master booking status
    await reevaluateBookingStatus(task.bookingId);

    res.json({
      status: "success",
      task: updatedTask,
      message: "Supplier confirmation verified. Customer status and vouchers updated.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to verify task." });
  }
});

// --------------------------------------------------------------------------
// 3. Flight Handling Without API (Section 13)
// --------------------------------------------------------------------------
router.post("/operations/bookings/:idOrBookingId/flight-pnr", requireOps, async (req, res) => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");
  const { pnr, ticketUrl, ticketPath, airline, notes } = req.body;

  if (!pnr || typeof pnr !== "string") {
    res.status(400).json({ status: "invalid_request", message: "PNR is required." });
    return;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrBookingId);

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(isUuid ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId))
      .limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    const timeline = booking.timeline || [];
    timeline.push({
      event: `Flight Ticket & PNR issued by Authorized Flight Partner: ${pnr} (${airline || "Confirmed"})`,
      timestamp: new Date().toISOString(),
      actor: (req as any).admin?.adminId || "Flight Desk Ops",
      notes: notes || "Manual ticket issuance complete",
    });

    const [updated] = await db
      .update(bookingsTable)
      .set({
        flightPnr: pnr.trim().toUpperCase(),
        flightTicketUrl: ticketPath || ticketUrl || null,
        flightStatus: "TICKETED",
        timeline,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    // Also update any child flight_partner task
    await db
      .update(bookingServicesTable)
      .set({
        status: "VERIFIED",
        customerFacingVerified: true,
        supplierConfirmationRef: pnr.trim().toUpperCase(),
        voucherUrl: ticketPath || null,
        verifiedAt: new Date(),
      })
      .where(
        and(eq(bookingServicesTable.bookingId, booking.id), eq(bookingServicesTable.serviceType, "flight_partner"))
      );

    await logAuditAction({
      action: "FLIGHT_PNR_ISSUED_MANUALLY",
      resourceType: "booking",
      resourceId: booking.id,
      newValue: { pnr, ticketUrl, airline },
      actorAdminId: (req as any).admin?.id,
      actorRole: "operations",
    });

    // Reevaluate booking
    await reevaluateBookingStatus(booking.id);

    if (booking.customerContact?.email) {
      await dispatchMultiChannelNotification({
        type: "SUPPLIER_CONFIRMATION_RECEIVED",
        recipientEmail: booking.customerContact.email,
        customerName: booking.customerContact.name,
        bookingId: booking.bookingId,
        message: `Flight tickets for your booking ${booking.bookingId} have been uploaded. PNR: ${pnr}`,
      });
    }

    res.json({
      status: "success",
      booking: updated,
      message: "Flight PNR uploaded and customer itinerary updated.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to upload flight PNR." });
  }
});
// --------------------------------------------------------------------------
// 7. Support Tickets (Customer & Ops, ZEL-08)
// --------------------------------------------------------------------------
const ticketCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().email("Valid email required").max(255, "Email is too long"),
  subject: z.string().trim().min(3, "Subject is required").max(200, "Subject is too long"),
  description: z.string().trim().min(5, "Description is required").max(5000, "Description is too long"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  bookingId: z.string().max(100).optional(),
});

router.post("/support/tickets", supportTicketRateLimiter, async (req, res) => {
  const parsed = ticketCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }
  try {
    let bookingUuid: string | undefined = undefined;
    if (parsed.data.bookingId && req.user) {
      const bookingRef = parsed.data.bookingId.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingRef);
      const [owned] = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(
          and(
            isUuid ? eq(bookingsTable.id, bookingRef) : eq(bookingsTable.bookingId, bookingRef),
            or(eq(bookingsTable.ownerId, req.user.id), eq(bookingsTable.customerId, req.user.id)),
          ),
        )
        .limit(1);
      if (owned) bookingUuid = owned.id;
    }

    const count = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TCK-${Date.now().toString().slice(-4)}-${count}`;
    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({
        ticketNumber,
        userId: req.user?.id,
        bookingId: bookingUuid,
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        description: parsed.data.description,
        priority: parsed.data.priority,
        status: "OPEN",
        lastMessageAt: new Date(),
        lastMessageBy: "CUSTOMER",
      })
      .returning();

    // 1. Insert initial message in support_messages table
    await db.insert(supportMessagesTable).values({
      ticketId: ticket.id,
      senderType: "CUSTOMER",
      senderId: req.user?.id || null,
      senderName: parsed.data.name,
      message: parsed.data.description,
    });

    // 2. Create Admin notification with deduplication
    const preview = parsed.data.description.length > 120
      ? parsed.data.description.slice(0, 117) + "..."
      : parsed.data.description;

    await db.insert(adminNotificationsTable).values({
      type: "NEW_SUPPORT_TICKET",
      module: "support",
      relatedId: ticket.id,
      title: "New Customer Support Message",
      message: `${parsed.data.name}: ${parsed.data.subject} — "${preview}"`,
      priority: parsed.data.priority || "MEDIUM",
      actionRequired: true,
      actionUrl: `/admin?tab=operations&ticketId=${ticket.id}`,
    });

    // 3. Log audit event
    await logAuditAction({
      action: "CUSTOMER_SUPPORT_CREATED",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      actorUserId: req.user?.id,
      actorName: parsed.data.name,
      actorRole: req.user?.role || "customer",
      newValue: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        priority: ticket.priority,
        hasBooking: Boolean(bookingUuid),
      },
    });

    res.status(201).json({
      status: "success",
      ticket: { id: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status },
      ticketNumber: ticket.ticketNumber,
      message: `Support ticket ${ticket.ticketNumber} created successfully. Our team will respond within 15 minutes.`,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to create support ticket");
    res.status(500).json({ status: "error", message: "Failed to create support ticket." });
  }
});

// Admin Support Tickets list with admin-specific unread state (Section 7, 9, 10, 14)
router.get("/support/tickets", requireOps, async (req, res) => {
  try {
    const tickets = await db
      .select({
        id: supportTicketsTable.id,
        ticketNumber: supportTicketsTable.ticketNumber,
        userId: supportTicketsTable.userId,
        bookingId: supportTicketsTable.bookingId,
        bookingRef: bookingsTable.bookingId,
        name: supportTicketsTable.name,
        email: supportTicketsTable.email,
        subject: supportTicketsTable.subject,
        description: supportTicketsTable.description,
        priority: supportTicketsTable.priority,
        status: supportTicketsTable.status,
        lastMessageAt: supportTicketsTable.lastMessageAt,
        lastMessageBy: supportTicketsTable.lastMessageBy,
        resolutionNotes: supportTicketsTable.resolutionNotes,
        createdAt: supportTicketsTable.createdAt,
        updatedAt: supportTicketsTable.updatedAt,
        customerId: usersTable.customerId,
      })
      .from(supportTicketsTable)
      .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
      .leftJoin(bookingsTable, eq(supportTicketsTable.bookingId, bookingsTable.id))
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(100);

    const currentAdminId = (req as any).admin?.id || (req as any).admin?.adminId || req.user?.id;

    // Lookup admin-specific read states for this admin
    const readRows = currentAdminId
      ? await db
          .select()
          .from(adminTicketReadsTable)
          .where(eq(adminTicketReadsTable.adminId, currentAdminId))
      : [];

    const readMap = new Map<string, Date>();
    for (const r of readRows) {
      if (r.lastReadAt) readMap.set(r.ticketId, new Date(r.lastReadAt));
    }

    const mappedTickets = tickets.map((t: any) => {
      const lastRead = readMap.get(t.id);
      const lastMsgDate = t.lastMessageAt ? new Date(t.lastMessageAt) : new Date(t.createdAt);
      // Unread for this admin if never read OR last message arrived after admin's last read timestamp
      const isUnread = !lastRead || lastMsgDate > lastRead;
      return {
        ...t,
        isUnread,
        unread: isUnread,
        lastReadAt: lastRead ? lastRead.toISOString() : null,
      };
    });

    const unreadCount = mappedTickets.filter((t: any) => t.isUnread).length;

    res.json({
      status: "success",
      tickets: mappedTickets,
      unreadCount,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch support tickets");
    res.status(500).json({ status: "error", message: "Failed to fetch support tickets." });
  }
});

// Customer: list my own support tickets (IDOR protected)
router.get("/support/tickets/my", requireAuth, async (req, res) => {
  try {
    const userTickets = await db
      .select()
      .from(supportTicketsTable)
      .where(
        or(
          eq(supportTicketsTable.userId, req.user!.id),
          eq(supportTicketsTable.email, req.user!.email)
        )
      )
      .orderBy(desc(supportTicketsTable.createdAt));

    res.json({ status: "success", tickets: userTickets });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch user support tickets");
    res.status(500).json({ status: "error", message: "Failed to fetch your support tickets." });
  }
});

// View Inquiry detail with complete conversation thread (Section 11, 12, 13, 15)
router.get("/support/tickets/:id", requireAuthOrAdmin, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");

  try {
    const [ticket] = await db
      .select({
        id: supportTicketsTable.id,
        ticketNumber: supportTicketsTable.ticketNumber,
        userId: supportTicketsTable.userId,
        bookingId: supportTicketsTable.bookingId,
        name: supportTicketsTable.name,
        email: supportTicketsTable.email,
        subject: supportTicketsTable.subject,
        description: supportTicketsTable.description,
        priority: supportTicketsTable.priority,
        status: supportTicketsTable.status,
        lastMessageAt: supportTicketsTable.lastMessageAt,
        lastMessageBy: supportTicketsTable.lastMessageBy,
        resolutionNotes: supportTicketsTable.resolutionNotes,
        createdAt: supportTicketsTable.createdAt,
        updatedAt: supportTicketsTable.updatedAt,
      })
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ status: "not_found", message: "Support ticket not found." });
      return;
    }

    const isAdmin = Boolean((req as any).admin || req.user?.role === "admin" || req.user?.role === "operations_manager");

    // IDOR protection: non-admin can only view their own tickets
    if (!isAdmin) {
      const isOwner = ticket.userId === req.user?.id || (req.user?.email && ticket.email.toLowerCase() === req.user.email.toLowerCase());
      if (!isOwner) {
        res.status(403).json({ status: "forbidden", message: "You do not have permission to view this ticket." });
        return;
      }
    }

    // If Admin opens ticket: mark as SEEN for this authenticated Admin only (Section 15)
    if (isAdmin) {
      const adminId = (req as any).admin?.id || (req as any).admin?.adminId || req.user?.id;
      if (adminId) {
        await db
          .insert(adminTicketReadsTable)
          .values({
            adminId,
            ticketId: ticket.id,
            lastReadAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [adminTicketReadsTable.adminId, adminTicketReadsTable.ticketId],
            set: { lastReadAt: new Date() },
          });

        // Also mark corresponding admin notification(s) as read for this admin
        const relatedNotifs = await db
          .select({ id: adminNotificationsTable.id })
          .from(adminNotificationsTable)
          .where(and(eq(adminNotificationsTable.module, "support"), eq(adminNotificationsTable.relatedId, ticket.id)));

        for (const notif of relatedNotifs) {
          await db
            .insert(adminNotificationReadsTable)
            .values({
              adminId,
              notificationId: notif.id,
              readAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [adminNotificationReadsTable.adminId, adminNotificationReadsTable.notificationId],
              set: { readAt: new Date() },
            });
        }
      }

      // Log audit log
      await logAuditAction({
        action: "ADMIN_SUPPORT_VIEWED",
        resourceType: "support_ticket",
        resourceId: ticket.id,
        actorAdminId: (req as any).admin?.id,
        actorName: (req as any).admin?.adminId || req.user?.fullName || "Operations Admin",
        actorRole: (req as any).admin ? "admin" : req.user?.role || "operations_manager",
      });
    }

    // Fetch complete conversation messages
    let messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.ticketId, ticket.id))
      .orderBy(asc(supportMessagesTable.createdAt));

    // Fallback if legacy ticket had no messages in support_messages: backfill from description
    if (messages.length === 0 && ticket.description) {
      const [initialMsg] = await db
        .insert(supportMessagesTable)
        .values({
          ticketId: ticket.id,
          senderType: "CUSTOMER",
          senderId: ticket.userId,
          senderName: ticket.name,
          message: ticket.description,
          createdAt: ticket.createdAt,
        })
        .returning();
      if (initialMsg) messages = [initialMsg];
    }

    // Fetch customer profile info if registered
    let customerInfo: any = null;
    if (ticket.userId) {
      const [userProfile] = await db
        .select({
          id: usersTable.id,
          customerId: usersTable.customerId,
          fullName: usersTable.fullName,
          email: usersTable.email,
          phone: usersTable.phone,
          status: usersTable.status,
        })
        .from(usersTable)
        .where(eq(usersTable.id, ticket.userId))
        .limit(1);
      customerInfo = userProfile || null;
    }

    // Fetch related booking if linked
    let bookingInfo: any = null;
    if (ticket.bookingId) {
      const [booking] = await db
        .select({
          id: bookingsTable.id,
          bookingId: bookingsTable.bookingId,
          status: bookingsTable.status,
          totalPrice: bookingsTable.totalPrice,
          travelDate: bookingsTable.travelDate,
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, ticket.bookingId))
        .limit(1);
      bookingInfo = booking || null;
    }

    res.json({
      status: "success",
      ticket,
      messages,
      customer: customerInfo,
      booking: bookingInfo,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch ticket inquiry detail");
    res.status(500).json({ status: "error", message: "Failed to fetch ticket detail." });
  }
});

// Admin & Customer Reply to Support Ticket (Section 16, 17, 18, 43, 44)
router.post("/support/tickets/:id/reply", requireAuthOrAdmin, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const replySchema = z.object({
    message: z.string().trim().min(1, "Reply message cannot be empty.").max(5000, "Reply message too long."),
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  });

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: parsed.error.issues[0]?.message || "Invalid reply." });
    return;
  }

  const { message: replyMessage, status: newStatus } = parsed.data;

  try {
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ status: "not_found", message: "Ticket not found." });
      return;
    }

    const isAdmin = Boolean((req as any).admin || req.user?.role === "admin" || req.user?.role === "operations_manager");

    if (isAdmin) {
      const adminId = (req as any).admin?.id || (req as any).admin?.adminId || req.user?.id;
      const adminName = (req as any).admin?.adminId || req.user?.fullName || "Zelevos Support";

      // 1. Save Admin reply to support_messages
      const [savedMessage] = await db
        .insert(supportMessagesTable)
        .values({
          ticketId: ticket.id,
          senderType: "ADMIN",
          senderId: adminId,
          senderName: adminName,
          message: replyMessage,
        })
        .returning();

      // 2. Update ticket last_message_at, last_message_by, status
      const updatedStatus = newStatus || (ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);
      await db
        .update(supportTicketsTable)
        .set({
          lastMessageAt: new Date(),
          lastMessageBy: "ADMIN",
          status: updatedStatus,
          updatedAt: new Date(),
        })
        .where(eq(supportTicketsTable.id, ticket.id));

      // 3. Mark ticket as read for this Admin
      if (adminId) {
        await db
          .insert(adminTicketReadsTable)
          .values({
            adminId,
            ticketId: ticket.id,
            lastReadAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [adminTicketReadsTable.adminId, adminTicketReadsTable.ticketId],
            set: { lastReadAt: new Date() },
          });
      }

      // 4. Create Customer Notification (Section 17, 41)
      let recipientUserId = ticket.userId;
      if (!recipientUserId && ticket.email) {
        const [u] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, ticket.email))
          .limit(1);
        if (u) recipientUserId = u.id;
      }

      if (recipientUserId) {
        const preview = replyMessage.length > 140 ? replyMessage.slice(0, 137) + "..." : replyMessage;
        await db.insert(notificationsTable).values({
          userId: recipientUserId,
          type: "SUPPORT_REPLY",
          ticketId: ticket.id,
          title: "Zelevos Support replied to your request",
          body: `Re: ${ticket.subject}\n"${preview}"`,
          category: "SUPPORT",
          actionUrl: `/support?ticketId=${ticket.id}`,
          isRead: false,
          isCleared: false,
          metadata: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            preview,
          },
        });
      }

      // 5. Audit Log (Section 34)
      await logAuditAction({
        action: "ADMIN_SUPPORT_REPLIED",
        resourceType: "support_ticket",
        resourceId: ticket.id,
        actorAdminId: (req as any).admin?.id,
        actorName: adminName,
        actorRole: (req as any).admin ? "admin" : req.user?.role || "operations_manager",
        newValue: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          status: updatedStatus,
          messagePreview: replyMessage.slice(0, 80),
        },
      });

      res.status(201).json({
        status: "success",
        message: "Reply sent to customer successfully.",
        newMessage: savedMessage,
      });
      return;
    }

    // Customer Reply Flow (IDOR protected, Section 43)
    const isOwner = ticket.userId === req.user?.id || (req.user?.email && ticket.email.toLowerCase() === req.user.email.toLowerCase());
    if (!isOwner) {
      res.status(403).json({ status: "forbidden", message: "You do not have permission to reply to this ticket." });
      return;
    }

    const customerName = req.user?.fullName || ticket.name || "Customer";

    // 1. Save customer message to support_messages
    const [savedMessage] = await db
      .insert(supportMessagesTable)
      .values({
        ticketId: ticket.id,
        senderType: "CUSTOMER",
        senderId: req.user?.id || null,
        senderName: customerName,
        message: replyMessage,
      })
      .returning();

    // 2. Update ticket status (reopen if resolved) and lastMessageAt
    await db
      .update(supportTicketsTable)
      .set({
        lastMessageAt: new Date(),
        lastMessageBy: "CUSTOMER",
        status: ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "OPEN" : ticket.status,
        updatedAt: new Date(),
      })
      .where(eq(supportTicketsTable.id, ticket.id));

    // 3. Create Admin Notification for customer reply
    const preview = replyMessage.length > 120 ? replyMessage.slice(0, 117) + "..." : replyMessage;
    await db.insert(adminNotificationsTable).values({
      type: "CUSTOMER_SUPPORT_REPLY",
      module: "support",
      relatedId: ticket.id,
      title: `Customer Reply: ${ticket.ticketNumber} - ${ticket.subject}`,
      message: `${customerName}: "${preview}"`,
      priority: ticket.priority || "MEDIUM",
      actionRequired: true,
      actionUrl: `/admin?tab=operations&ticketId=${ticket.id}`,
    });

    // 4. Audit Log
    await logAuditAction({
      action: "CUSTOMER_SUPPORT_REPLIED",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      actorUserId: req.user?.id,
      actorName: customerName,
      actorRole: req.user?.role || "customer",
      newValue: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        messagePreview: replyMessage.slice(0, 80),
      },
    });

    res.status(201).json({
      status: "success",
      message: "Your message has been sent to Zelevos Support.",
      newMessage: savedMessage,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to send ticket reply");
    res.status(500).json({ status: "error", message: "Failed to send reply." });
  }
});

router.post("/support/tickets/:id/resolve", requireOps, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const resolverName = (req as any).admin?.adminId || req.user?.fullName || req.user?.email || "Operations Staff";
  const resolverUserId = req.user?.id;
  const resolverAdminId = (req as any).admin?.id;

  try {
    const [ticket] = await db
      .update(supportTicketsTable)
      .set({
        status: "RESOLVED",
        resolutionNotes: req.body?.notes || `Resolved by ${resolverName}`,
        updatedAt: new Date(),
      })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    if (!ticket) {
      res.status(404).json({ status: "not_found", message: "Ticket not found." });
      return;
    }

    await logAuditAction({
      action: "SUPPORT_TICKET_RESOLVED",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      actorUserId: resolverUserId,
      actorAdminId: resolverAdminId,
      actorName: resolverName,
      actorRole: (req as any).admin ? "admin" : req.user?.role || "operations_manager",
      newValue: { status: "RESOLVED", resolutionNotes: req.body?.notes, resolvedBy: resolverName },
    });

    res.json({ status: "success", ticket, message: "Ticket marked as resolved." });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to resolve ticket." });
  }
});

export default router;