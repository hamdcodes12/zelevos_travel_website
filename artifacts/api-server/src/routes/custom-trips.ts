import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  customTripRequestsTable,
  packagesTable,
  bookingsTable,
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
    const [request] = await db
      .insert(customTripRequestsTable)
      .values({
        leadNumber,
        userId: req.user!.id,
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
      action: "CUSTOM_TRIP_REQUESTED",
      resourceType: "custom_trip_request",
      resourceId: request.id,
      actorUserId: req.user?.id,
      actorName: parsed.data.customerName,
      newValue: { leadNumber, destinations: parsed.data.destinations, totalBudget },
    });

    // Notify customer that their custom request is received
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
      lead: request,
      request,
      message: "Your custom trip request has been submitted! Our travel specialists will craft a bespoke itinerary for you.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to submit custom trip request." });
  }
});

/**
 * GET /api/custom-trips/my-requests
 * Authenticated customer views their submitted requests and received proposals.
 */
router.get("/custom-trips/my-requests", requireAuth, async (req, res) => {
  try {
    const requests = await db
      .select()
      .from(customTripRequestsTable)
      .where(eq(customTripRequestsTable.userId, req.user!.id))
      .orderBy(desc(customTripRequestsTable.createdAt));

    res.json({ status: "success", count: requests.length, requests });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load requests." });
  }
});

/**
 * GET /api/admin/custom-trips
 * Operations team reviews custom vacation leads (Section 21).
 */
router.get("/admin/custom-trips", requireRole(["admin", "operations_manager", "booking_executive"]), async (_req, res) => {
  try {
    const leads = await db
      .select()
      .from(customTripRequestsTable)
      .orderBy(desc(customTripRequestsTable.createdAt));

    res.json({ status: "success", count: leads.length, leads });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load custom trip leads." });
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
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to send proposal." });
  }
});

router.put("/admin/custom-trips/:id/proposal", requireRole(["admin", "operations_manager", "booking_executive"]), async (req, res) => {
  const parsed = proposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid proposal details.", errors: parsed.error.issues });
    return;
  }
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const [updated] = await db.update(customTripRequestsTable).set({
    proposalTitle: parsed.data.proposalTitle,
    proposalAmount: parsed.data.proposalAmount,
    proposalPackageId: parsed.data.proposalPackageId,
    proposalPaymentLink: parsed.data.proposalPaymentLink,
    proposalItinerary: parsed.data.proposalItinerary,
    proposalNotes: parsed.data.notes,
    status: "DRAFT",
    assignedTo: req.user?.fullName || req.user?.email || "Operations",
    updatedAt: new Date(),
  }).where(eq(customTripRequestsTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ status: "not_found", message: "Custom trip lead not found." });
    return;
  }
  res.json({ status: "success", lead: updated, message: "Proposal draft saved." });
});

router.post("/custom-trips/:id/accept", requireAuth, async (req, res) => {
  try {
    const result = await db.transaction(async (tx: typeof db) => {
      const [lead] = await tx.select().from(customTripRequestsTable).where(and(
        eq(customTripRequestsTable.id, String(req.params.id)),
        eq(customTripRequestsTable.userId, req.user!.id),
      )).limit(1);
      if (!lead) throw Object.assign(new Error("Custom trip proposal not found."), { statusCode: 404 });
      if (lead.bookingId) throw Object.assign(new Error("This proposal was already accepted."), { statusCode: 409 });
      if (lead.status !== "PROPOSAL_SENT" || !lead.proposalAmount) throw Object.assign(new Error("This custom trip is not ready for acceptance."), { statusCode: 409 });

      const [updatedLead] = await tx.update(customTripRequestsTable).set({
        status: "ACCEPTED",
        customerAcceptedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(customTripRequestsTable.id, lead.id), eq(customTripRequestsTable.status, "PROPOSAL_SENT"))).returning();
      if (!updatedLead) throw Object.assign(new Error("This proposal was already accepted."), { statusCode: 409 });

      const [booking] = await tx.insert(bookingsTable).values({
        bookingId: await generateMasterBookingId(),
        customerId: req.user!.id,
        ownerId: req.user!.id,
        packageId: lead.proposalPackageId,
        status: "PAYMENT_PENDING",
        totalPrice: lead.proposalAmount,
        totalBaseCost: 0,
        totalMarkup: lead.proposalAmount,
        paymentStatus: "PENDING",
        kind: "PACKAGE",
        providerMode: "LIVE",
        travelDate: lead.startDate || "",
        adultsCount: lead.travellersCount,
        customerContact: { name: lead.customerName, email: lead.customerEmail, phone: lead.customerPhone },
        timeline: [{ event: "CUSTOM_TRIP_ACCEPTED", timestamp: new Date().toISOString(), actor: "Customer", notes: lead.leadNumber }],
      }).returning();
      const [linkedLead] = await tx.update(customTripRequestsTable).set({ bookingId: booking.id, updatedAt: new Date() }).where(eq(customTripRequestsTable.id, lead.id)).returning();
      return { lead: linkedLead, booking };
    });
    res.status(201).json({ status: "success", ...result, message: "Proposal accepted. Complete payment to start fulfillment." });
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 500;
    res.status(statusCode).json({ status: statusCode === 404 ? "not_found" : statusCode === 409 ? "already_processed" : "error", message: error instanceof Error ? error.message : "Proposal could not be accepted." });
  }
});

export default router;
