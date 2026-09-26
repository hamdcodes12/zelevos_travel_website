import { Router, type IRouter } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
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
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  generateMasterBookingId,
  createFulfilmentTasksOnPayment,
  logAuditAction,
} from "../services/booking-engine";
import { computeTripConfidenceScore } from "../services/trip-confidence";
import { getPaymentProvider } from "../services/payment-service";
import { dispatchMultiChannelNotification } from "../services/email-service";

const router: IRouter = Router();

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

    if (!pkg) {
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
        .select({ id: partnersTable.id })
        .from(partnersTable)
        .where(and(eq(partnersTable.referralCode, data.referralCode.trim().toUpperCase()), eq(partnersTable.status, "approved")))
        .limit(1);
      if (partner) {
        partnerId = partner.id;
      }
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrBookingId);

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          req.user!.role === "admin" ? undefined : eq(bookingsTable.ownerId, req.user!.id),
          isUuid
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
        .where(sql`${vendorsTable.id} IN (${sql.raw(assignedVendorIds.map((id) => `'${id}'`).join(","))})`);
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
// 5. Cancellation Request Workflow (Section 10 & 15)
// --------------------------------------------------------------------------
router.post("/bookings/:idOrBookingId/cancel", async (req, res) => {
  const { idOrBookingId } = req.params;
  const { reason } = req.body;

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
      event: "Cancellation requested by customer",
      timestamp: new Date().toISOString(),
      actor: req.user?.fullName || booking.customerContact?.name || "Customer",
      notes: reason || "Customer initiated cancellation",
    });

    const [updated] = await db
      .update(bookingsTable)
      .set({
        status: "CANCEL_REQUESTED",
        cancellationReason: reason || "Customer cancellation request",
        cancellationRequestedAt: new Date(),
        timeline,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    // Auto-create refund request record for finance team review (Section 26)
    const [refund] = await db
      .insert(refundsTable)
      .values({
        bookingId: booking.id,
        requestedByUserId: req.user?.id || booking.customerId || booking.ownerId || null,
        amount: booking.totalPrice,
        reason: reason || "Customer cancellation request",
        status: "REQUESTED",
      })
      .returning();

    await logAuditAction({
      action: "BOOKING_CANCEL_REQUESTED",
      resourceType: "booking",
      resourceId: booking.id,
      previousValue: { status: booking.status },
      newValue: { status: "CANCEL_REQUESTED", reason, refundId: refund.id },
      actorRole: "customer",
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
      message: "Cancellation request received and forwarded to operations.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to request cancellation." });
  }
});

// --------------------------------------------------------------------------
// 6. Consolidated Downloadable / Shareable Digital Itinerary (Section 14)
// --------------------------------------------------------------------------
router.get(["/bookings/:idOrBookingId/itinerary", "/bookings/:idOrBookingId/itinerary/download"], async (req, res) => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrBookingId);

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(isUuid ? eq(bookingsTable.id, idOrBookingId) : eq(bookingsTable.bookingId, idOrBookingId))
      .limit(1);

    if (!booking) {
      res.status(404).send("Booking not found.");
      return;
    }

    const travellers = await db.select().from(travellersTable).where(eq(travellersTable.bookingId, booking.id));
    const tasks = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.bookingId, booking.id));
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.bookingId, booking.id));

    // Generate clean printable HTML / PDF itinerary
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zelevos Itinerary - ${booking.bookingId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: -0.05em; }
    .badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 700; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    h2 { font-size: 18px; margin-top: 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 700; color: #64748b; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">ZELEVOS</div>
      <small style="color: #64748b;">Curated Travel Marketplace · India</small>
    </div>
    <div style="text-align: right;">
      <div class="badge">${booking.status}</div>
      <div style="font-weight: 700; margin-top: 4px;">ID: ${booking.bookingId}</div>
    </div>
  </div>

  <div class="card">
    <h2>Trip Overview</h2>
    <p><strong>Travel Date:</strong> ${booking.travelDate || "To be scheduled"}</p>
    <p><strong>Lead Guest:</strong> ${booking.customerContact?.name || "Valued Guest"}</p>
    <p><strong>Party Size:</strong> ${booking.adultsCount} Adults, ${booking.childrenCount} Children</p>
    <p><strong>Total Paid:</strong> ₹${booking.totalPrice.toLocaleString("en-IN")}</p>
    ${booking.flightPnr ? `<p><strong>Flight PNR:</strong> ${booking.flightPnr} (Confirmed)</p>` : booking.flightRequired ? `<p><strong>Flights:</strong> Requested (Subject to confirmation)</p>` : ""}
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
            <td><strong>${t.serviceType.toUpperCase()}</strong></td>
            <td>${t.title}</td>
            <td>${t.status}</td>
            <td>${t.supplierConfirmationRef || "Verified by Zelevos"}</td>
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
        <tr><th>Code</th><th>Title</th><th>Valid Date</th></tr>
      </thead>
      <tbody>
        ${vouchers.map((v: any) => `<tr><td><code>${v.voucherCode}</code></td><td>${v.title}</td><td>${v.validFrom || "N/A"}</td></tr>`).join("")}
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
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `${isDownload ? "attachment" : "inline"}; filename="Zelevos-Itinerary-${booking.bookingId}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).send("Failed to generate digital itinerary.");
  }
});

export default router;
