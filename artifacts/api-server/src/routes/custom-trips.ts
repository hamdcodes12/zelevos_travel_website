import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq, desc, or } from "drizzle-orm";
import {
  db,
  customTripRequestsTable,
  packagesTable,
  bookingsTable,
  usersTable,
  notificationsTable,
  partnersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/rbac";
import { logAuditAction } from "../services/booking-engine";
import { dispatchMultiChannelNotification } from "../services/email-service";
import { generateMasterBookingId } from "../services/booking-engine";

const router: IRouter = Router();

/**
 * POST /api/custom-trips
 * Customer submits "Build My Trip" custom vacation request (Section 21).
 * Security: Customer ID / User ID is strictly derived from the authenticated session.
 */
router.post("/custom-trips", requireAuth, async (req, res) => {
  const schema = z.object({
    customerName: z.string().trim().min(2, "Name is required"),
    customerEmail: z.string().trim().email("Valid email required"),
    customerPhone: z.string().trim().min(8, "Phone number required"),
    destinations: z.array(z.string().trim()).min(1, "Select at least one destination"),
    datesFlexible: z.boolean().default(false),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    durationDays: z.number().int().positive().optional(),
    travellersCount: z.number().int().positive().default(2),
    budgetPerPerson: z.number().int().positive().optional(),
    hotelPreference: z.string().default("4 Star / Boutique"),
    transportPreference: z.string().default("Private Cab"),
    activitiesInterests: z.array(z.string()).default([]),
    specialRequests: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid trip requirements.", errors: parsed.error.issues });
    return;
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const leadNumber = `LEAD-${yy}${mm}${dd}-${Math.floor(100 + Math.random() * 900)}`;

  const totalBudget = parsed.data.budgetPerPerson
    ? parsed.data.budgetPerPerson * parsed.data.travellersCount
    : undefined;

  try {
    // Derive customer ID from session or user record for absolute authenticity
    let customerId = req.user?.customerId || null;
    if (!customerId && req.user?.id) {
      const [u] = await db.select({ customerId: usersTable.customerId }).from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
      customerId = u?.customerId || null;
    }

    const [request] = await db
      .insert(customTripRequestsTable)
      .values({
        leadNumber,
        userId: req.user!.id,
        customerId,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        customerPhone: parsed.data.customerPhone,
        destinations: parsed.data.destinations,
        datesFlexible: parsed.data.datesFlexible,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        durationDays: parsed.data.durationDays,
        travellersCount: parsed.data.travellersCount,
        budgetPerPerson: parsed.data.budgetPerPerson,
        totalBudget,
        hotelPreference: parsed.data.hotelPreference,
        transportPreference: parsed.data.transportPreference,
        activitiesInterests: parsed.data.activitiesInterests,
        specialRequests: parsed.data.specialRequests,
        status: "NEW",
      })
      .returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_REQUEST_CREATED",
      resourceType: "custom_trip_request",
      resourceId: request.id,
      actorUserId: req.user?.id,
      actorName: parsed.data.customerName,
      newValue: { leadNumber, customerId, destinations: parsed.data.destinations, totalBudget },
    });

    // In-app notification for the customer
    try {
      await db.insert(notificationsTable).values({
        userId: req.user!.id,
        recipientEmail: parsed.data.customerEmail,
        type: "BOOKING_RECEIVED",
        category: "BOOKING",
        title: "Custom Trip Request Received",
        body: `We received your custom vacation request for ${parsed.data.destinations.join(", ")}. Reference: ${leadNumber}. A dedicated Zelevos specialist will curate a handcrafted proposal for you within 24 hours.`,
        actionButton: "View Requests",
        actionUrl: "/trips",
        channel: "in_app",
        status: "SENT",
        metadata: { leadNumber, destinations: parsed.data.destinations },
      });
    } catch (_) { /* non-critical */ }

    // Multi-channel email notification
    await dispatchMultiChannelNotification({
      type: "BOOKING_RECEIVED",
      recipientEmail: parsed.data.customerEmail,
      customerName: parsed.data.customerName,
      bookingId: leadNumber,
      message: `We received your custom vacation request for ${parsed.data.destinations.join(", ")}. A dedicated Zelevos destination specialist will curate a handcrafted proposal for you within 24 hours.`,
    });

    res.status(201).json({
      status: "success",
      leadNumber,
      lead: { ...request, customerId },
      request: { ...request, customerId },
      message: "Your custom trip request has been submitted! Our travel specialists will craft a bespoke itinerary for you.",
    });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Failed to submit custom trip request") : console.error(error);
    res.status(500).json({ status: "error", message: "Failed to submit custom trip request. Please try again." });
  }
});

/**
 * GET /api/custom-trips/my-requests
 * Authenticated customer views their submitted requests and received proposals.
 */
router.get("/custom-trips/my-requests", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        request: customTripRequestsTable,
        bookingRef: bookingsTable.bookingId,
        bookingStatus: bookingsTable.status,
        bookingPaymentStatus: bookingsTable.paymentStatus,
        bookingPaymentId: bookingsTable.paymentId,
        bookingPaymentOrderId: bookingsTable.paymentOrderId,
      })
      .from(customTripRequestsTable)
      .leftJoin(bookingsTable, eq(customTripRequestsTable.bookingId, bookingsTable.id))
      .where(eq(customTripRequestsTable.userId, req.user!.id))
      .orderBy(desc(customTripRequestsTable.createdAt));

    const requests = rows.map((row: any) => ({
      ...row.request,
      masterBookingId: row.bookingRef || null,
      bookingStatus: row.bookingStatus || null,
      paymentStatus: row.bookingPaymentStatus || null,
      paymentId: row.bookingPaymentId || null,
      paymentOrderId: row.bookingPaymentOrderId || null,
    }));

    res.json({ status: "success", count: requests.length, requests });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Failed to load customer requests") : console.error(error);
    res.status(500).json({ status: "error", message: "Failed to load requests." });
  }
});

/**
 * GET /api/custom-trips/:id
 * Customer views their own proposal or Admin views any proposal.
 * Prevents IDOR.
 */
router.get("/custom-trips/:id", requireAuth, async (req, res) => {
  const leadId = String(req.params.id || "").trim();
  try {
    const isStaff = Boolean(req.admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";

    const rows = await db
      .select({
        lead: customTripRequestsTable,
        userCustomerId: usersTable.customerId,
        bookingRef: bookingsTable.bookingId,
        bookingStatus: bookingsTable.status,
        bookingPaymentStatus: bookingsTable.paymentStatus,
        bookingPaymentId: bookingsTable.paymentId,
        bookingPaymentOrderId: bookingsTable.paymentOrderId,
      })
      .from(customTripRequestsTable)
      .leftJoin(usersTable, eq(customTripRequestsTable.userId, usersTable.id))
      .leftJoin(bookingsTable, eq(customTripRequestsTable.bookingId, bookingsTable.id))
      .where(
        isStaff
          ? eq(customTripRequestsTable.id, leadId)
          : and(eq(customTripRequestsTable.id, leadId), eq(customTripRequestsTable.userId, req.user!.id))
      )
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ status: "not_found", message: "Custom trip proposal not found." });
      return;
    }

    const { lead, userCustomerId, bookingRef, bookingStatus, bookingPaymentStatus, bookingPaymentId, bookingPaymentOrderId } = rows[0];

    const leadObj = {
      ...lead,
      customerId: lead.customerId || userCustomerId || null,
      masterBookingId: bookingRef || null,
      bookingStatus: bookingStatus || null,
      paymentStatus: bookingPaymentStatus || null,
      paymentId: bookingPaymentId || null,
      paymentOrderId: bookingPaymentOrderId || null,
    };

    res.json({
      status: "success",
      lead: leadObj,
      request: leadObj,
    });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Failed to load custom trip") : console.error(error);
    res.status(500).json({ status: "error", message: "Failed to load custom trip proposal." });
  }
});

/**
 * GET /api/admin/custom-trips
 * Operations team reviews custom vacation leads with complete persisted customer fields.
 */
router.get("/admin/custom-trips", requireRole(["admin", "operations_manager", "booking_executive"]), async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true" || req.query.archived === "true";
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";

    const rows = await db
      .select({
        lead: customTripRequestsTable,
        userCustomerId: usersTable.customerId,
        userFullName: usersTable.fullName,
        userEmail: usersTable.email,
        userPhone: usersTable.phone,
        bookingRef: bookingsTable.bookingId,
        bookingStatus: bookingsTable.status,
        bookingPaymentStatus: bookingsTable.paymentStatus,
        bookingPaymentId: bookingsTable.paymentId,
        bookingPaymentOrderId: bookingsTable.paymentOrderId,
      })
      .from(customTripRequestsTable)
      .leftJoin(usersTable, eq(customTripRequestsTable.userId, usersTable.id))
      .leftJoin(bookingsTable, eq(customTripRequestsTable.bookingId, bookingsTable.id))
      .orderBy(desc(customTripRequestsTable.createdAt));

    let leads = rows.map((row: any) => {
      const { lead, userCustomerId, userFullName, userEmail, userPhone, bookingRef, bookingStatus, bookingPaymentStatus, bookingPaymentId, bookingPaymentOrderId } = row;
      return {
        ...lead,
        customerId: lead.customerId || userCustomerId || null,
        customerName: lead.customerName || userFullName || "Guest",
        customerEmail: lead.customerEmail || userEmail || "",
        customerPhone: lead.customerPhone || userPhone || "",
        masterBookingId: bookingRef || null,
        bookingStatus: bookingStatus || null,
        paymentStatus: bookingPaymentStatus || null,
        paymentId: bookingPaymentId || null,
        paymentOrderId: bookingPaymentOrderId || null,
        isArchived: lead.isArchived ?? false,
        archivedAt: lead.archivedAt ?? null,
        archivedBy: lead.archivedBy ?? null,
        archiveReason: lead.archiveReason ?? null,
      };
    });

    if (statusFilter === "ARCHIVED") {
      leads = leads.filter((l: any) => l.isArchived);
    } else {
      if (!includeArchived) {
        leads = leads.filter((l: any) => !l.isArchived);
      }
      if (statusFilter && statusFilter !== "ALL") {
        leads = leads.filter((l: any) => l.status === statusFilter);
      }
    }

    res.json({ status: "success", count: leads.length, leads });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load custom trip leads." });
  }
});

router.post("/admin/custom-trips/:id/archive", requireRole(["admin", "operations_manager"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Archived by administrator";

  try {
    const [existing] = await db.select().from(customTripRequestsTable).where(eq(customTripRequestsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Custom trip lead not found." });
      return;
    }

    const now = new Date();
    const adminActor = (req as any).admin?.adminId || (req as any).user?.fullName || "admin";
    const [updated] = await db
      .update(customTripRequestsTable)
      .set({
        isArchived: true,
        archivedAt: now,
        archivedBy: adminActor,
        archiveReason: reason,
        updatedAt: now,
      })
      .where(eq(customTripRequestsTable.id, id))
      .returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_ARCHIVED",
      resourceType: "custom_trip_request",
      resourceId: existing.id,
      previousValue: { isArchived: existing.isArchived },
      newValue: { isArchived: true, archiveReason: reason },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", message: "Custom trip request successfully archived.", lead: updated });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to archive custom trip." });
  }
});

router.post("/admin/custom-trips/:id/restore", requireRole(["admin", "operations_manager"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");

  try {
    const [existing] = await db.select().from(customTripRequestsTable).where(eq(customTripRequestsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Custom trip lead not found." });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(customTripRequestsTable)
      .set({
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        updatedAt: now,
      })
      .where(eq(customTripRequestsTable.id, id))
      .returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_RESTORED",
      resourceType: "custom_trip_request",
      resourceId: existing.id,
      previousValue: { isArchived: existing.isArchived },
      newValue: { isArchived: false },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", message: "Custom trip request successfully restored.", lead: updated });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to restore custom trip." });
  }
});

router.delete("/admin/custom-trips/:id", requireRole(["admin", "operations_manager"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const force = req.query.force === "true";

  try {
    const [existing] = await db.select().from(customTripRequestsTable).where(eq(customTripRequestsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Custom trip lead not found." });
      return;
    }

    if (existing.bookingId && !force) {
      const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, existing.bookingId)).limit(1);
      if (booking && (booking.status === "CONFIRMED" || booking.paymentStatus === "CAPTURED")) {
        res.status(400).json({
          status: "has_confirmed_booking",
          message: "Cannot permanently delete a custom trip proposal with an active confirmed booking. Please archive it instead.",
        });
        return;
      }
    }

    await db.delete(customTripRequestsTable).where(eq(customTripRequestsTable.id, id));

    await logAuditAction({
      action: "CUSTOM_TRIP_DELETED",
      resourceType: "custom_trip_request",
      resourceId: existing.id,
      previousValue: { destinations: existing.destinations, customerEmail: existing.customerEmail },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", message: "Custom trip request permanently deleted." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to delete custom trip." });
  }
});

const proposalItinerarySchema = z.array(z.object({
  day: z.number().int().positive(),
  date: z.string().trim().optional(),
  location: z.string().trim().min(1),
  activity: z.string().trim().min(1),
  meal: z.string().trim().optional(),
  description: z.string().trim().min(1),
})).max(60).default([]);

const proposalSchema = z.object({
  proposalTitle: z.string().trim().min(3),
  proposalAmount: z.number().int().positive(),
  proposalPackageId: z.string().uuid().optional(),
  proposalPaymentLink: z.string().url().optional(),
  proposalItinerary: proposalItinerarySchema,
  notes: z.string().trim().max(5000).optional(),
});

/**
 * POST /api/admin/custom-trips/:id/proposal
 * Operations specialist sends a curated custom trip proposal with pricing.
 */
router.post("/admin/custom-trips/:id/proposal", requireRole(["admin", "operations_manager", "booking_executive"]), async (req, res) => {
  const parsed = proposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid proposal details.", errors: parsed.error.issues });
    return;
  }

  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");

  try {
    const [lead] = await db
      .select()
      .from(customTripRequestsTable)
      .where(eq(customTripRequestsTable.id, id))
      .limit(1);

    if (!lead) {
      res.status(404).json({ status: "not_found", message: "Custom trip lead not found." });
      return;
    }

    const [updated] = await db
      .update(customTripRequestsTable)
      .set({
        proposalTitle: parsed.data.proposalTitle,
        proposalAmount: parsed.data.proposalAmount,
        proposalPackageId: parsed.data.proposalPackageId,
        proposalPaymentLink: parsed.data.proposalPaymentLink,
        proposalItinerary: parsed.data.proposalItinerary,
        proposalNotes: parsed.data.notes,
        status: "PROPOSAL_SENT",
        assignedTo: req.user?.fullName || req.user?.email || "Operations",
        updatedAt: new Date(),
      })
      .where(eq(customTripRequestsTable.id, id))
      .returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_PROPOSAL_SENT",
      resourceType: "custom_trip_request",
      resourceId: id,
      actorUserId: req.user?.id,
      actorRole: req.user?.role || "operations",
      newValue: {
        proposalTitle: parsed.data.proposalTitle,
        proposalAmount: parsed.data.proposalAmount,
      },
    });

    // In-app notification for the customer
    if (lead.userId) {
      try {
        await db.insert(notificationsTable).values({
          userId: lead.userId,
          recipientEmail: lead.customerEmail,
          type: "CUSTOM_TRIP_PROPOSAL",
          category: "BOOKING",
          title: "Your Custom Trip Proposal is Ready",
          body: `Zelevos has prepared a personalized itinerary "${parsed.data.proposalTitle}" for your trip. Review the proposal and accept to confirm.`,
          actionButton: "View Proposal",
          actionUrl: "/trips",
          channel: "in_app",
          status: "SENT",
          metadata: {
            leadId: lead.id,
            leadNumber: lead.leadNumber,
            proposalTitle: parsed.data.proposalTitle,
            proposalAmount: parsed.data.proposalAmount,
          },
        });
      } catch (_) { /* non-critical */ }
    }

    // Email notification
    if (lead.customerEmail) {
      await dispatchMultiChannelNotification({
        type: "ACTION_REQUIRED_CUSTOMER",
        recipientEmail: lead.customerEmail,
        customerName: lead.customerName,
        bookingId: lead.leadNumber,
        message: `Your bespoke travel proposal "${parsed.data.proposalTitle}" is ready! Review the itinerary and confirm your reservation.`,
      });
    }

    res.json({ status: "success", lead: updated, message: "Proposal sent to customer." });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Failed to send proposal") : console.error(error);
    res.status(500).json({ status: "error", message: "Failed to send proposal." });
  }
});

router.put("/admin/custom-trips/:id/proposal", requireRole(["admin", "operations_manager", "booking_executive"]), async (req, res) => {
  const parsed = proposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid proposal details.", errors: parsed.error.issues });
    return;
  }
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const [updated] = await db.update(customTripRequestsTable).set({
      proposalTitle: parsed.data.proposalTitle,
      proposalAmount: parsed.data.proposalAmount,
      proposalPackageId: parsed.data.proposalPackageId,
      proposalPaymentLink: parsed.data.proposalPaymentLink,
      proposalItinerary: parsed.data.proposalItinerary,
      proposalNotes: parsed.data.notes,
      status: "PROPOSAL_DRAFT",
      assignedTo: req.user?.fullName || req.user?.email || "Operations",
      updatedAt: new Date(),
    }).where(eq(customTripRequestsTable.id, id)).returning();

    if (!updated) {
      res.status(404).json({ status: "not_found", message: "Custom trip lead not found." });
      return;
    }
    res.json({ status: "success", lead: updated, message: "Proposal draft saved." });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Failed to save proposal draft") : console.error(error);
    res.status(500).json({ status: "error", message: "Failed to save proposal draft." });
  }
});

/**
 * POST /api/custom-trips/:id/accept
 * Customer accepts custom trip proposal.
 * Creates an authoritative booking and transitions state to ACCEPTED_PENDING_PAYMENT.
 * Prevents raw SQL error exposure.
 */
router.post("/custom-trips/:id/accept", requireAuth, async (req, res) => {
  const leadId = String(req.params.id || "").trim();
  try {
    const result = await db.transaction(async (tx: typeof db) => {
      const [lead] = await tx.select().from(customTripRequestsTable).where(and(
        eq(customTripRequestsTable.id, leadId),
        eq(customTripRequestsTable.userId, req.user!.id),
      )).limit(1);

      if (!lead) throw Object.assign(new Error("Custom trip proposal not found."), { statusCode: 404 });
      if (lead.bookingId) {
        const [existingBooking] = await tx
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.id, lead.bookingId))
          .limit(1);
        if (existingBooking) {
          return { lead, booking: existingBooking };
        }
      }
      if ((lead.status !== "PROPOSAL_SENT" && lead.status !== "ACCEPTED") || !lead.proposalAmount) {
        throw Object.assign(new Error("This custom trip proposal is not awaiting acceptance."), { statusCode: 409 });
      }

      const masterBookingId = await generateMasterBookingId(tx);

      // Check partner referral code / coupon
      let partnerId: string | null = null;
      let finalPrice = lead.proposalAmount;
      let discountAmount = 0;
      const refCode = (req.body?.referralCode || (req.user as any)?.referralCodeUsed || "").toString().trim().toUpperCase();
      if (refCode) {
        const [partner] = await tx
          .select()
          .from(partnersTable)
          .where(eq(partnersTable.referralCode, refCode))
          .limit(1);

        if (partner && partner.status === "approved") {
          partnerId = partner.id;
          if (partner.discountEnabled) {
            const rawVal = Number(partner.discountValue || 0);
            if (partner.discountType === "flat") {
              discountAmount = Math.min(rawVal, finalPrice);
            } else {
              discountAmount = Math.round((finalPrice * rawVal) / 100);
              if (partner.discountMaxCap && discountAmount > partner.discountMaxCap) {
                discountAmount = partner.discountMaxCap;
              }
            }
            finalPrice = Math.max(1, finalPrice - discountAmount);
          }
        }
      }

      const [booking] = await tx.insert(bookingsTable).values({
        bookingId: masterBookingId,
        customerId: req.user!.id,
        ownerId: req.user!.id,
        packageId: lead.proposalPackageId || undefined,
        partnerId: partnerId || undefined,
        status: "PAYMENT_PENDING",
        totalPrice: finalPrice,
        totalBaseCost: 0,
        totalMarkup: finalPrice,
        paymentStatus: "PENDING",
        kind: "PACKAGE",
        providerMode: "LIVE",
        travelDate: lead.startDate || "",
        adultsCount: lead.travellersCount || 1,
        childrenCount: 0,
        infantsCount: 0,
        roomsCount: 1,
        specialRequests: lead.specialRequests || undefined,
        customerContact: {
          name: lead.customerName,
          email: lead.customerEmail,
          phone: lead.customerPhone,
        },
        providerReference: lead.leadNumber,
        bookingReference: masterBookingId,
        amount: finalPrice,
        payload: {
          leadNumber: lead.leadNumber,
          destinations: lead.destinations,
          proposalTitle: lead.proposalTitle,
          referralCodeApplied: refCode || undefined,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
        },
        emailStatus: "PENDING",
        timeline: [
          {
            event: "CUSTOM_TRIP_ACCEPTED",
            timestamp: new Date().toISOString(),
            actor: lead.customerName || "Customer",
            notes: `Lead: ${lead.leadNumber}. Awaiting payment of ₹${Number(finalPrice).toLocaleString("en-IN")}.${discountAmount > 0 ? ` (Referral discount: -₹${discountAmount})` : ""}`,
          },
        ],
      }).returning();

      const [updatedLead] = await tx.update(customTripRequestsTable).set({
        status: "ACCEPTED",
        customerAcceptedAt: new Date(),
        bookingId: booking.id,
        updatedAt: new Date(),
      }).where(and(eq(customTripRequestsTable.id, lead.id), eq(customTripRequestsTable.status, "PROPOSAL_SENT"))).returning();

      if (!updatedLead) {
        throw Object.assign(new Error("This proposal was already accepted."), { statusCode: 409 });
      }

      return { lead: updatedLead, booking };
    });

    await logAuditAction({
      action: "PROPOSAL_ACCEPTED",
      resourceType: "custom_trip_request",
      resourceId: result.lead.id,
      actorUserId: req.user!.id,
      actorRole: "customer",
      newValue: {
        bookingId: result.booking.bookingId,
        proposalAmount: result.lead.proposalAmount,
      },
    });

    // In-app notification: Payment Required
    try {
      await db.insert(notificationsTable).values({
        userId: req.user!.id,
        recipientEmail: result.lead.customerEmail,
        type: "ACTION_REQUIRED_CUSTOMER",
        category: "PAYMENT",
        title: "Payment Required for Custom Trip",
        body: `Your proposal for "${result.lead.proposalTitle || result.lead.leadNumber}" was accepted. Complete payment of ₹${Number(result.lead.proposalAmount).toLocaleString("en-IN")} to confirm your holiday.`,
        actionButton: "Pay Now",
        actionUrl: "/trips",
        channel: "in_app",
        status: "SENT",
        bookingId: result.booking.id,
        metadata: {
          leadId: result.lead.id,
          bookingId: result.booking.bookingId,
          amount: result.lead.proposalAmount,
        },
      });
    } catch (_) { /* non-critical */ }

    res.status(200).json({
      status: "success",
      lead: result.lead,
      booking: result.booking,
      message: "Proposal accepted. Complete payment to start fulfillment.",
    });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Custom trip proposal acceptance error") : console.error("Accept error:", error);
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 500;
    const safeMessage = statusCode === 404
      ? "Custom trip proposal not found."
      : statusCode === 409
      ? (error instanceof Error ? error.message : "This proposal has already been processed.")
      : "We couldn't process your trip acceptance right now. Please try again.";

    res.status(statusCode).json({
      status: statusCode === 404 ? "not_found" : statusCode === 409 ? "already_processed" : "error",
      message: safeMessage,
    });
  }
});

/**
 * POST /api/custom-trips/:id/decline
 * Customer declines custom trip proposal.
 */
router.post("/custom-trips/:id/decline", requireAuth, async (req, res) => {
  const leadId = String(req.params.id || "").trim();
  try {
    const [lead] = await db.select().from(customTripRequestsTable).where(and(
      eq(customTripRequestsTable.id, leadId),
      eq(customTripRequestsTable.userId, req.user!.id),
    )).limit(1);

    if (!lead) {
      res.status(404).json({ status: "not_found", message: "Custom trip proposal not found." });
      return;
    }
    if (lead.status !== "PROPOSAL_SENT") {
      res.status(409).json({ status: "invalid_state", message: "This proposal cannot be declined." });
      return;
    }

    const [updated] = await db.update(customTripRequestsTable).set({
      status: "DECLINED",
      updatedAt: new Date(),
    }).where(eq(customTripRequestsTable.id, lead.id)).returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_PROPOSAL_DECLINED",
      resourceType: "custom_trip_request",
      resourceId: lead.id,
      actorUserId: req.user!.id,
      actorRole: "customer",
    });

    res.json({ status: "success", lead: updated, message: "Proposal declined." });
  } catch (error) {
    req.log?.error ? req.log.error({ err: error }, "Decline error") : console.error(error);
    res.status(500).json({ status: "error", message: "Failed to decline proposal." });
  }
});

/**
 * POST /api/custom-trips/:id/cancel
 * Traveller cancels custom trip proposal/request.
 */
router.post("/custom-trips/:id/cancel", requireAuth, async (req, res) => {
  const leadId = String(req.params.id || "").trim();
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Cancelled by traveler";

  try {
    const [lead] = await db
      .select()
      .from(customTripRequestsTable)
      .where(and(
        eq(customTripRequestsTable.id, leadId),
        eq(customTripRequestsTable.userId, req.user!.id)
      ))
      .limit(1);

    if (!lead) {
      res.status(404).json({ status: "not_found", message: "Custom trip request not found." });
      return;
    }

    if (lead.status === "CANCELLED") {
      res.status(409).json({ status: "already_cancelled", message: "This custom trip request is already cancelled." });
      return;
    }

    const now = new Date();

    // If an unpaid booking exists, cancel it too
    if (lead.bookingId) {
      const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, lead.bookingId)).limit(1);
      if (booking && booking.status !== "CANCELLED") {
        if (booking.paymentStatus === "CAPTURED" || booking.status === "CONFIRMED") {
          // Keep note that refund/ops action is required
          await db.update(bookingsTable).set({
            cancellationReason: reason,
            cancellationRequestedAt: now,
            updatedAt: now,
          }).where(eq(bookingsTable.id, booking.id));
        } else {
          await db.update(bookingsTable).set({
            status: "CANCELLED",
            paymentStatus: "FAILED",
            cancellationReason: reason,
            cancellationRequestedAt: now,
            updatedAt: now,
          }).where(eq(bookingsTable.id, booking.id));
        }
      }
    }

    const [updated] = await db
      .update(customTripRequestsTable)
      .set({
        status: "CANCELLED",
        cancellationReason: reason,
        cancelledAt: now,
        cancelledBy: req.user!.fullName || req.user!.email || "Traveler",
        updatedAt: now,
      })
      .where(eq(customTripRequestsTable.id, lead.id))
      .returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_CANCELLED",
      resourceType: "custom_trip_request",
      resourceId: lead.id,
      actorUserId: req.user!.id,
      actorRole: "customer",
      previousValue: { status: lead.status },
      newValue: { status: "CANCELLED", reason },
    });

    // In-app notification to traveler
    try {
      await db.insert(notificationsTable).values({
        userId: req.user!.id,
        recipientEmail: lead.customerEmail,
        type: "CUSTOM_TRIP_CANCELLED",
        category: "SYSTEM",
        title: "Custom Trip Request Cancelled",
        body: `Your request (${lead.leadNumber}) has been cancelled.`,
        actionButton: "View Plans",
        actionUrl: "/trips",
        channel: "in_app",
        status: "SENT",
        metadata: { leadId: lead.id, leadNumber: lead.leadNumber, reason },
      });
    } catch (_) { /* non-critical */ }

    res.json({ status: "success", lead: updated, message: "Custom trip request successfully cancelled." });
  } catch (error: any) {
    req.log?.error ? req.log.error({ err: error }, "Cancel error") : console.error(error);
    res.status(500).json({ status: "error", message: error.message || "Failed to cancel custom trip." });
  }
});

/**
 * POST /api/admin/custom-trips/:id/cancel
 * Operations team cancels custom trip proposal/request.
 */
router.post("/admin/custom-trips/:id/cancel", requireRole(["admin", "operations_manager", "booking_executive"]), async (req, res) => {
  const leadId = String(req.params.id || "").trim();
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Cancelled by operations specialist";

  try {
    const [lead] = await db
      .select()
      .from(customTripRequestsTable)
      .where(eq(customTripRequestsTable.id, leadId))
      .limit(1);

    if (!lead) {
      res.status(404).json({ status: "not_found", message: "Custom trip request not found." });
      return;
    }

    if (lead.status === "CANCELLED") {
      res.status(409).json({ status: "already_cancelled", message: "This custom trip request is already cancelled." });
      return;
    }

    const now = new Date();
    const adminActor = (req as any).admin?.adminId || (req as any).user?.fullName || "Operations";

    // If an unpaid booking exists, cancel it too
    if (lead.bookingId) {
      const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, lead.bookingId)).limit(1);
      if (booking && booking.status !== "CANCELLED") {
        if (booking.paymentStatus === "CAPTURED" || booking.status === "CONFIRMED") {
          await db.update(bookingsTable).set({
            cancellationReason: reason,
            cancellationRequestedAt: now,
            updatedAt: now,
          }).where(eq(bookingsTable.id, booking.id));
        } else {
          await db.update(bookingsTable).set({
            status: "CANCELLED",
            paymentStatus: "FAILED",
            cancellationReason: reason,
            cancellationRequestedAt: now,
            updatedAt: now,
          }).where(eq(bookingsTable.id, booking.id));
        }
      }
    }

    const [updated] = await db
      .update(customTripRequestsTable)
      .set({
        status: "CANCELLED",
        cancellationReason: reason,
        cancelledAt: now,
        cancelledBy: adminActor,
        updatedAt: now,
      })
      .where(eq(customTripRequestsTable.id, lead.id))
      .returning();

    await logAuditAction({
      action: "CUSTOM_TRIP_ADMIN_CANCELLED",
      resourceType: "custom_trip_request",
      resourceId: lead.id,
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
      previousValue: { status: lead.status },
      newValue: { status: "CANCELLED", reason, cancelledBy: adminActor },
    });

    // Notify customer via in-app & email
    if (lead.userId) {
      try {
        await db.insert(notificationsTable).values({
          userId: lead.userId,
          recipientEmail: lead.customerEmail,
          type: "CUSTOM_TRIP_CANCELLED",
          category: "SYSTEM",
          title: "Custom Trip Request Update",
          body: `Your custom trip proposal (${lead.leadNumber}) was cancelled by operations: ${reason}`,
          actionButton: "Plan New Trip",
          actionUrl: "/build-trip",
          channel: "in_app",
          status: "SENT",
          metadata: { leadId: lead.id, leadNumber: lead.leadNumber, reason },
        });
      } catch (_) { /* non-critical */ }
    }

    if (lead.customerEmail) {
      try {
        await dispatchMultiChannelNotification({
          type: "CANCELLATION_REFUND_UPDATE",
          recipientEmail: lead.customerEmail,
          customerName: lead.customerName,
          bookingId: lead.leadNumber,
          message: `Your custom vacation request (${lead.leadNumber}) has been cancelled by our operations team. Reason: ${reason}. Please let us know if you would like to explore alternative options.`,
        });
      } catch (_) { /* non-critical */ }
    }

    res.json({ status: "success", lead: updated, message: "Custom trip request cancelled." });
  } catch (error: any) {
    req.log?.error ? req.log.error({ err: error }, "Admin cancel error") : console.error(error);
    res.status(500).json({ status: "error", message: error.message || "Failed to cancel custom trip." });
  }
});

export default router;
