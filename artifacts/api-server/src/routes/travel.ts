import crypto from "node:crypto";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { auditLogsTable, bookingServicesTable, bookingsTable, broadcastsTable, broadcastRecipientsTable, commissionsTable, db, generatedTripsTable, notificationsTable, partnersTable, paymentTransactionsTable, paymentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
// PARKED (Phase 1, 2026-09-19): Direct travel supplier / Duffel integration (flight-provider.ts) is parked per Wayora_PRD_Without_APIs. Manual operations fulfillment is used in V1. Do not re-enable without explicit instruction.
// import {
//   getFlightProvider,
//   type FlightOffer,
//   type PassengerDetails,
//   type ContactDetails,
// } from "../services/flight-provider";
import { getPaymentProvider } from "../services/payment-service";
import { createFulfilmentTasksOnPayment } from "../services/booking-engine";
import { getEmailService } from "../services/email-service";
import { findAirports } from "../services/airports-data";
import {
  autocompletePlaces,
  fetchStaticRouteMap,
  getRoute,
  GoogleMapsUnavailableError,
} from "../services/google-maps";
import {
  listExperiences,
  providerStatus,
  searchHotels,
  searchTransport,
} from "../services/providers";

const router: IRouter = Router();

function demoItemAmount(kind: "HOTEL" | "ACTIVITY" | "TRANSPORT", itemId: string, destination?: string): number | null {
  if (kind === "HOTEL") {
    const dest = destination || "Kashmir";
    const all = searchHotels({ destination: dest });
    return all.find((item) => item.id === itemId)?.pricePerNight ?? all[0]?.pricePerNight ?? null;
  }
  if (kind === "ACTIVITY") {
    const all = listExperiences({ destination: destination || "Kashmir" });
    return all.find((item) => item.id === itemId)?.price ?? all[0]?.price ?? null;
  }
  const all = searchTransport({ pickup: "Srinagar Airport", drop: "Gulmarg" });
  return all.find((item) => item.id === itemId)?.price ?? all[0]?.price ?? null;
}

// Helper to calculate age from date of birth string (YYYY-MM-DD)
function calculateAge(dobString: string, referenceDate: Date = new Date()): number {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const m = referenceDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function calculateBaggagePrice(extraBaggageKg = 0): number {
  const kg = Math.max(0, Math.min(30, Math.floor(extraBaggageKg / 5) * 5));
  return (kg / 5) * 1200;
}

function publicBookingRecord<T extends { kind?: string | null; payload?: Record<string, unknown> | null; fareSnapshot?: Record<string, unknown> | null }>(booking: T): T {
  if (booking.kind !== "HOTEL") return booking;
  const payload = { ...(booking.payload || {}) };
  const fareSnapshot = { ...(booking.fareSnapshot || {}) };
  delete payload.rateKey;
  delete fareSnapshot.rateKey;
  return { ...booking, payload, fareSnapshot };
}

router.post("/flights/requests", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({
    origin: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    departureDate: z.string().trim().min(8).max(20),
    returnDate: z.string().trim().max(20).optional(),
    travellers: z.coerce.number().int().min(1).max(9),
    cabin: z.enum(["Economy", "Premium Economy", "Business", "First"]),
    notes: z.string().trim().max(1000).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid manual flight request details.", errors: parsed.error.issues });
    return;
  }

  try {
    const bookingReference = `FL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [booking] = await db.insert(bookingsTable).values({
      bookingId: bookingReference,
      customerId: req.user!.id,
      ownerId: req.user!.id,
      kind: "FLIGHT",
      status: "PROCESSING",
      paymentStatus: "PENDING",
      providerMode: "MANUAL_FULFILLMENT",
      providerReference: "MANUAL_FLIGHT_DESK",
      bookingReference,
      flightRequired: true,
      flightStatus: "SUBJECT_TO_CONFIRMATION",
      travelDate: parsed.data.departureDate,
      amount: 0,
      totalPrice: 0,
      customerContact: {
        name: req.user!.fullName || req.user!.email,
        email: req.user!.email,
        phone: req.user!.phone || "",
      },
      contact: { email: req.user!.email },
      payload: {
        origin: parsed.data.origin,
        destination: parsed.data.destination,
        departureDate: parsed.data.departureDate,
        returnDate: parsed.data.returnDate || null,
        travellers: parsed.data.travellers,
        cabin: parsed.data.cabin,
        notes: parsed.data.notes || "",
      },
      timeline: [{
        event: "FLIGHT_REQUEST_RECEIVED",
        timestamp: new Date().toISOString(),
        actor: "Customer",
        notes: "Manual flight fulfillment requested.",
      }],
    }).returning();

    const [task] = await db.insert(bookingServicesTable).values({
      bookingId: booking.id,
      serviceType: "flight_partner",
      title: `Manual Flight Desk - ${parsed.data.origin} to ${parsed.data.destination}`,
      status: "REQUESTED",
      notes: parsed.data.notes || null,
      requestedAt: new Date(),
    }).returning();

    await db.insert(auditLogsTable).values({
      actorUserId: req.user!.id,
      action: "FLIGHT_REQUEST_CREATED",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: { bookingReference, taskId: task.id },
    });

    res.status(201).json({ status: "success", booking, task, message: "Flight request sent to the manual operations desk." });
  } catch (error) {
    req.log.error({ err: error }, "Manual flight request failed");
    res.status(500).json({ status: "error", message: "Flight request could not be submitted." });
  }
});

// --------------------------------------------------------------------------
// 1. Provider Status
// --------------------------------------------------------------------------
router.get("/providers/status", (_req, res) => {
  let paymentProviderName = "Razorpay";
  let paymentProviderMode: "LIVE" | "TEST" = "LIVE";
  let paymentsReady = true;

  try {
    const paymentProvider = getPaymentProvider();
    paymentProviderName = paymentProvider.name;
    paymentProviderMode = paymentProvider.mode;
  } catch {
    const isRazorpay = (process.env.PAYMENT_PROVIDER || "").toLowerCase().trim() === "razorpay";
    paymentProviderName = isRazorpay ? "Razorpay" : "Test Payment Engine";
    paymentProviderMode = isRazorpay ? "LIVE" : "TEST";
    paymentsReady = false;
  }

  res.json({
    status: {
      flights: "PARKED (Manual Ops Fulfillment Desk)",
      hotels: providerStatus().hotels,
      activities: providerStatus().activities,
      transport: providerStatus().transport,
      payments: `${paymentProviderName} (${paymentsReady ? paymentProviderMode : "NOT_CONFIGURED"})`,
    },
    mode: {
      flights: "MANUAL_FULFILLMENT",
      payments: paymentProviderMode,
    },
    note: "API-Free V1 active. Direct supplier APIs parked per Wayora_PRD_Without_APIs. Manual ops fulfillment is used.",
  });
});

// --------------------------------------------------------------------------
// 1b. Airport & City Search Autocomplete
// --------------------------------------------------------------------------
router.get("/flights/airports", (req, res): void => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const exclude = typeof req.query.exclude === "string" ? req.query.exclude : undefined;
  const results = findAirports(query, exclude);
  res.json({ results, airports: results });
});

// --------------------------------------------------------------------------
// 1c. Google Maps location and route services (server-side key only)
// --------------------------------------------------------------------------
router.get("/maps/autocomplete", async (req, res): Promise<void> => {
  const query = z.object({
    input: z.string().trim().min(2),
    sessionToken: z.string().trim().min(8).max(200).optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ status: "invalid_request", message: "At least two location characters are required." });
    return;
  }

  try {
    res.json({ results: await autocompletePlaces(query.data.input, query.data.sessionToken) });
  } catch (error) {
    const status = error instanceof GoogleMapsUnavailableError ? 503 : 502;
    req.log.warn({ status }, "Google Maps autocomplete unavailable");
    res.status(status).json({ status: "maps_unavailable", message: error instanceof Error ? error.message : "Location search is unavailable.", results: [] });
  }
});

router.get("/maps/route", async (req, res): Promise<void> => {
  const query = z.object({
    origin: z.string().trim().min(2),
    destination: z.string().trim().min(2),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ status: "invalid_request", message: "Origin and destination are required." });
    return;
  }

  try {
    res.json({ route: await getRoute(query.data.origin, query.data.destination) });
  } catch (error) {
    const status = error instanceof GoogleMapsUnavailableError ? 503 : 502;
    req.log.warn({ status }, "Google Maps route unavailable");
    res.status(status).json({ status: "maps_unavailable", message: error instanceof Error ? error.message : "Route information is unavailable." });
  }
});

router.get("/maps/static", async (req, res): Promise<void> => {
  const query = z.object({
    origin: z.string().trim().min(2),
    destination: z.string().trim().min(2),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).type("text/plain").send("Origin and destination are required.");
    return;
  }

  try {
    const route = await getRoute(query.data.origin, query.data.destination);
    const image = await fetchStaticRouteMap(route);
    res.set("Cache-Control", "public, max-age=300");
    res.type("image/png").send(image);
  } catch (error) {
    const status = error instanceof GoogleMapsUnavailableError ? 503 : 502;
    req.log.warn({ status }, "Google Maps static map unavailable");
    res.status(status).type("text/plain").send("Map image is currently unavailable.");
  }
});

// PARKED (Phase 1, 2026-09-19): Direct travel supplier flight routes (/flights/search, /flights/revalidate) are parked per Wayora_PRD_Without_APIs. Manual operations fulfillment desk is used for flights. Do not re-enable without explicit instruction.
/*
// --------------------------------------------------------------------------
// 2. Flight Search
// --------------------------------------------------------------------------
router.get("/flights/search", async (req, res): Promise<void> => {
  const query = z.object({
    from: z.string().trim().min(2).default("DEL"),
    to: z.string().trim().min(2).default("BOM"),
    departure: z.string().trim().default(new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0]),
    returnDate: z.string().trim().optional(),
    travellers: z.coerce.number().int().min(1).max(12).default(1),
    adults: z.coerce.number().int().min(1).max(9).optional(),
    children: z.coerce.number().int().min(0).max(8).optional(),
    infants: z.coerce.number().int().min(0).max(4).optional(),
    cabin: z.string().trim().default("Economy"),
  }).safeParse(req.query);

  if (!query.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid flight search parameters.", errors: query.error.issues });
    return;
  }

  if (query.data.from.toUpperCase() === query.data.to.toUpperCase()) {
    res.status(400).json({ status: "invalid_request", message: "Origin and destination cannot be the same airport." });
    return;
  }

  try {
    const flightProvider = getFlightProvider();
    const results = await flightProvider.search(query.data);
    res.json({
      provider: flightProvider.name,
      mode: flightProvider.mode,
      count: results.length,
      results,
      flights: results,
    });
  } catch (error) {
    req.log.error({ err: error }, "Flight search failed");
    res.status(500).json({
      status: "provider_error",
      message: error instanceof Error ? error.message : "Flight search encountered an error.",
      results: [],
    });
  }
});

// --------------------------------------------------------------------------
// 3. Flight Fare & Seat Revalidation
// --------------------------------------------------------------------------
router.post("/flights/revalidate", async (req, res): Promise<void> => {
  const schema = z.object({
    offerId: z.string().trim().min(1, "Offer ID is required"),
    expectedPrice: z.coerce.number().positive().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Offer ID is required.", errors: parsed.error.issues });
    return;
  }

  try {
    const flightProvider = getFlightProvider();
    const result = await flightProvider.revalidate(parsed.data.offerId, parsed.data.expectedPrice);
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Flight revalidation failed");
    res.status(500).json({
      valid: false,
      priceChanged: false,
      oldPrice: parsed.data.expectedPrice || 0,
      newPrice: parsed.data.expectedPrice || 0,
      soldOut: true,
      currency: "INR",
      offerId: parsed.data.offerId,
      message: error instanceof Error ? error.message : "Revalidation failed.",
    });
  }
});
*/

// --------------------------------------------------------------------------
// 4. Payment Creation & Verification Endpoints
// --------------------------------------------------------------------------
router.post("/payments/order", requireAuth, async (req, res): Promise<void> => {
  const schema = z.object({
    amount: z.coerce.number().int().positive().max(10_000_000).optional(),
    currency: z.string().trim().default("INR"),
    receipt: z.string().trim().optional(),
    notes: z.record(z.string(), z.string()).optional(),
    offerId: z.string().trim().min(1).optional(),
    bookingId: z.string().uuid().optional(),
    travellerCount: z.coerce.number().int().min(1).max(9).optional(),
    extraBaggageKg: z.coerce.number().int().min(0).max(30).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Valid payment details are required.", errors: parsed.error.issues });
    return;
  }

  try {
    const paymentProvider = getPaymentProvider();
    let requestedAmount = parsed.data.amount || 0;
    let packageBooking: typeof bookingsTable.$inferSelect | undefined;
    if (parsed.data.bookingId) {
      [packageBooking] = await db.select().from(bookingsTable).where(and(
        eq(bookingsTable.id, parsed.data.bookingId),
        eq(bookingsTable.ownerId, req.user!.id),
      )).limit(1);
      if (!packageBooking) {
        res.status(404).json({ status: "not_found", message: "Booking not found." });
        return;
      }
      if (packageBooking.status !== "PAYMENT_PENDING" || packageBooking.paymentStatus !== "PENDING") {
        res.status(409).json({ status: "invalid_state", message: "This booking is not awaiting payment." });
        return;
      }
      requestedAmount = packageBooking.totalPrice;
    }
    if (!requestedAmount) {
      res.status(400).json({ status: "invalid_request", message: "Valid amount is required." });
      return;
    }
    const receipt = parsed.data.receipt || `rcpt_${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = parsed.data.idempotencyKey || `payment-${req.user!.id}-${packageBooking?.id || receipt}`;
    const [existing] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.idempotencyKey, idempotencyKey)).limit(1);
    if (existing?.providerOrderId) {
      res.status(200).json({
        orderId: existing.providerOrderId,
        amount: existing.amount,
        amountSubunits: existing.amount * 100,
        currency: existing.currency,
        keyId: paymentProvider.keyId,
        provider: existing.provider,
        transactionId: existing.id,
        status: existing.status,
      });
      return;
    }
    const order = await paymentProvider.createOrder({
      amount: requestedAmount,
      currency: "INR",
      receipt,
      notes: {
        userId: req.user!.id,
        ...parsed.data.notes,
        ...(parsed.data.offerId ? { offerId: parsed.data.offerId } : {}),
        ...(parsed.data.travellerCount ? { travellerCount: String(parsed.data.travellerCount) } : {}),
        ...(parsed.data.extraBaggageKg ? { extraBaggageKg: String(parsed.data.extraBaggageKg) } : {}),
      },
    });
    const [transaction] = await db.insert(paymentTransactionsTable).values({
      userId: req.user!.id,
      provider: order.provider,
      providerOrderId: order.orderId,
      amount: requestedAmount,
      requestedAmount,
      currency: order.currency,
      status: "CREATED",
      idempotencyKey,
      metadata: parsed.data.notes || {},
      bookingId: packageBooking?.id,
    }).returning();
    if (packageBooking) {
      await db.update(bookingsTable).set({
        paymentOrderId: order.orderId,
        updatedAt: new Date(),
      }).where(and(eq(bookingsTable.id, packageBooking.id), eq(bookingsTable.status, "PAYMENT_PENDING")));
    }
    res.status(201).json({ ...order, transactionId: transaction.id, status: "CREATED" });
  } catch (error) {
    req.log.error({ err: error }, "Payment order creation failed");
    res.status(500).json({ status: "payment_error", message: error instanceof Error ? error.message : "Could not create payment order." });
  }
});

router.post("/payments/verify", requireAuth, async (req, res): Promise<void> => {
  const schema = z.object({
    orderId: z.string().trim().min(1),
    paymentId: z.string().trim().min(1),
    signature: z.string().trim().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "orderId, paymentId, and signature are required." });
    return;
  }

  try {
    const paymentProvider = getPaymentProvider();
    const result = await paymentProvider.verifyPayment(parsed.data);
    if (!result.verified) {
      res.status(400).json({ status: "verification_failed", verified: false, message: result.error || "Payment verification failed." });
      return;
    }
    const [transaction] = await db.select().from(paymentTransactionsTable).where(and(
      eq(paymentTransactionsTable.userId, req.user!.id),
      eq(paymentTransactionsTable.providerOrderId, parsed.data.orderId),
    )).limit(1);
    if (!transaction && paymentProvider.mode === "LIVE") {
      res.status(400).json({ status: "verification_failed", verified: false, message: "Payment order was not found for this account." });
      return;
    }
    if (transaction && transaction.provider !== "razorpay" && paymentProvider.mode === "LIVE") {
      res.status(409).json({ status: "verification_failed", verified: false, message: "Payment provider does not match the created order." });
      return;
    }
    if (transaction && transaction.currency !== "INR") {
      res.status(409).json({ status: "verification_failed", verified: false, message: "Payment currency does not match the created order." });
      return;
    }
    if (transaction && paymentProvider.mode === "LIVE" && paymentProvider.verifyPaymentDetails) {
      const details = await paymentProvider.verifyPaymentDetails(parsed.data, {
        amount: transaction.amount,
        currency: transaction.currency,
      });
      if (!details.verified) {
        res.status(400).json({ status: "verification_failed", verified: false, message: details.error || "Razorpay payment details could not be verified." });
        return;
      }
    }
    if (transaction?.status === "CAPTURED" && transaction.providerPaymentId === parsed.data.paymentId) {
      res.json({ ...result, duplicate: true });
      return;
    }
    if (transaction?.providerPaymentId && transaction.providerPaymentId !== parsed.data.paymentId) {
      res.status(409).json({ status: "verification_failed", verified: false, message: "This payment order is already linked to another payment." });
      return;
    }
    const [duplicatePayment] = await db.select({ id: paymentTransactionsTable.id }).from(paymentTransactionsTable).where(and(
      eq(paymentTransactionsTable.provider, "razorpay"),
      eq(paymentTransactionsTable.providerPaymentId, parsed.data.paymentId),
      ne(paymentTransactionsTable.id, transaction?.id || "00000000-0000-0000-0000-000000000000"),
    )).limit(1);
    if (duplicatePayment) {
      res.status(409).json({ status: "verification_failed", verified: false, message: "This Razorpay payment is already linked to another order." });
      return;
    }
    let ownedBooking: typeof bookingsTable.$inferSelect | undefined;
    if (transaction?.bookingId) {
      [ownedBooking] = await db.select().from(bookingsTable).where(and(
        eq(bookingsTable.id, transaction.bookingId),
        eq(bookingsTable.ownerId, req.user!.id),
      )).limit(1);
      if (!ownedBooking || ownedBooking.paymentOrderId !== parsed.data.orderId || ownedBooking.totalPrice !== transaction.amount) {
        res.status(409).json({ status: "verification_failed", verified: false, message: "Payment amount or booking ownership does not match the created order." });
        return;
      }
    }
    if (transaction) {
      const [capturedTransaction] = await db.update(paymentTransactionsTable).set({
        providerPaymentId: parsed.data.paymentId,
        status: "CAPTURED",
        capturedAmount: transaction.amount,
        updatedAt: new Date(),
      }).where(and(
        eq(paymentTransactionsTable.id, transaction.id),
        eq(paymentTransactionsTable.status, "CREATED"),
      )).returning();
      if (!capturedTransaction && transaction.status !== "CAPTURED") {
        res.status(409).json({ status: "payment_state_changed", verified: false, message: "Payment state changed while it was being confirmed." });
        return;
      }

      if (transaction.bookingId) {
        const booking = ownedBooking!;
        if (booking.status === "PAYMENT_PENDING" && booking.paymentStatus === "PENDING") {
          const timeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
          timeline.push({
            event: `Payment of ₹${booking.totalPrice.toLocaleString("en-IN")} captured successfully`,
            timestamp: new Date().toISOString(),
            actor: "Razorpay",
            notes: `Ref: ${parsed.data.paymentId}`,
          });
          await db.insert(paymentsTable).values({
            bookingId: booking.id,
            userId: req.user!.id,
            provider: "razorpay",
            razorpayOrderId: parsed.data.orderId,
            razorpayPaymentId: parsed.data.paymentId,
            razorpaySignature: parsed.data.signature,
            amount: transaction.amount,
            currency: transaction.currency,
            status: "SUCCESSFUL",
            verificationStatus: "VERIFIED",
            receiptNumber: `REC-${booking.bookingId}`,
          });
          const [updatedBooking] = await db.update(bookingsTable).set({
            status: "PAID",
            paymentId: parsed.data.paymentId,
            paymentStatus: "SUCCESSFUL",
            timeline,
            updatedAt: new Date(),
          }).where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "PAYMENT_PENDING"))).returning();
          if (updatedBooking) {
            if (updatedBooking.partnerId) {
              const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, updatedBooking.partnerId)).limit(1);
              if (partner) {
                await db.insert(commissionsTable).values({
                  partnerId: partner.id,
                  bookingId: updatedBooking.id,
                  bookingAmount: updatedBooking.totalPrice,
                  commissionPercent: partner.commissionRatePercent,
                  commissionAmount: Math.round((updatedBooking.totalPrice * Number(partner.commissionRatePercent)) / 100),
                  status: "PENDING",
                });
              }
            }
            await createFulfilmentTasksOnPayment(updatedBooking.bookingId || updatedBooking.id);
          }
        }
      }
    }
    // Audit log for payment verification
    try {
      await db.insert(auditLogsTable).values({
        actorUserId: req.user!.id,
        action: "PAYMENT_VERIFIED",
        resourceType: "payment_transaction",
        resourceId: parsed.data.orderId,
        ipAddress: req.ip,
        metadata: { orderId: parsed.data.orderId, paymentId: parsed.data.paymentId },
      });
    } catch (_) { /* non-critical */ }
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Payment verification error");
    res.status(500).json({ status: "payment_error", message: error instanceof Error ? error.message : "Verification error." });
  }
});

router.post("/payments/cancel", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({
    orderId: z.string().trim().min(1),
    reason: z.string().trim().max(200).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "A payment order ID is required." });
    return;
  }

  try {
    const [transaction] = await db.select().from(paymentTransactionsTable).where(and(
      eq(paymentTransactionsTable.userId, req.user!.id),
      eq(paymentTransactionsTable.providerOrderId, parsed.data.orderId),
    )).limit(1);

    if (!transaction) {
      res.status(404).json({ status: "not_found", message: "Payment order was not found." });
      return;
    }
    if (transaction.status === "CAPTURED" || transaction.status === "REFUNDED") {
      res.status(409).json({ status: "already_processed", message: "This payment order has already been processed." });
      return;
    }

    const [updated] = await db.update(paymentTransactionsTable).set({
      status: "CANCELLED",
      failureReason: parsed.data.reason || "Checkout was cancelled before payment capture.",
      updatedAt: new Date(),
    }).where(and(
      eq(paymentTransactionsTable.id, transaction.id),
      eq(paymentTransactionsTable.status, "CREATED"),
    )).returning();

    res.json({ status: updated?.status || transaction.status, duplicate: !updated });
  } catch (error) {
    req.log.error({ err: error }, "Payment cancellation update failed");
    res.status(500).json({ status: "payment_error", message: "Could not update payment status." });
  }
});

// --------------------------------------------------------------------------
// 5. Real Flight Booking (End-to-End Orchestration)
// --------------------------------------------------------------------------
const passengerSchema = z.object({
  type: z.enum(["ADULT", "CHILD", "INFANT"]),
  title: z.enum(["Mr", "Mrs", "Ms", "Dr", "Master", "Miss"]),
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  nationality: z.string().trim().min(2).max(50).default("IN"),
  passportNumber: z.string().trim().optional(),
  passportExpiry: z.string().trim().optional(),
  passportCountry: z.string().trim().optional(),
});

// PARKED (Phase 1, 2026-09-19): Direct flight booking endpoint (/flights/book) is parked per Wayora_PRD_Without_APIs. Package flight assistance is fulfilled manually via operations desk. Do not re-enable without explicit instruction.
/*
const flightBookingRequestSchema = z.object({
  offerId: z.string().trim().min(1, "Flight offer ID is required"),
  passengers: z.array(passengerSchema).min(1, "At least one passenger is required").max(9),
  contact: z.object({
    email: z.string().email("Valid email is required"),
    phone: z.string().trim().min(7, "Valid phone is required").max(15),
    countryCode: z.string().trim().default("+91"),
  }),
  addons: z.object({
    extraBaggageKg: z.number().optional(),
    extraBaggagePrice: z.number().optional(),
    mealPreference: z.string().optional(),
    seatPreference: z.string().optional(),
  }).optional(),
  payment: z.object({
    orderId: z.string().trim().min(1),
    paymentId: z.string().trim().min(1),
    signature: z.string().trim().min(1),
  }),
  idempotencyKey: z.string().trim().min(4, "Idempotency key required"),
});

router.post("/flights/book", requireAuth, async (req, res): Promise<void> => {
  const parsed = flightBookingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: "validation_error",
      message: "Flight booking details are invalid.",
      errors: parsed.error.issues,
    });
    return;
  }

  const { offerId, passengers, contact, addons, payment, idempotencyKey } = parsed.data;

  // Passenger age rules validation
  const adultCount = passengers.filter(p => p.type === "ADULT").length;
  const childCount = passengers.filter(p => p.type === "CHILD").length;
  const infantCount = passengers.filter(p => p.type === "INFANT").length;

  if (adultCount < 1) {
    res.status(400).json({ status: "validation_error", message: "At least one adult traveller is required per booking." });
    return;
  }
  if (infantCount > adultCount) {
    }
    if (p.type === "CHILD" && (age < 2 || age >= 12)) {
      res.status(400).json({
        status: "validation_error",
        message: `Passenger ${p.firstName} ${p.lastName} is registered as Child but age is ${age} (Children must be 2-11 years old).`,
      });
      return;
    }
    if (p.type === "INFANT" && age >= 2) {
      res.status(400).json({
        status: "validation_error",
        message: `Passenger ${p.firstName} ${p.lastName} is registered as Infant but age is ${age} (Infants must be under 2 years old).`,
      });
      return;
    }

    // Passport expiry check if provided
    if (p.passportExpiry) {
      const expiry = new Date(p.passportExpiry);
      if (expiry <= today) {
        res.status(400).json({
          status: "validation_error",
          message: `Passport for ${p.firstName} ${p.lastName} has expired (${p.passportExpiry}).`,
        });
        return;
      }
    }
  }

  // 1. Idempotency Check
  try {
    const [existingBooking] = await db.select().from(bookingsTable)
      .where(and(
        eq(bookingsTable.ownerId, req.user!.id),
        eq(bookingsTable.idempotencyKey, idempotencyKey)
      ));

    if (existingBooking) {
      res.status(200).json({
        success: true,
        booking: existingBooking,
        pnr: existingBooking.pnr,
        ticketNumber: existingBooking.ticketNumber,
        message: "Booking already completed (idempotent response).",
      });
      return;
    }
  } catch (error) {
    req.log.error({ err: error }, "Idempotency lookup error");
  }

  // 2. Verify Payment
  const paymentProvider = getPaymentProvider();
  const paymentVerification = await paymentProvider.verifyPayment(payment);
  if (!paymentVerification.verified) {
    res.status(400).json({
      status: "payment_verification_failed",
      message: paymentVerification.error || "Payment could not be verified. Booking cancelled.",
    });
    return;
  }

  // 3. Flight Provider Revalidation & Seat Check
  const flightProvider = getFlightProvider();
  const reval = await flightProvider.revalidate(offerId);
  if (!reval.valid || reval.soldOut) {
    // Attempt automatic refund since payment was captured but flight is sold out
    req.log.warn({ offerId, reval }, "Flight offer sold out or invalid after payment");
    const refundResult = await paymentProvider.refund({
      paymentId: payment.paymentId,
      amount: reval.oldPrice || 1000,
      reason: "Flight seats sold out during booking checkout.",
    });

    await db.update(paymentTransactionsTable).set({
      status: refundResult.success ? "REFUNDED" : "REFUND_PENDING",
      refundStatus: refundResult.status,
      refundAmount: refundResult.success ? (reval.oldPrice || 1000) : 0,
      failureReason: refundResult.success ? null : refundResult.message,
      updatedAt: new Date(),
    }).where(and(
      eq(paymentTransactionsTable.userId, req.user!.id),
      eq(paymentTransactionsTable.providerOrderId, payment.orderId),
    ));

    res.status(409).json({
      status: "flight_sold_out",
      message: refundResult.success
        ? "The selected flight became sold out before confirmation. Your payment has been automatically refunded."
        : "The selected flight became sold out before confirmation. Your payment is queued for refund reconciliation.",
    });
    return;
  }

  if (paymentProvider.mode === "LIVE") {
    const [transaction] = await db.select().from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.userId, req.user!.id), eq(paymentTransactionsTable.providerOrderId, payment.orderId)))
      .limit(1);
    const expectedAmount = (reval.newPrice * passengers.length) + calculateBaggagePrice(addons?.extraBaggageKg);
    if (!transaction || transaction.amount !== expectedAmount) {
      res.status(409).json({ status: "payment_quote_mismatch", message: "The payment amount does not match the current server-side flight quote." });
      return;
    }
    if (transaction.status !== "CAPTURED" || transaction.providerPaymentId !== payment.paymentId) {
      res.status(409).json({ status: "payment_not_captured", message: "The payment must be captured and verified before booking confirmation." });
      return;
    }
  }

  // 4. Create Supplier Booking & Issue Ticket / PNR
  try {
    const confirmation = await flightProvider.createBooking({
      offerId,
      passengers: passengers as PassengerDetails[],
      contact: contact as ContactDetails,
      addons,
      idempotencyKey,
    });

    if (!confirmation.success || (confirmation.status as any) === "FAILED") {
      // Record failed booking with refund pending
      const [failedBooking] = await db.insert(bookingsTable).values({
        bookingId: `ZL${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
        ownerId: req.user!.id,
        kind: "FLIGHT",
        status: "FAILED",
        providerMode: flightProvider.mode,
        providerReference: confirmation.bookingReference || "FAILED",
        bookingReference: `WAY-FAIL-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        pnr: "UNISSUED",
        flightOfferId: offerId,
        amount: confirmation.amount || 0,
        passengers: passengers as unknown[],
        contact: contact as Record<string, unknown>,
        paymentId: payment.paymentId,
        paymentOrderId: payment.orderId,
        paymentStatus: "REFUND_PENDING",
        idempotencyKey,
        payload: { error: confirmation.message || "Provider booking failed" },
      }).returning();

      // Trigger automatic refund
      const refundResult = await paymentProvider.refund({
        paymentId: payment.paymentId,
        amount: confirmation.amount || 0,
        reason: "Airline reservation failed",
      });
      await db.update(paymentTransactionsTable).set({
        status: refundResult.success ? "REFUNDED" : "REFUND_PENDING",
        refundStatus: refundResult.status,
        refundAmount: refundResult.success ? (confirmation.amount || 0) : 0,
        failureReason: refundResult.success ? null : refundResult.message,
        updatedAt: new Date(),
      }).where(and(
        eq(paymentTransactionsTable.userId, req.user!.id),
        eq(paymentTransactionsTable.providerOrderId, payment.orderId),
      ));

      res.status(502).json({
        status: "provider_booking_failed",
        message: confirmation.message || "The airline could not confirm your booking. A refund has been issued.",
        booking: failedBooking,
      });
      return;
    }

    // 5. Persist Confirmed Booking in Database
    const emailService = getEmailService();
    const clientBookingEmail = emailService.getConfig().clientBookingEmail;

    const [booking] = await db.insert(bookingsTable).values({
      bookingId: `ZL${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
      ownerId: req.user!.id,
      kind: "FLIGHT",
      status: "CONFIRMED",
      providerMode: flightProvider.mode,
      providerReference: confirmation.bookingReference,
      bookingReference: `WAY-${confirmation.pnr}`,
      pnr: confirmation.pnr,
      ticketNumber: confirmation.ticketNumber,
      flightOfferId: offerId,
      amount: confirmation.amount,
      fareSnapshot: (reval.flight || {}) as Record<string, unknown>,
      passengers: passengers as unknown[],
      contact: contact as Record<string, unknown>,
      segments: confirmation.segments as unknown[],
      addons: (addons || {}) as Record<string, unknown>,
      paymentId: payment.paymentId,
      paymentOrderId: payment.orderId,
      paymentStatus: "CAPTURED",
      idempotencyKey,
      emailStatus: "PENDING",
      clientEmail: clientBookingEmail,
      payload: {
        airline: confirmation.airline,
        cabin: reval.flight?.cabinClass || "Economy",
        refundable: reval.flight?.refundable ?? true,
      },
    }).returning();

    await db.update(paymentTransactionsTable).set({
      bookingId: booking.id,
      updatedAt: new Date(),
    }).where(and(
      eq(paymentTransactionsTable.userId, req.user!.id),
      eq(paymentTransactionsTable.providerOrderId, payment.orderId),
    ));

    // 6. Non-blocking Client Email Notification (Email failure must NOT corrupt confirmed booking)
    try {
      const emailResult = await emailService.sendBookingConfirmation(booking);
      req.log.info({ emailResult }, "Dispatched flight booking confirmation email");

      if (emailResult.success) {
        const [updated] = await db.update(bookingsTable).set({
          emailStatus: emailResult.status === "SENT" ? "SENT" : emailResult.status,
          emailSentAt: new Date(),
          clientEmail: emailResult.recipient,
          emailError: null,
          updatedAt: new Date(),
        }).where(eq(bookingsTable.id, booking.id)).returning();

        if (updated) {
          booking.emailStatus = updated.emailStatus;
          booking.emailSentAt = updated.emailSentAt;
          booking.clientEmail = updated.clientEmail;
        }
      } else {
        await db.update(bookingsTable).set({
          emailStatus: emailResult.status,
          emailError: emailResult.error || "Email delivery failed",
          clientEmail: emailResult.recipient,
          updatedAt: new Date(),
        }).where(eq(bookingsTable.id, booking.id));

        booking.emailStatus = emailResult.status;
        booking.emailError = emailResult.error;
      }
    } catch (emailErr: any) {
      req.log.error({ err: emailErr }, "Unexpected exception dispatching booking email");
      await db.update(bookingsTable).set({
        emailStatus: "FAILED",
        emailError: emailErr?.message || String(emailErr),
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id));

      booking.emailStatus = "FAILED";
      booking.emailError = emailErr?.message || String(emailErr);
    }

    // 6b. Audit log + user notification (non-blocking)
    try {
      await Promise.all([
        db.insert(auditLogsTable).values({
          actorUserId: req.user!.id,
          action: "FLIGHT_BOOKING_CONFIRMED",
          resourceType: "booking",
          resourceId: booking.id,
          ipAddress: req.ip,
          metadata: {
            pnr: confirmation.pnr,
            bookingReference: `WAY-${confirmation.pnr}`,
            amount: confirmation.amount,
            providerMode: flightProvider.mode,
          },
        }),
        db.insert(notificationsTable).values({
          userId: req.user!.id,
          type: "BOOKING_CONFIRMED",
          title: `Flight booking confirmed · PNR ${confirmation.pnr}`,
          body: `Your ${flightProvider.mode === "DEMO" ? "DEMO " : ""}flight booking is confirmed. Booking reference: WAY-${confirmation.pnr}. Total: ₹${confirmation.amount.toLocaleString("en-IN")}.${flightProvider.mode === "DEMO" ? " DEMO FLIGHT — no real reservation was made." : ""}`,
          metadata: { bookingId: booking.id, pnr: confirmation.pnr },
        }),
      ]);
    } catch (auditErr) {
      req.log.error({ err: auditErr }, "Non-critical: audit log / notification failed after booking confirmation");
    }

    res.status(201).json({
      success: true,
      booking,
      pnr: confirmation.pnr,
      ticketNumber: confirmation.ticketNumber,
      amount: confirmation.amount,
      segments: confirmation.segments,
      emailStatus: booking.emailStatus,
      message: "Flight booked successfully! E-Ticket and PNR issued.",
    });
  } catch (error) {
    req.log.error({ err: error }, "Flight booking confirmation error");
    res.status(500).json({
      status: "booking_error",
      message: error instanceof Error ? error.message : "Failed to complete flight booking.",
    });
  }
});
*/

// --------------------------------------------------------------------------
// 6. User Bookings & Cancellation
// --------------------------------------------------------------------------
router.get("/bookings", requireAuth, async (req, res): Promise<void> => {
  try {
    const bookings = await db.select().from(bookingsTable)
      .where(or(eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.customerId, req.user!.id)))
      .orderBy(desc(bookingsTable.createdAt));
    const safeBookings = bookings.map(publicBookingRecord);
    res.json({ results: safeBookings, bookings: safeBookings });
  } catch (error) {
    req.log.error({ err: error }, "Failed to list bookings");
    res.status(500).json({ status: "database_error", message: "Bookings could not be loaded." });
  }
});

router.get("/bookings/:id", (req, res, next) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    return next();
  }

  requireAuth(req, res, async (): Promise<void> => {
    try {
      const [booking] = await db.select().from(bookingsTable)
        .where(and(eq(bookingsTable.id, parsedId.data), eq(bookingsTable.ownerId, req.user!.id)));

      if (!booking) {
        res.status(404).json({ status: "not_found", message: "Booking not found." });
        return;
      }

      res.json({ booking: publicBookingRecord(booking) });
    } catch (error) {
      req.log.error({ err: error }, "Failed to fetch booking");
      res.status(500).json({ status: "database_error", message: "Booking could not be loaded." });
    }
  });
});

router.post("/bookings/:id/email", requireAuth, async (req, res): Promise<void> => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ status: "invalid_request", message: "Booking id must be a UUID." });
    return;
  }

  try {
    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, parsedId.data), eq(bookingsTable.ownerId, req.user!.id)));

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    if (booking.status !== "CONFIRMED") {
      res.status(400).json({
        status: "invalid_booking_status",
        message: `Cannot send confirmation email for booking with status '${booking.status}'. Only confirmed bookings receive client emails.`,
      });
      return;
    }

    const emailService = getEmailService();
    const emailResult = await emailService.sendBookingConfirmation(booking);

    if (emailResult.success) {
      const [updated] = await db.update(bookingsTable).set({
        emailStatus: emailResult.status === "SENT" ? "SENT" : emailResult.status,
        emailSentAt: new Date(),
        clientEmail: emailResult.recipient,
        emailError: null,
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id)).returning();

      res.json({
        success: true,
        status: updated.emailStatus,
        recipient: emailResult.recipient,
        message: `Booking confirmation email successfully dispatched to ${emailResult.recipient}`,
        booking: updated,
      });
    } else {
      const [updated] = await db.update(bookingsTable).set({
        emailStatus: emailResult.status,
        emailError: emailResult.error || "Email delivery failed",
        clientEmail: emailResult.recipient,
        updatedAt: new Date(),
      }).where(eq(bookingsTable.id, booking.id)).returning();

      res.status(502).json({
        success: false,
        status: "email_delivery_failed",
        recipient: emailResult.recipient,
        error: emailResult.error,
        message: `Failed to deliver email: ${emailResult.error}`,
        booking: updated,
      });
    }
  } catch (error) {
    req.log.error({ err: error }, "Failed to retry booking email");
    res.status(500).json({ status: "server_error", message: "Failed to process email delivery request." });
  }
});

router.post("/bookings/:id/cancel", (req, res, next) => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    return next();
  }

  requireAuth(req, res, async (): Promise<void> => {

  try {
    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, parsedId.data), eq(bookingsTable.ownerId, req.user!.id)));

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    if (booking.status === "CANCELLED" || booking.status === "DEMO_CANCELLED") {
      res.status(400).json({ status: "already_cancelled", message: "This booking has already been cancelled." });
      return;
    }

    // PARKED (Phase 1, 2026-09-19): Direct supplier flight cancellation via flightProvider is parked per Wayora_PRD_Without_APIs.
    /*
    if (booking.kind === "FLIGHT" && booking.pnr && booking.pnr !== "UNISSUED") {
      const flightProvider = getFlightProvider();
      const cancelResult = await flightProvider.cancelBooking(booking.pnr, req.body?.reason);
      ...
    }
    */

    // Standard demo cancellation fallback (HOTEL/ACTIVITY/TRANSPORT or FLIGHT without PNR)
    const refundAmount = booking.amount;
    const [updated] = await db.update(bookingsTable)
      .set({
        status: "CANCELLED",
        refundAmount,
        cancellationDetails: {
          cancelledAt: new Date().toISOString(),
          reason: req.body?.reason || "User requested cancellation",
          refundAmount,
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    if (booking.paymentOrderId) {
      await db.update(paymentTransactionsTable)
        .set({ status: "REFUNDED", refundStatus: "PROCESSED", refundAmount: booking.amount, updatedAt: new Date() })
        .where(and(eq(paymentTransactionsTable.bookingId, booking.id), eq(paymentTransactionsTable.providerOrderId, booking.paymentOrderId)));
    }

    // Audit + notification
    try {
      await Promise.all([
        db.insert(auditLogsTable).values({
          actorUserId: req.user!.id,
          action: "BOOKING_CANCELLED",
          resourceType: "booking",
          resourceId: booking.id,
          ipAddress: req.ip,
          metadata: { kind: booking.kind, bookingReference: booking.bookingReference, refundAmount },
        }),
        db.insert(notificationsTable).values({
          userId: req.user!.id,
          type: "BOOKING_CANCELLED",
          title: `${booking.kind} booking cancelled`,
          body: `${booking.bookingReference} was cancelled. DEMO refund of ₹${refundAmount.toLocaleString("en-IN")} recorded.`,
          metadata: { bookingId: booking.id, refundAmount },
        }),
      ]);
    } catch (_) { /* non-critical */ }

    res.json({
      success: true,
      booking: updated,
      cancellation: { refundAmount, status: "CANCELLED" },
      message: `Booking cancelled. Demo refund of ₹${refundAmount.toLocaleString("en-IN")} recorded.`,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to cancel booking");
    res.status(500).json({ status: "database_error", message: "Booking could not be cancelled." });
  }
  });
});

// --------------------------------------------------------------------------
// 6b. Marketplace payment finalization
// --------------------------------------------------------------------------
router.post("/bookings/:id/payment", requireAuth, async (req, res): Promise<void> => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  const parsedPayment = z.object({
    orderId: z.string().trim().min(1),
    paymentId: z.string().trim().min(1),
    signature: z.string().trim().min(1),
  }).safeParse(req.body);

  if (!parsedId.success || !parsedPayment.success) {
    res.status(400).json({ status: "invalid_request", message: "A valid booking and payment confirmation are required." });
    return;
  }

  try {
    const [booking] = await db.select().from(bookingsTable).where(and(
      eq(bookingsTable.id, parsedId.data),
      eq(bookingsTable.ownerId, req.user!.id),
    )).limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    if (booking.status === "CONFIRMED" && booking.paymentStatus === "PAYMENT_CONFIRMED") {
      if (booking.paymentOrderId === parsedPayment.data.orderId && booking.paymentId === parsedPayment.data.paymentId) {
        res.json({ success: true, duplicate: true, booking });
        return;
      }
      res.status(409).json({ status: "already_processed", message: "This booking has already been paid." });
      return;
    }

    if (booking.paymentOrderId !== parsedPayment.data.orderId) {
      res.status(409).json({ status: "payment_order_mismatch", message: "The payment order does not belong to this booking." });
      return;
    }

    const paymentProvider = getPaymentProvider();
    const verification = await paymentProvider.verifyPayment(parsedPayment.data);
    if (!verification.verified) {
      res.status(400).json({ status: "verification_failed", verified: false, message: verification.error || "Payment verification failed." });
      return;
    }

    const [transaction] = await db.select().from(paymentTransactionsTable).where(and(
      eq(paymentTransactionsTable.userId, req.user!.id),
      eq(paymentTransactionsTable.providerOrderId, parsedPayment.data.orderId),
    )).limit(1);

    if (!transaction || transaction.bookingId !== booking.id) {
      res.status(409).json({ status: "payment_not_found", message: "The payment transaction is not linked to this booking." });
      return;
    }
    if (transaction.provider !== "razorpay" || paymentProvider.mode !== "LIVE") {
      res.status(409).json({ status: "payment_provider_mismatch", message: "This booking is not configured for live payment." });
      return;
    }
    if (paymentProvider.verifyPaymentDetails) {
      const details = await paymentProvider.verifyPaymentDetails(parsedPayment.data, {
        amount: transaction.amount,
        currency: transaction.currency,
      });
      if (!details.verified) {
        res.status(400).json({ status: "verification_failed", verified: false, message: details.error || "Razorpay payment details could not be verified." });
        return;
      }
    }
    if (transaction.status === "REFUNDED" || transaction.status === "CANCELLED" || transaction.status === "FAILED") {
      res.status(409).json({ status: "payment_not_payable", message: "This payment order is no longer payable." });
      return;
    }
    if (transaction.providerPaymentId && transaction.providerPaymentId !== parsedPayment.data.paymentId) {
      res.status(409).json({ status: "payment_already_linked", message: "This order is already linked to another payment." });
      return;
    }

    const [updatedTransaction] = await db.update(paymentTransactionsTable).set({
      providerPaymentId: parsedPayment.data.paymentId,
      status: "CAPTURED",
      capturedAmount: transaction.amount,
      updatedAt: new Date(),
    }).where(and(
      eq(paymentTransactionsTable.id, transaction.id),
      eq(paymentTransactionsTable.status, "CREATED"),
    )).returning();

    if (!updatedTransaction && transaction.status !== "CAPTURED") {
      res.status(409).json({ status: "payment_state_changed", message: "Payment state changed while it was being confirmed. Please retry." });
      return;
    }

    const [updatedBooking] = await db.update(bookingsTable).set({
      status: "CONFIRMED",
      paymentStatus: "PAYMENT_CONFIRMED",
      paymentId: parsedPayment.data.paymentId,
      updatedAt: new Date(),
    }).where(and(
      eq(bookingsTable.id, booking.id),
      eq(bookingsTable.status, "PAYMENT_PENDING"),
    )).returning();

    if (updatedBooking) {
      await db.insert(paymentsTable).values({
        bookingId: updatedBooking.id,
        userId: req.user!.id,
        provider: "razorpay",
        razorpayOrderId: parsedPayment.data.orderId,
        razorpayPaymentId: parsedPayment.data.paymentId,
        razorpaySignature: parsedPayment.data.signature,
        amount: transaction.amount,
        currency: transaction.currency,
        status: "SUCCESSFUL",
        verificationStatus: "VERIFIED",
        receiptNumber: `REC-${updatedBooking.bookingId}`,
      }).onConflictDoNothing();
      await createFulfilmentTasksOnPayment(updatedBooking.bookingId || updatedBooking.id);
    }

    res.status(updatedBooking ? 200 : 409).json({
      success: Boolean(updatedBooking),
      duplicate: !updatedBooking,
      booking: updatedBooking || booking,
      message: updatedBooking ? "Payment verified and booking confirmed." : "Booking state changed while payment was being confirmed.",
    });
  } catch (error) {
    req.log.error({ err: error }, "Marketplace payment finalization failed");
    res.status(500).json({ status: "payment_error", message: "Payment was verified, but the booking could not be finalized." });
  }
});

// --------------------------------------------------------------------------
// 7. Payment Webhook Endpoint
// --------------------------------------------------------------------------
router.post("/payments/webhook", async (req, res): Promise<void> => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody = Buffer.isBuffer((req as any).rawBody)
    ? (req as any).rawBody as Buffer
    : Buffer.from(JSON.stringify(req.body || {}), "utf-8");

  if (process.env.NODE_ENV === "production" && !secret) {
    res.status(503).json({ status: "not_configured", message: "Payment webhook verification is not configured." });
    return;
  }

  if (secret) {
    if (!signature) {
      res.status(400).json({ status: "invalid_signature", message: "Missing x-razorpay-signature header." });
      return;
    }

    const paymentProvider = getPaymentProvider();
    if (!paymentProvider.verifyWebhookSignature(rawBody, signature, secret)) {
      res.status(400).json({ status: "invalid_signature", message: "Webhook signature mismatch." });
      return;
    }
  }

  const event = req.body?.event;
  const eventId = typeof req.body?.id === "string" ? req.body.id : undefined;
  const paymentPayload = req.body?.payload?.payment?.entity;
  const orderPayload = req.body?.payload?.order?.entity;
  const providerOrderId = paymentPayload?.order_id || orderPayload?.id;
  const providerPaymentId = typeof paymentPayload?.id === "string" ? paymentPayload.id : undefined;

  if (providerOrderId) {
    try {
      if (eventId) {
        const [alreadyProcessed] = await db.select({ id: paymentTransactionsTable.id })
          .from(paymentTransactionsTable)
          .where(eq(paymentTransactionsTable.webhookEventId, eventId))
          .limit(1);
        if (alreadyProcessed) {
          res.json({ status: "ok", duplicate: true });
          return;
        }
      }

      const captured = event === "payment.captured" || event === "order.paid";
      const failed = event === "payment.failed";
      const status = captured ? "CAPTURED" : failed ? "FAILED" : event === "payment.authorized" ? "AUTHORIZED" : undefined;

      if (status) {
        const [transaction] = await db.select().from(paymentTransactionsTable)
          .where(eq(paymentTransactionsTable.providerOrderId, providerOrderId))
          .limit(1);

        if (!transaction) {
          req.log.warn({ providerOrderId }, "Ignoring webhook for unknown Razorpay order");
          res.json({ status: "ok", ignored: true });
          return;
        }

        const webhookAmount = Number(paymentPayload?.amount || orderPayload?.amount || 0);
        if (captured && webhookAmount > 0 && Math.round(webhookAmount / 100) !== transaction.amount) {
          req.log.warn({ providerOrderId }, "Ignoring webhook with mismatched payment amount");
          res.status(400).json({ status: "amount_mismatch", message: "Webhook payment amount does not match the created order." });
          return;
        }

        await db.update(paymentTransactionsTable).set({
          providerPaymentId,
          status,
          capturedAmount: captured ? transaction.amount : undefined,
          failureReason: failed ? (paymentPayload?.error_description || "Payment failed.") : undefined,
          webhookEventId: eventId,
          webhookEventType: event,
          updatedAt: new Date(),
        }).where(and(
          eq(paymentTransactionsTable.providerOrderId, providerOrderId),
          or(eq(paymentTransactionsTable.status, "CREATED"), eq(paymentTransactionsTable.status, "AUTHORIZED")),
        ));
      }

      if (captured) {
        const [linkedBooking] = await db.select().from(bookingsTable).where(eq(bookingsTable.paymentOrderId, providerOrderId)).limit(1);
        if (linkedBooking?.kind === "HOTEL" && linkedBooking.status === "PENDING") {
          await db.update(bookingsTable).set({ status: "RECONCILIATION_REQUIRED", paymentStatus: "PAYMENT_CAPTURED", cancellationDetails: { provider: "HOTEL", reason: "Payment captured before supplier orchestration completed.", detectedAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(bookingsTable.id, linkedBooking.id));
        } else {
          await db.update(bookingsTable).set({ paymentStatus: "CAPTURED", updatedAt: new Date() }).where(eq(bookingsTable.paymentOrderId, providerOrderId));
        }
      } else if (failed) {
        await db.update(bookingsTable)
          .set({ paymentStatus: "FAILED", updatedAt: new Date() })
          .where(eq(bookingsTable.paymentOrderId, providerOrderId));
      }
    } catch (err) {
      req.log.error({ err }, "Webhook DB update failed");
    }
  }

  res.json({ status: "ok" });
});

// --------------------------------------------------------------------------
// 8. Hotels, Experiences, Transport & Notifications
// --------------------------------------------------------------------------
router.get("/hotels/search", async (req, res): Promise<void> => {
  const query = z.object({
    destination: z.string().trim().default("Kashmir"),
    checkIn: z.string().trim().default("2026-10-12"),
    checkOut: z.string().trim().default("2026-10-17"),
    guests: z.coerce.number().int().min(1).max(20).default(2),
    children: z.coerce.number().int().min(0).max(8).default(0),
    childAges: z.string().trim().optional(),
    roomOccupancies: z.string().trim().optional(),
    rooms: z.coerce.number().int().min(1).max(8).default(1),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid hotel search fields." });
    return;
  }
  res.json({ provider: providerStatus().hotels, results: searchHotels(query.data) });
});

router.get("/experiences", (req, res) => {
  const query = z.object({
    destination: z.string().trim().optional(),
    category: z.string().trim().optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid experience filters." });
    return;
  }
  res.json({ provider: providerStatus().activities, results: listExperiences(query.data) });
});

router.get("/transport/search", (req, res) => {
  const query = z.object({
    pickup: z.string().trim().min(2).default("Srinagar Airport"),
    drop: z.string().trim().min(2).default("Gulmarg"),
    date: z.string().trim().default("2026-10-12"),
    passengers: z.coerce.number().int().min(1).max(12).default(2),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid transport search fields." });
    return;
  }
  res.json({ provider: providerStatus().transport, results: searchTransport(query.data) });
});

router.post("/bookings", (req, res, next) => {
  if (req.body?.packageId !== undefined || !req.body?.kind) {
    return next();
  }
  requireAuth(req, res, async (): Promise<void> => {
    const bookingSchema = z.object({
      kind: z.enum(["HOTEL", "ACTIVITY", "TRANSPORT"]),
      itemId: z.string().trim().min(1).max(120),
      amount: z.coerce.number().int().positive().max(10_000_000),
      payload: z.record(z.string(), z.unknown()).default({}),
      // Optional idempotency key for duplicate-safe requests
      idempotencyKey: z.string().trim().min(4).max(120).optional(),
    });

    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "invalid_request", message: "Choose a valid travel item and amount." });
      return;
    }
  try {
    const destination = typeof parsed.data.payload.destination === "string" ? parsed.data.payload.destination : undefined;
    const catalogAmount = demoItemAmount(parsed.data.kind, parsed.data.itemId, destination);
    const paymentProvider = getPaymentProvider();
    if (paymentProvider.mode === "LIVE" && catalogAmount === null) {
      res.status(400).json({ status: "invalid_item", message: "The selected travel item is no longer available at a server-verified price." });
      return;
    }
    const serverAmount = catalogAmount ?? parsed.data.amount;

    const idempotencyKey = parsed.data.idempotencyKey || `booking-${req.user!.id}-${parsed.data.kind}-${parsed.data.itemId}`;

    // Idempotency check
    const [existingBooking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.idempotencyKey, idempotencyKey)));
    if (existingBooking) {
      res.status(200).json({ booking: existingBooking, message: "Booking already exists (idempotent response)." });
      return;
    }

    if (paymentProvider.mode === "LIVE") {
      const receipt = `rcpt_${crypto.randomUUID().slice(0, 12)}`;
      const order = await paymentProvider.createOrder({
        amount: serverAmount,
        currency: "INR",
        receipt,
        notes: {
          userId: req.user!.id,
          kind: parsed.data.kind,
          itemId: parsed.data.itemId,
        },
      });

      const [transaction] = await db.insert(paymentTransactionsTable).values({
        userId: req.user!.id,
        provider: order.provider,
        providerOrderId: order.orderId,
        amount: serverAmount,
        requestedAmount: serverAmount,
        currency: order.currency,
        status: "CREATED",
        idempotencyKey,
        metadata: { kind: parsed.data.kind, itemId: parsed.data.itemId, mode: "LIVE", payload: parsed.data.payload },
      }).returning();

      const reference = `WAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const [booking] = await db.insert(bookingsTable).values({
        ownerId: req.user!.id,
        kind: parsed.data.kind,
        status: "PENDING",
        providerMode: "LIVE",
        providerReference: parsed.data.itemId,
        bookingReference: reference,
        amount: serverAmount,
        paymentOrderId: order.orderId,
        paymentStatus: "PAYMENT_PENDING",
        idempotencyKey,
        payload: parsed.data.payload,
      }).returning();

      await db.update(paymentTransactionsTable).set({ bookingId: booking.id, updatedAt: new Date() })
        .where(eq(paymentTransactionsTable.id, transaction.id));

      res.status(201).json({
        success: true,
        requiresPayment: true,
        booking,
        orderId: order.orderId,
        amount: order.amount,
        amountSubunits: order.amountSubunits,
        currency: order.currency,
        keyId: order.keyId,
        provider: order.provider,
        transactionId: transaction.id,
        status: "PAYMENT_REQUIRED",
        message: "Complete Razorpay checkout to confirm this booking.",
      });
      return;
    }

    res.status(503).json({ status: "payment_not_configured", message: "Razorpay live payments are required for this booking flow." });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create booking");
    res.status(500).json({ status: "database_error", message: "Booking could not be created." });
  }
  });
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const results = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.id))
      .orderBy(desc(notificationsTable.createdAt));
    res.json({ results: results.map((notification: typeof notificationsTable.$inferSelect) => ({ ...notification, message: notification.body, unread: !notification.readAt })) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load notifications");
    res.status(500).json({ status: "database_error", message: "Notifications could not be loaded." });
  }
});

router.post("/notifications", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({
    type: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Notification type, title, and body are required." });
    return;
  }
  const [notification] = await db.insert(notificationsTable).values({ userId: req.user!.id, ...parsed.data }).returning();
  res.status(201).json({ notification, unread: true });
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const results = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, req.user!.id), isNull(notificationsTable.readAt)));
  res.json({ count: results.length });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = z.string().trim().min(1).safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ status: "invalid_request", message: "Notification id is required." });
    return;
  }
  const [updated] = await db.update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, id.data), eq(notificationsTable.userId, req.user!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ status: "not_found", message: "Notification not found." });
    return;
  }

  // Update broadcast read analytics if applicable
  if (updated.broadcastId) {
    try {
      await db.update(broadcastsTable)
        .set({ readCount: sql`${broadcastsTable.readCount} + 1` })
        .where(eq(broadcastsTable.id, updated.broadcastId));
      await db.update(broadcastRecipientsTable)
        .set({ status: "READ", readAt: new Date() })
        .where(and(
          eq(broadcastRecipientsTable.broadcastId, updated.broadcastId),
          eq(broadcastRecipientsTable.userId, req.user!.id)
        ));
    } catch (bErr) {
      req.log.warn({ err: bErr }, "Failed to update broadcast read metrics");
    }
  }

  res.json({ id: updated.id, unread: false });
});

router.post("/notifications/:id/click", requireAuth, async (req, res): Promise<void> => {
  const id = z.string().trim().min(1).safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ status: "invalid_request", message: "Notification id is required." });
    return;
  }
  const [updated] = await db.update(notificationsTable)
    .set({
      clickedAt: new Date(),
      readAt: sql`COALESCE(${notificationsTable.readAt}, NOW())`,
    })
    .where(and(eq(notificationsTable.id, id.data), eq(notificationsTable.userId, req.user!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ status: "not_found", message: "Notification not found." });
    return;
  }

  // Update broadcast click analytics if applicable
  if (updated.broadcastId) {
    try {
      await db.update(broadcastsTable)
        .set({ clickCount: sql`${broadcastsTable.clickCount} + 1` })
        .where(eq(broadcastsTable.id, updated.broadcastId));
      await db.update(broadcastRecipientsTable)
        .set({ status: "CLICKED", clickedAt: new Date() })
        .where(and(
          eq(broadcastRecipientsTable.broadcastId, updated.broadcastId),
          eq(broadcastRecipientsTable.userId, req.user!.id)
        ));
    } catch (bErr) {
      req.log.warn({ err: bErr }, "Failed to update broadcast click metrics");
    }
  }

  res.json({ id: updated.id, clicked: true, actionUrl: updated.actionUrl });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const unreadList = await db.select({ id: notificationsTable.id, broadcastId: notificationsTable.broadcastId })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.user!.id), isNull(notificationsTable.readAt)));

  await db.update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, req.user!.id), isNull(notificationsTable.readAt)));

  for (const item of unreadList) {
    if (item.broadcastId) {
      try {
        await db.update(broadcastsTable)
          .set({ readCount: sql`${broadcastsTable.readCount} + 1` })
          .where(eq(broadcastsTable.id, item.broadcastId));
        await db.update(broadcastRecipientsTable)
          .set({ status: "READ", readAt: new Date() })
          .where(and(
            eq(broadcastRecipientsTable.broadcastId, item.broadcastId),
            eq(broadcastRecipientsTable.userId, req.user!.id)
          ));
      } catch {}
    }
  }

  res.json({ success: true, count: unreadList.length });
});

// --------------------------------------------------------------------------
// 10. User Dashboard Stats
// --------------------------------------------------------------------------
router.get("/user/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [allBookings, allTrips, unreadNotifications] = await Promise.all([
      db.select().from(bookingsTable).where(eq(bookingsTable.ownerId, userId)),
      db.select().from(generatedTripsTable).where(eq(generatedTripsTable.ownerId, userId)),
      db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt))),
    ]);

    const confirmedBookings = allBookings.filter((b: any) => b.status === "CONFIRMED");
    const totalSpend = confirmedBookings.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

    res.json({
      totalBookings: allBookings.length,
      confirmedBookings: confirmedBookings.length,
      cancelledBookings: allBookings.filter((b: any) => b.status === "CANCELLED").length,
      totalSpend,
      savedTrips: allTrips.length,
      unreadNotifications: unreadNotifications.length,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to compute user stats");
    res.status(500).json({ status: "database_error", message: "Stats could not be loaded." });
  }
});

export default router;