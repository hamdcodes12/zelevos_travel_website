import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  travellersTable,
  vouchersTable,
  packagesTable,
  partnersTable,
  commissionsTable,
  paymentsTable,
  vendorsTable,
  refundsTable,
  usersTable,
  customTripRequestsTable,
  paymentTransactionsTable,
} from "@workspace/db";
import { requireAuth, requireAuthOrAdmin } from "../middlewares/authMiddleware";
import { isUuid } from "../lib/ids";
import {
  generateMasterBookingId,
  createFulfilmentTasksOnPayment,
  logAuditAction,
} from "../services/booking-engine";
import { computeTripConfidenceScore } from "../services/trip-confidence";
import { getPaymentProvider } from "../services/payment-service";
import { dispatchMultiChannelNotification } from "../services/email-service";

const router: IRouter = Router();

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const bookingCreateSchema = z.object({
  packageId: z.string().uuid("Valid package ID required"),
  travelDate: z.string().min(1, "Travel date is required"),
  adultsCount: z.coerce.number().int().min(1).default(1),
  childrenCount: z.coerce.number().int().min(0).default(0),
  infantsCount: z.coerce.number().int().min(0).default(0),
  roomsCount: z.coerce.number().int().min(1).default(1),
  roomConfiguration: z.array(z.any()).default([]),
  selectedAddons: z.array(z.string()).default([]),
  specialRequests: z.string().optional(),
  flightRequired: z.boolean().default(false),
  flightRequirementDetails: z.object({
    preferredRoute: z.string().optional(),
    preferredDates: z.string().optional(),
    passengerNames: z.array(z.string()).optional(),
    baggageRequirements: z.string().optional(),
  }).optional(),
  referralCode: z.string().optional(),
  customerContact: z.object({
    name: z.string().min(1, "Contact name is required"),
    email: z.string().email("Valid contact email is required"),
    phone: z.string().min(1, "Contact phone is required"),
  }),
  travellers: z.array(
    z.object({
      fullName: z.string().min(1, "Traveller name is required"),
      age: z.coerce.number().int().min(0),
      gender: z.string().default("Other"),
      isLead: z.boolean().default(false),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      passportNumber: z.string().optional(),
    })
  ).min(1, "At least one traveller is required"),
});

// --------------------------------------------------------------------------
// 1. Create Booking (Section 6: Customer Journey)
// --------------------------------------------------------------------------
router.post("/bookings", requireAuth, async (req, res) => {
  const parsed = bookingCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  try {
    // 1. Fetch package
    const [pkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.id, data.packageId))
      .limit(1);

    // Only published packages can be booked; drafts, paused and archived ones behave as if they do not exist
    if (!pkg || pkg.status !== "active") {
      res.status(404).json({ status: "not_found", message: "Package not found." });
      return;
    }

    // 2. Compute pricing
    const totalTravellers = data.adultsCount + data.childrenCount;
    const roomMultiplier = Math.max(1, data.roomsCount);
    const totalPrice = pkg.sellingPrice * roomMultiplier + pkg.serviceFee;
    const totalBaseCost = pkg.baseCost * roomMultiplier;
    const totalMarkup = totalPrice - totalBaseCost;

    // 3. Check partner referral code
    let partnerId: string | null = null;
    if (data.referralCode) {
      const [partner] = await db
        .select({ id: partnersTable.id, status: partnersTable.status, suspensionUntil: partnersTable.suspensionUntil })
        .from(partnersTable)
        .where(eq(partnersTable.referralCode, data.referralCode.trim().toUpperCase()))
        .limit(1);
      if (!partner) {
        res.status(400).json({ status: "invalid_referral_code", message: "Invalid referral code." });
        return;
      }
      const isAutoLifted = partner.status === "suspended" && partner.suspensionUntil && new Date(partner.suspensionUntil) <= new Date();
      const effectiveStatus = isAutoLifted ? "approved" : partner.status;
      if (effectiveStatus !== "approved") {
        res.status(400).json({ status: "inactive_referral_code", message: "This referral code is currently inactive." });
        return;
      }
      partnerId = partner.id;
    }

    // 4. Generate Master Booking ID: ZL{YYMMDD}{4-digit sequence}
    const bookingId = await generateMasterBookingId();

    const customerUserId = req.user!.id;

    const initialTimeline = [
      {
        event: `Booking created with ID ${bookingId}`,
        timestamp: new Date().toISOString(),
        actor: data.customerContact.name,
        notes: "Awaiting customer payment",
      },
    ];

    const [createdBooking] = await db
      .insert(bookingsTable)
      .values({
        bookingId,
        customerId: customerUserId,
        packageId: pkg.id,
        partnerId: partnerId || undefined,
        status: "PAYMENT_PENDING",
        paymentStatus: "PENDING",
        travelDate: data.travelDate,
        adultsCount: data.adultsCount,
        childrenCount: data.childrenCount,
        infantsCount: data.infantsCount,
        roomsCount: data.roomsCount,
        roomConfiguration: data.roomConfiguration,
        selectedAddons: data.selectedAddons,
        specialRequests: data.specialRequests,
        flightRequired: data.flightRequired,
        flightRequirementDetails: data.flightRequirementDetails,
        flightStatus: data.flightRequired ? "SUBJECT_TO_CONFIRMATION" : "NONE",
        totalPrice,
        totalBaseCost,
        totalMarkup,
        serviceFee: pkg.serviceFee,
        timeline: initialTimeline,
        customerContact: data.customerContact,
        // Legacy compat fields
        ownerId: customerUserId,
        kind: "PACKAGE",
        providerMode: "LIVE",
        providerReference: pkg.packageId || pkg.id,
        bookingReference: bookingId,
        amount: totalPrice,
      })
      .returning();

    // 5. Insert Travellers
    for (const tr of data.travellers) {
      await db.insert(travellersTable).values({
        bookingId: createdBooking.id,
        fullName: tr.fullName,
        age: tr.age,
        gender: tr.gender,
        isLead: tr.isLead,
        contactPhone: tr.contactPhone || data.customerContact.phone,
        contactEmail: tr.contactEmail || data.customerContact.email,
        passportNumber: tr.passportNumber,
      });
    }

    // 6. Emit audit log
    await logAuditAction({
      action: "BOOKING_CREATED",
      resourceType: "booking",
      resourceId: createdBooking.id,
      newValue: { bookingId, totalPrice, status: "PAYMENT_PENDING" },
      actorUserId: customerUserId,
      actorName: data.customerContact.name,
      actorRole: req.user?.role || "customer",
    });

    // 7. Dispatch notification
    await dispatchMultiChannelNotification({
      type: "BOOKING_RECEIVED",
      recipientEmail: data.customerContact.email,
      customerName: data.customerContact.name,
      bookingId,
    });

    res.status(201).json({
      booking: createdBooking,
      bookingId,
    });
  } catch (error: any) {
    req.log?.error({ err: error }, "Failed to create booking");
    res.status(500).json({ status: "error", message: error.message || "Failed to create booking." });
  }
});

// Package payments use the authenticated Razorpay order/verification flow in travel.ts.

router.get("/bookings/my-trips", requireAuth, async (req, res) => {
  const trips = await db.select().from(bookingsTable)
    .where(eq(bookingsTable.ownerId, req.user!.id))
    .orderBy(desc(bookingsTable.createdAt));
  res.json({ trips });
});

// --------------------------------------------------------------------------
// 4. Booking Detail & Timeline (Section 11 & 14)
// --------------------------------------------------------------------------
router.get("/bookings/:idOrBookingId", requireAuth, async (req, res) => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : "";

  try {

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          req.user!.role === "admin" ? undefined : eq(bookingsTable.ownerId, req.user!.id),
          isUuid(idOrBookingId)
            ? eq(bookingsTable.id, idOrBookingId)
            : eq(bookingsTable.bookingId, idOrBookingId),
        )
      )
      .limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    // Travellers
    const travellers = await db.select().from(travellersTable).where(eq(travellersTable.bookingId, booking.id));

    // Child service fulfilment tasks
    const tasks = await db
      .select({
        task: bookingServicesTable,
        vendorName: vendorsTable.businessName,
      })
      .from(bookingServicesTable)
      .leftJoin(vendorsTable, eq(bookingServicesTable.assignedVendorId, vendorsTable.id))
      .where(eq(bookingServicesTable.bookingId, booking.id))
      .orderBy(bookingServicesTable.createdAt);

    // Vouchers
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.bookingId, booking.id));

    // Compute Trip Confidence Score for assigned vendors (Step 3)
    const assignedVendorIds = tasks
      .map((t: any) => t.task.assignedVendorId)
      .filter(Boolean) as string[];

    let vendorMetrics: any[] = [];
    if (assignedVendorIds.length > 0) {
      vendorMetrics = await db
        .select({
          acceptanceRate: vendorsTable.acceptanceRate,
          avgResponseMinutes: vendorsTable.avgResponseMinutes,
          cancellationRate: vendorsTable.cancellationRate,
        })
        .from(vendorsTable)
        .where(inArray(vendorsTable.id, assignedVendorIds));
    }

    const confidence = computeTripConfidenceScore(
      vendorMetrics.length > 0
        ? vendorMetrics.map((v) => ({
          acceptanceRate: Number(v.acceptanceRate || 95),
          avgResponseMinutes: Number(v.avgResponseMinutes || 30),
          cancellationRate: Number(v.cancellationRate || 1),
        }))
        : { acceptanceRate: 98, avgResponseMinutes: 25, cancellationRate: 1 }
    );

    res.json({
      booking: {
        ...booking,
        travellers,
        services: tasks.map((t: any) => ({
          ...t.task,
          vendorName: t.vendorName || "Pending Vendor Assignment",
        })),
        vouchers,
        tripConfidenceScore: confidence,
      },
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch booking detail");
    res.status(500).json({ status: "error", message: "Failed to fetch booking detail." });
  }
});

// --------------------------------------------------------------------------
// 5. Cancellation Request Workflow (Section 10 & 15, ZEL-05)
// --------------------------------------------------------------------------
router.post("/bookings/:idOrBookingId/cancel", requireAuth, async (req, res) => {
  const idOrBookingId = String(req.params.idOrBookingId);

  const cancelSchema = z.object({
    reason: z.string().trim().max(500, "Reason must not exceed 500 characters").optional(),
  });
  const parsedBody = cancelSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      status: "invalid_request",
      message: "Invalid cancellation reason.",
      errors: parsedBody.error.issues,
    });
    return;
  }
  const reason = parsedBody.data.reason || "Customer cancellation request";

  try {
    const isStaff =
      req.user!.role === "admin" ||
      Boolean((req as any).admin) ||
      req.user!.role === "operations_manager" ||
      req.user!.role === "finance";


    const queryConditions = [
      isUuid(idOrBookingId) ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId),
    ];

    // Constrain lookup strictly to the authenticated owner/customer unless staff (AC1)
    if (!isStaff) {
      queryConditions.push(
        or(
          eq(bookingsTable.ownerId, req.user!.id),
          eq(bookingsTable.customerId, req.user!.id)
        )!
      );
    }

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(and(...queryConditions))
      .limit(1);

    if (!booking) {
      // Return 404 to avoid booking enumeration across users (AC1)
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    // AC2: Idempotent check
    if (
      booking.status === "CANCEL_REQUESTED" ||
      booking.status === "CANCELLED" ||
      booking.status === "DEMO_CANCELLED"
    ) {
      res.status(409).json({
        status: "conflict",
        message: "A cancellation request or cancellation has already been processed for this booking.",
      });
      return;
    }

    const [existingRefund] = await db
      .select()
      .from(refundsTable)
      .where(eq(refundsTable.bookingId, booking.id))
      .limit(1);

    if (existingRefund) {
      res.status(409).json({
        status: "conflict",
        message: "A refund has already been requested or processed for this booking.",
      });
      return;
    }

    // Sensible status rules
    if (booking.status === "COMPLETED") {
      res.status(400).json({ status: "invalid_status", message: "Completed bookings cannot be cancelled." });
      return;
    }

    const cancelPrice = booking.totalPrice || booking.amount || 0;

    // AC4: Booking update + refund insert in ONE database transaction
    const { updated, refund } = await db.transaction(async (tx: typeof db) => {
      const timeline = booking.timeline || [];
      timeline.push({
        event: "Cancellation requested by customer",
        timestamp: new Date().toISOString(),
        actor: req.user!.fullName || req.user!.email || "Customer",
        notes: reason,
      });

      const [upd] = await tx
        .update(bookingsTable)
        .set({
          status: "CANCEL_REQUESTED",
          cancellationReason: reason,
          cancellationRequestedAt: new Date(),
          timeline,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, booking.id))
        .returning();

      const [ref] = await tx
        .insert(refundsTable)
        .values({
          bookingId: booking.id,
          requestedByUserId: req.user!.id, // AC5: from authenticated user
          amount: cancelPrice,
          reason,
          status: "REQUESTED",
        })
        .returning();

      return { updated: upd, refund: ref };
    });

    await logAuditAction({
      action: "BOOKING_CANCEL_REQUESTED",
      resourceType: "booking",
      resourceId: booking.id,
      actorUserId: req.user!.id,
      actorName: req.user!.fullName || "Customer",
      previousValue: { status: booking.status },
      newValue: { status: "CANCEL_REQUESTED", reason, refundId: refund.id },
      actorRole: isStaff ? "staff" : "customer",
    });

    if (booking.customerContact?.email) {
      await dispatchMultiChannelNotification({
        type: "CANCELLATION_REFUND_UPDATE",
        recipientEmail: booking.customerContact.email,
        customerName: booking.customerContact.name,
        bookingId: booking.bookingId,
        message: "Your cancellation request has been received and is under review by our operations & finance team.",
      });
    }

    res.json({
      status: "success",
      booking: updated,
      refund,
      message: "Cancellation request received and forwarded to operations.",
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to cancel booking");
    res.status(500).json({ status: "error", message: "Failed to request cancellation." });
  }
});

// --------------------------------------------------------------------------
// 6. Consolidated Downloadable / Shareable Digital Itinerary (Section 14)
// --------------------------------------------------------------------------
router.get(["/bookings/:idOrBookingId/itinerary", "/bookings/:idOrBookingId/itinerary/download"], requireAuthOrAdmin, async (req, res) => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

  try {
    // Admin-portal sessions (req.admin) and staff-role customer sessions may open any itinerary;
    // everybody else only their own.
    const isStaff =
      Boolean(req.admin) ||
      req.user?.role === "admin" ||
      req.user?.role === "operations_manager" ||
      req.user?.role === "finance";

    const queryConditions = [
      isUuid(idOrBookingId) ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId),
    ];

    if (!isStaff) {
      queryConditions.push(
        or(
          eq(bookingsTable.ownerId, req.user!.id),
          eq(bookingsTable.customerId, req.user!.id)
        )!
      );
    }

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(and(...queryConditions))
      .limit(1);

    if (!booking) {
      res.status(404).send("Booking not found.");
      return;
    }

    const travellers = await db.select().from(travellersTable).where(eq(travellersTable.bookingId, booking.id));
    const tasks = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.bookingId, booking.id));
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.bookingId, booking.id));

    const host = req.get("host") || "zelevos.travel";
    const protocol = req.protocol || "https";
    const itineraryUrl = `${protocol}://${host}/api/bookings/${escapeHtml(booking.bookingId)}/itinerary`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(itineraryUrl)}`;

    // Generate clean printable HTML / PDF itinerary
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zelevos Itinerary - ${escapeHtml(booking.bookingId)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; background: #fff; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: -0.05em; }
    .badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 700; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    h2 { font-size: 18px; margin-top: 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 700; color: #64748b; }
    .qr-banner { display: flex; justify-content: space-between; align-items: center; gap: 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      .card { border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="logo">ZELEVOS</div>
      <small style="color: #64748b;">Curated Travel Marketplace · India</small>
    </div>
    <div style="text-align: right;">
      <div class="badge">${escapeHtml(booking.status)}</div>
      <div style="font-weight: 700; margin-top: 4px;">ID: ${escapeHtml(booking.bookingId)}</div>
    </div>
  </div>

  <div class="qr-banner">
    <div>
      <h3 style="margin: 0 0 4px; font-size: 16px; color: #1e3a8a;">Official Digital Travel Dossier</h3>
      <p style="margin: 0; font-size: 12px; color: #475569;">Verified by Zelevos Operations Concierge Desk. Scan QR code to authenticate live status.</p>
    </div>
    <img src="${qrCodeUrl}" style="width: 80px; height: 80px; border-radius: 6px; border: 1px solid #bfdbfe; background: #fff; padding: 3px;" alt="QR Code" />
  </div>

  <div class="card">
    <h2>Trip Overview</h2>
    <p><strong>Travel Date:</strong> ${escapeHtml(booking.travelDate || "To be scheduled")}</p>
    <p><strong>Lead Guest:</strong> ${escapeHtml(booking.customerContact?.name || "Valued Guest")}</p>
    <p><strong>Party Size:</strong> ${Number(booking.adultsCount) || 0} Adults, ${Number(booking.childrenCount) || 0} Children</p>
    <p><strong>Total Paid:</strong> ₹${Number(booking.totalPrice || 0).toLocaleString("en-IN")}</p>
    ${booking.flightPnr ? `<p><strong>Flight PNR:</strong> ${escapeHtml(booking.flightPnr)} (Confirmed)</p>` : booking.flightRequired ? `<p><strong>Flights:</strong> Requested (Subject to confirmation)</p>` : ""}
  </div>

  <div class="card">
    <h2>Confirmed Services & Fulfilment</h2>
    <table>
      <thead>
        <tr><th>Type</th><th>Description</th><th>Status</th><th>Ref / Voucher</th></tr>
      </thead>
      <tbody>
        ${tasks
        .map(
          (t: any) => `<tr>
            <td><strong>${escapeHtml(String(t.serviceType || "").toUpperCase())}</strong></td>
            <td>${escapeHtml(t.title)}</td>
            <td>${escapeHtml(t.status)}</td>
            <td>${escapeHtml(t.supplierConfirmationRef || "Verified by Zelevos")}</td>
          </tr>`
        )
        .join("")}
      </tbody>
    </table>
  </div>

  ${vouchers.length > 0 ? `
  <div class="card">
    <h2>Issued Vouchers</h2>
    <table>
      <thead>
        <tr><th>Code</th><th>Title</th><th>Valid Date</th><th>Digital Access</th></tr>
      </thead>
      <tbody>
        ${vouchers.map((v: any) => `<tr>
          <td><code>${escapeHtml(v.voucherCode)}</code></td>
          <td>${escapeHtml(v.title)}</td>
          <td>${escapeHtml(v.validFrom || "N/A")}</td>
          <td><a href="/api/vouchers/${escapeHtml(v.voucherCode)}" target="_blank" style="color: #2563eb; font-weight: 700; text-decoration: none;">View Voucher ↗</a></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <div class="card">
    <h2>Cancellation & Refund Policy (Section 14)</h2>
    <p style="font-size: 13px; color: #475569; margin: 0;">
      Free cancellation within 24 hours of booking, or up to 7 days before scheduled departure. In case of operational disruption or voluntary cancellation, refund requests submitted via My Trips are authorized and processed by Zelevos Finance within 48 business hours to your original payment method.
    </p>
  </div>

  <div class="footer">
    <p style="font-weight: 700; color: #1e293b;">Zelevos 24/7 Operations Ground Support & Emergency Concierge</p>
    <p>Toll-Free: +91 800-ZELEVOS · Direct Hotline: +91 11-4089-2121 · operations@zelevos.travel</p>
    <p style="margin-top: 10px;">Have a wonderful journey with Zelevos!</p>
  </div>
</body>
</html>`;

    const isDownload = req.query.download === "true" || req.path.endsWith("/download");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `${isDownload ? "attachment" : "inline"}; filename="Zelevos-Itinerary-${String(booking.bookingId).replace(/[^A-Za-z0-9_-]/g, "")}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).send("Failed to generate digital itinerary.");
  }
});

/**
 * GET /api/bookings/:idOrBookingId/milestones
 * Live booking milestone track (Section 23).
 */
router.get("/bookings/:idOrBookingId/milestones", requireAuthOrAdmin, async (req, res) => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

  try {
    const isStaff = Boolean(req.admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";
    const queryConditions = [
      isUuid(idOrBookingId) ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId),
    ];
    if (!isStaff) {
      queryConditions.push(or(eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.customerId, req.user!.id))!);
    }

    const [booking] = await db.select().from(bookingsTable).where(and(...queryConditions)).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    const tasks = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.bookingId, booking.id));
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.bookingId, booking.id));

    const isPaid = booking.paymentStatus === "CAPTURED" || booking.paymentStatus === "SUCCESSFUL" || (booking.status !== "PAYMENT_PENDING" && booking.status !== "CANCELLED");
    const verifiedTasksCount = tasks.filter((t: any) => t.customerFacingVerified && (t.status === "VERIFIED" || t.status === "CONFIRMED")).length;
    const allServicesVerified = tasks.length > 0 && verifiedTasksCount === tasks.length;
    const vouchersIssued = vouchers.length > 0;

    const milestones = [
      {
        step: 1,
        id: "BOOKING_RECEIVED",
        label: "Booking Created",
        description: `Order ${booking.bookingId} registered in Zelevos travel network`,
        status: "COMPLETED",
        timestamp: booking.createdAt,
      },
      {
        step: 2,
        id: "PAYMENT_CONFIRMED",
        label: "Payment Verified",
        description: isPaid ? `₹${Number(booking.totalPrice || 0).toLocaleString("en-IN")} secured via Razorpay` : "Awaiting secure online transaction",
        status: isPaid ? "COMPLETED" : "CURRENT",
        timestamp: isPaid ? booking.updatedAt : null,
      },
      {
        step: 3,
        id: "SUPPLIER_COORDINATION",
        label: "Supplier Assignment",
        description: tasks.length > 0 ? `${tasks.length} local inventory tasks assigned with SLA deadlines` : "Dispatching fulfillment requests to local partners",
        status: isPaid ? (tasks.length > 0 ? "COMPLETED" : "CURRENT") : "UPCOMING",
        timestamp: null,
      },
      {
        step: 4,
        id: "FLIGHT_TICKETED",
        label: "Flight PNR & Ticketing",
        description: !booking.flightRequired ? "Self-arranged travel / Not required" : booking.flightPnr ? `Airline PNR: ${booking.flightPnr}` : "Awaiting airline ticketing desk",
        status: !booking.flightRequired ? "NOT_REQUIRED" : booking.flightPnr ? "COMPLETED" : isPaid ? "CURRENT" : "UPCOMING",
        timestamp: null,
      },
      {
        step: 5,
        id: "SERVICES_CONFIRMED",
        label: "Hotel & Activity Verification",
        description: allServicesVerified ? "All suppliers confirmed & verified by operations desk" : `${verifiedTasksCount} of ${tasks.length} supplier services verified`,
        status: allServicesVerified ? "COMPLETED" : isPaid ? "CURRENT" : "UPCOMING",
        timestamp: null,
      },
      {
        step: 6,
        id: "VOUCHERS_ISSUED",
        label: "Digital Vouchers Ready",
        description: vouchersIssued ? `${vouchers.length} digital vouchers generated with QR check-in codes` : "Vouchers being assembled for instant check-in",
        status: vouchersIssued ? "COMPLETED" : allServicesVerified ? "CURRENT" : "UPCOMING",
        timestamp: null,
      },
      {
        step: 7,
        id: "TRIP_READY",
        label: "Consolidated Itinerary Finalized",
        description: (booking.status === "CONFIRMED" || vouchersIssued) ? "Full trip dossier & 24/7 concierge available" : "Final dossier will be ready upon complete confirmation",
        status: (booking.status === "CONFIRMED" || vouchersIssued) ? "COMPLETED" : "UPCOMING",
        timestamp: null,
      },
    ];

    res.json({
      status: "success",
      bookingId: booking.bookingId,
      bookingStatus: booking.status,
      milestones,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to load booking milestones." });
  }
});

// --------------------------------------------------------------------------
// 7. Payment Receipt & Tax Invoice Generation & Secure Download
// --------------------------------------------------------------------------
router.get(
  [
    "/bookings/:idOrBookingId/receipt",
    "/bookings/:idOrBookingId/receipt/download",
    "/receipt/:idOrBookingId",
    "/receipt/:idOrBookingId/download",
  ],
  requireAuthOrAdmin,
  async (req, res) => {
    const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

    try {
      const isStaff =
        Boolean(req.admin) ||
        req.user?.role === "admin" ||
        req.user?.role === "operations_manager" ||
        req.user?.role === "finance";

      const queryConditions = [
        isUuid(idOrBookingId) ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId),
      ];

      if (!isStaff) {
        queryConditions.push(
          or(
            eq(bookingsTable.ownerId, req.user!.id),
            eq(bookingsTable.customerId, req.user!.id)
          )!
        );
      }

      const [booking] = await db
        .select()
        .from(bookingsTable)
        .where(and(...queryConditions))
        .limit(1);

      if (!booking) {
        res.status(404).json({ status: "not_found", message: "Receipt not found or you are not authorized to view it." });
        return;
      }

      // Check if booking is paid
      const isPaid = booking.paymentStatus === "SUCCESSFUL" || booking.status === "PAID" || booking.status === "CONFIRMED";
      if (!isPaid) {
        res.status(400).json({ status: "unpaid", message: "Payment receipt is only available once payment has been verified." });
        return;
      }

      // Fetch verified payment record
      const [payment] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.bookingId, booking.id))
        .orderBy(desc(paymentsTable.createdAt))
        .limit(1);

      // Fetch transaction
      const [tx] = await db
        .select()
        .from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.bookingId, booking.id))
        .orderBy(desc(paymentTransactionsTable.createdAt))
        .limit(1);

      // Fetch custom trip if applicable
      const [customTrip] = await db
        .select()
        .from(customTripRequestsTable)
        .where(eq(customTripRequestsTable.bookingId, booking.id))
        .limit(1);

      // Fetch user profile for customer ID
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, booking.customerId || booking.ownerId || req.user!.id))
        .limit(1);

      let packageTitle = "Bespoke Travel Package";
      if (booking.packageId) {
        const [pkg] = await db.select({ title: packagesTable.title }).from(packagesTable).where(eq(packagesTable.id, booking.packageId)).limit(1);
        if (pkg) packageTitle = pkg.title;
      } else if (customTrip?.proposalTitle) {
        packageTitle = customTrip.proposalTitle;
      }

      const receiptNumber = payment?.receiptNumber || `REC-${booking.bookingId}`;
      const receiptDate = payment?.createdAt
        ? new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : new Date(booking.updatedAt || booking.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const receiptTime = payment?.createdAt
        ? new Date(payment.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "";

      const customerName = booking.customerContact?.name || user?.fullName || "Valued Customer";
      const customerEmail = booking.customerContact?.email || user?.email || "";
      const customerPhone = booking.customerContact?.phone || user?.phone || "";
      const customerId = user?.customerId || customTrip?.customerId || "ZLV-CUS-000001";

      const totalPaid = booking.totalPrice;
      const razorpayPaymentId = payment?.razorpayPaymentId || tx?.providerPaymentId || booking.paymentId || "pay_verified";
      const razorpayOrderId = payment?.razorpayOrderId || tx?.providerOrderId || booking.paymentOrderId || "order_verified";
      const destination = (customTrip?.destinations || []).join(", ") || (booking.travelDate ? "India Destination" : "Curated Destination");
      const travelDate = booking.travelDate || customTrip?.startDate || "As Scheduled";

      // If JSON format requested
      if (req.query.format === "json" || (req.headers.accept?.includes("application/json") && !req.path.endsWith("/download"))) {
        res.json({
          status: "success",
          receipt: {
            receiptNumber,
            receiptDate,
            receiptTime,
            customerName,
            customerId,
            customerEmail,
            customerPhone,
            bookingId: booking.bookingId,
            leadNumber: customTrip?.leadNumber || null,
            proposalId: customTrip?.id || null,
            destination,
            travelDate,
            description: packageTitle,
            baseAmount: totalPaid,
            taxAmount: 0,
            taxNote: "Inclusive of applicable GST",
            totalPaid,
            currency: "INR",
            paymentMethod: "Razorpay",
            razorpayPaymentId,
            razorpayOrderId,
            paymentStatus: "PAID",
          },
        });
        return;
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zelevos Payment Receipt - ${escapeHtml(receiptNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; line-height: 1.5; }
    .receipt-container { max-width: 820px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 24px; margin-bottom: 28px; }
    .brand { font-size: 32px; font-weight: 900; color: #2563eb; letter-spacing: -0.04em; }
    .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; font-weight: 700; margin-top: 2px; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
    .doc-num { font-family: monospace; font-size: 14px; font-weight: 700; color: #2563eb; margin-top: 4px; }
    .doc-date { font-size: 12px; color: #64748b; margin-top: 2px; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; background: #ecfdf5; color: #059669; font-weight: 800; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; border: 1px solid #a7f3d0; margin-top: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
    .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-val { color: #0f172a; font-weight: 700; text-align: right; }
    .table-container { margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    td { padding: 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .amount-cell { text-align: right; font-weight: 700; }
    .totals-row { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .totals-card { width: 340px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    .total-grand { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #0f172a; border-top: 2px solid #2563eb; padding-top: 10px; margin-top: 8px; }
    .payment-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-bottom: 28px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .payment-box-item { font-size: 12px; }
    .payment-box-item span { display: block; color: #1e40af; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .payment-box-item strong { display: block; color: #1e3a8a; font-family: monospace; font-size: 13px; margin-top: 2px; word-break: break-all; }
    .footer { text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .print-actions { display: flex; justify-content: center; gap: 12px; margin-bottom: 24px; }
    .btn { padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: #2563eb; color: #ffffff; border: none; }
    .btn-outline { background: #ffffff; color: #334155; border: 1px solid #cbd5e1; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .receipt-container { box-shadow: none; border: none; padding: 0; max-width: 100%; }
      .print-actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <a class="btn btn-outline" href="/api/bookings/${escapeHtml(booking.bookingId)}/receipt/download?download=true">📥 Download File</a>
  </div>

  <div class="receipt-container">
    <div class="header">
      <div>
        <div class="brand">ZELEVOS</div>
        <div class="brand-sub">Curated Travel Marketplace · India</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Zelevos Holidays Private Limited</div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">Payment Receipt & Invoice</div>
        <div class="doc-num">${escapeHtml(receiptNumber)}</div>
        <div class="doc-date">Date: ${escapeHtml(receiptDate)} ${escapeHtml(receiptTime)}</div>
        <div class="status-badge">✓ PAYMENT VERIFIED · PAID</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Billed To (Customer Details)</div>
        <div class="info-row"><span class="info-label">Customer ID</span><span class="info-val" style="font-family: monospace; color: #2563eb;">${escapeHtml(customerId)}</span></div>
        <div class="info-row"><span class="info-label">Name</span><span class="info-val">${escapeHtml(customerName)}</span></div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-val">${escapeHtml(customerEmail)}</span></div>
        ${customerPhone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-val">${escapeHtml(customerPhone)}</span></div>` : ""}
      </div>
      <div class="card">
        <div class="card-title">Booking & Custom Trip Details</div>
        <div class="info-row"><span class="info-label">Booking ID</span><span class="info-val" style="font-family: monospace;">${escapeHtml(booking.bookingId)}</span></div>
        ${customTrip ? `<div class="info-row"><span class="info-label">Custom Lead ID</span><span class="info-val" style="font-family: monospace;">${escapeHtml(customTrip.leadNumber)}</span></div>` : ""}
        <div class="info-row"><span class="info-label">Destination</span><span class="info-val">${escapeHtml(destination)}</span></div>
        <div class="info-row"><span class="info-label">Travel Date</span><span class="info-val">${escapeHtml(travelDate)}</span></div>
        <div class="info-row"><span class="info-label">Travellers</span><span class="info-val">${Number(booking.adultsCount) || 1} Adult(s)</span></div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 60%;">Description / Service Item</th>
            <th style="width: 20%; text-align: center;">Qty</th>
            <th style="width: 20%; text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong style="color: #0f172a; font-size: 14px;">${escapeHtml(packageTitle)}</strong>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                Destination: ${escapeHtml(destination)} · Travel Date: ${escapeHtml(travelDate)} · Verified Zelevos Itinerary
              </div>
            </td>
            <td style="text-align: center; color: #475569;">1 Trip</td>
            <td class="amount-cell">₹${Number(totalPaid).toLocaleString("en-IN")}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="totals-row">
      <div class="totals-card">
        <div class="info-row"><span class="info-label">Base Amount</span><span class="info-val">₹${Number(totalPaid).toLocaleString("en-IN")}</span></div>
        <div class="info-row"><span class="info-label">Taxes & Fees</span><span class="info-val" style="color: #059669;">Included</span></div>
        <div class="total-grand"><span>Total Paid</span><span>₹${Number(totalPaid).toLocaleString("en-IN")}</span></div>
      </div>
    </div>

    <div class="payment-box">
      <div class="payment-box-item">
        <span>Payment Method</span>
        <strong>Razorpay Secure Checkout</strong>
      </div>
      <div class="payment-box-item">
        <span>Payment Status</span>
        <strong style="color: #059669;">PAID / VERIFIED</strong>
      </div>
      <div class="payment-box-item">
        <span>Razorpay Payment ID</span>
        <strong>${escapeHtml(razorpayPaymentId)}</strong>
      </div>
      <div class="payment-box-item">
        <span>Razorpay Order ID</span>
        <strong>${escapeHtml(razorpayOrderId)}</strong>
      </div>
    </div>

    <div class="footer">
      <p style="font-weight: 700; color: #1e293b;">Thank you for booking with Zelevos!</p>
      <p style="margin-top: 4px;">This is a computer-generated tax receipt and does not require a physical signature.</p>
      <p style="margin-top: 4px; color: #94a3b8;">Zelevos Support: support@zelevos.travel · Toll-Free: +91 800-ZELEVOS</p>
    </div>
  </div>
</body>
</html>`;

      const isDownload = req.query.download === "true" || req.path.endsWith("/download");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `${isDownload ? "attachment" : "inline"}; filename="Zelevos_Payment_Receipt_${String(booking.bookingId).replace(/[^A-Za-z0-9_-]/g, "")}.html"`);
      res.send(html);
    } catch (error) {
      req.log?.error ? req.log.error({ err: error }, "Failed to generate payment receipt") : console.error("Receipt error:", error);
      res.status(500).send("Failed to generate payment receipt.");
    }
  }
);

export default router;

