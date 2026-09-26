import { Router, type IRouter } from "express";
import { and, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
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
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
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

    // Today's new bookings
    const [todaysNewBookingsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(gte(bookingsTable.createdAt, todayStart));

    // Awaiting supplier confirmation
    const [awaitingSupplierConfirmationCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingServicesTable)
      .where(or(eq(bookingServicesTable.status, "REQUESTED"), eq(bookingServicesTable.status, "PENDING")));

    // Approaching deadlines (due in next 60 minutes)
    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    const [approachingDeadlinesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingServicesTable)
      .where(
        and(
          lte(bookingServicesTable.deadline, soon),
          gt(bookingServicesTable.deadline, now),
          or(eq(bookingServicesTable.status, "PENDING"), eq(bookingServicesTable.status, "REQUESTED"))
        )
      );

    // Partially confirmed trips
    const [partiallyConfirmedTripsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "PARTIALLY_CONFIRMED"));

    // Payment exceptions
    const [paymentExceptionsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(or(eq(bookingsTable.status, "FAILED"), eq(bookingsTable.status, "ACTION_REQUIRED")));

    // Cancellation / refund cases
    const [cancellationRefundCasesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(or(eq(bookingsTable.status, "CANCEL_REQUESTED"), eq(bookingsTable.status, "REFUND_PENDING")));

    // Unassigned tasks
    const [unassignedTasksCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingServicesTable)
      .where(and(eq(bookingServicesTable.status, "PENDING"), isNull(bookingServicesTable.assignedVendorId)));

    // Financial Overview (Revenue, Supplier Cost, Estimated Margin)
    const [financeSummary] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${bookingsTable.totalPrice}), 0)`,
        supplierCost: sql<number>`coalesce(sum(${bookingsTable.totalBaseCost}), 0)`,
        margin: sql<number>`coalesce(sum(${bookingsTable.totalMarkup}), 0)`,
      })
      .from(bookingsTable)
      .where(sql`${bookingsTable.status} NOT IN ('FAILED', 'CANCELLED', 'REFUNDED')`);

    // Recent 10 bookings
    const recentBookings = await db
      .select()
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.createdAt))
      .limit(10);

    // Supplier response queue
    const supplierQueue = await db
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
      .limit(10);

    res.json({
      widgets: {
        todaysNewBookings: Number(todaysNewBookingsCount?.count || 0),
        awaitingSupplierConfirmation: Number(awaitingSupplierConfirmationCount?.count || 0),
        approachingDeadlines: Number(approachingDeadlinesCount?.count || 0),
        partiallyConfirmedTrips: Number(partiallyConfirmedTripsCount?.count || 0),
        paymentExceptions: Number(paymentExceptionsCount?.count || 0),
        cancellationRefundCases: Number(cancellationRefundCasesCount?.count || 0),
        unassignedTasks: Number(unassignedTasksCount?.count || 0),
        revenue: Number(financeSummary?.revenue || 0),
        supplierCost: Number(financeSummary?.supplierCost || 0),
        estimatedMargin: Number(financeSummary?.margin || 0),
      },
      recentBookings,
      supplierQueue,
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
        bookingRef: bookingsTable.bookingId,
        customerName: bookingsTable.customerContact,
        travelDate: bookingsTable.travelDate,
      })
      .from(bookingServicesTable)
      .leftJoin(vendorsTable, eq(bookingServicesTable.assignedVendorId, vendorsTable.id))
      .leftJoin(bookingsTable, eq(bookingServicesTable.bookingId, bookingsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookingServicesTable.createdAt));

    res.json({ tasks });
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
// 7. Support Tickets (Customer & Ops)
// --------------------------------------------------------------------------
const ticketCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  subject: z.string().trim().min(3, "Subject is required"),
  description: z.string().trim().min(5, "Description is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  bookingId: z.string().optional(),
});

router.post("/support/tickets", async (req, res) => {
  const parsed = ticketCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }
  try {
    let bookingUuid: string | undefined = undefined;
    if (parsed.data.bookingId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.data.bookingId);
      if (isUuid) {
        bookingUuid = parsed.data.bookingId;
      } else {
        const [found] = await db
          .select({ id: bookingsTable.id })
          .from(bookingsTable)
          .where(eq(bookingsTable.bookingId, parsed.data.bookingId))
          .limit(1);
        if (found) bookingUuid = found.id;
      }
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
      })
      .returning();

    res.status(201).json({
      status: "success",
      ticket,
      ticketNumber,
      message: `Support ticket ${ticketNumber} created successfully. Our team will respond within 15 minutes.`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to create support ticket." });
  }
});

router.get("/support/tickets", async (req, res) => {
  try {
    const tickets = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.createdAt)).limit(50);
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch support tickets." });
  }
});

router.post("/support/tickets/:id/resolve", async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const [ticket] = await db
      .update(supportTicketsTable)
      .set({
        status: "RESOLVED",
        resolutionNotes: req.body?.notes || "Resolved by Zelevos Operations Concierge.",
        updatedAt: new Date(),
      })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    if (!ticket) {
      res.status(404).json({ status: "not_found", message: "Ticket not found." });
      return;
    }

    res.json({ status: "success", ticket, message: "Ticket marked as resolved." });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to resolve ticket." });
  }
});

export default router;