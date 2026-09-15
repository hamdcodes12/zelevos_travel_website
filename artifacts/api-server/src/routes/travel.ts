import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { auditLogsTable, bookingsTable, db, generatedTripsTable, notificationsTable, paymentTransactionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  getFlightProvider,
  type FlightOffer,
  type PassengerDetails,
  type ContactDetails,
} from "../services/flight-provider";
import { getPaymentProvider } from "../services/payment-service";
import { getEmailService } from "../services/email-service";
import { findAirports } from "../services/airports-data";
import {
  listExperiences,
  providerStatus,
  searchHotels,
  searchTransport,
  MockPaymentProvider,
} from "../services/providers";

const router: IRouter = Router();

function demoItemAmount(kind: "HOTEL" | "ACTIVITY" | "TRANSPORT", itemId: string, destination?: string): number | null {
  if (kind === "HOTEL") {
    const dest = destination || "Kashmir";
    const all = searchHotels({ destination: dest, checkIn: "2026-10-12", checkOut: "2026-10-17", guests: 2, rooms: 1 });
    return all.find((item) => item.id === itemId)?.pricePerNight ?? all[0]?.pricePerNight ?? null;
  }
  if (kind === "ACTIVITY") {
    const all = listExperiences({ destination: destination || "Kashmir" });
    return all.find((item) => item.id === itemId)?.price ?? all[0]?.price ?? null;
  }
  const all = searchTransport({ pickup: "Srinagar Airport", drop: "Gulmarg", date: "2026-10-12", passengers: 2 });
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

// --------------------------------------------------------------------------
// 1. Provider Status
// --------------------------------------------------------------------------
router.get("/providers/status", (_req, res) => {
  let flightProvider;
  try {
    flightProvider = getFlightProvider();
  } catch (error) {
    res.status(503).json({ status: "provider_not_configured", message: error instanceof Error ? error.message : "Flight provider not configured." });
    return;
  }
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
      flights: `${flightProvider.name} (${flightProvider.mode})`,
      hotels: providerStatus().hotels,
      activities: providerStatus().activities,
      transport: providerStatus().transport,
      payments: `${paymentProviderName} (${paymentsReady ? paymentProviderMode : "NOT_CONFIGURED"})`,
    },
    mode: {
      flights: flightProvider.mode,
      payments: paymentProviderMode,
    },
    note: flightProvider.mode === "LIVE"
      ? "Connected to live flight GDS/Duffel provider."
      : "DEMO provider active. No supplier reservation or real PNR is created.",
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

// --------------------------------------------------------------------------
// 4. Payment Creation & Verification Endpoints
// --------------------------------------------------------------------------
router.post("/payments/order", requireAuth, async (req, res): Promise<void> => {
  const schema = z.object({
    amount: z.coerce.number().int().positive().max(10_000_000),
    currency: z.string().trim().default("INR"),
    receipt: z.string().trim().optional(),
    notes: z.record(z.string(), z.string()).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Valid amount is required.", errors: parsed.error.issues });
    return;
  }

  try {
    const paymentProvider = getPaymentProvider();
    let requestedAmount = parsed.data.amount;
    if (paymentProvider.mode === "LIVE") {
      const offerId = parsed.data.notes?.offerId;
      if (!offerId) {
        res.status(400).json({ status: "invalid_request", message: "A server-side flight offer is required for live payment orders." });
        return;
      }
      const revalidation = await getFlightProvider().revalidate(offerId);
      if (!revalidation.valid || revalidation.soldOut || !revalidation.newPrice) {
        res.status(409).json({ status: "quote_unavailable", message: "The live flight quote is no longer available." });
        return;
      }
      requestedAmount = revalidation.newPrice;
    }
    const receipt = parsed.data.receipt || `rcpt_${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = parsed.data.idempotencyKey || `payment-${req.user!.id}-${receipt}`;
    const [existing] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.idempotencyKey, idempotencyKey)).limit(1);
    if (existing?.providerOrderId) {
      res.status(200).json({ orderId: existing.providerOrderId, amount: existing.amount, amountSubunits: existing.amount * 100, currency: existing.currency, provider: existing.provider, transactionId: existing.id });
      return;
    }
    const order = await paymentProvider.createOrder({
      amount: requestedAmount,
      currency: parsed.data.currency,
      receipt,
      notes: {
        userId: req.user!.id,
        ...parsed.data.notes,
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
    }).returning();
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
    await db.update(paymentTransactionsTable).set({
      providerPaymentId: parsed.data.paymentId,
      status: "CAPTURED",
      capturedAmount: undefined,
      updatedAt: new Date(),
    }).where(and(eq(paymentTransactionsTable.userId, req.user!.id), eq(paymentTransactionsTable.providerOrderId, parsed.data.orderId)));
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
    res.status(400).json({ status: "validation_error", message: "At least one adult traveller is required." });
    return;
  }

  if (infantCount > adultCount) {
    res.status(400).json({ status: "validation_error", message: "Infants cannot exceed the number of adult travellers." });
    return;
  }

  const today = new Date();
  for (const p of passengers) {
    const age = calculateAge(p.dateOfBirth, today);
    if (p.type === "ADULT" && age < 12) {
      res.status(400).json({
        status: "validation_error",
        message: `Passenger ${p.firstName} ${p.lastName} is registered as Adult but age is ${age} (Adults must be 12+).`,
      });
      return;
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
    await paymentProvider.refund({
      paymentId: payment.paymentId,
      amount: reval.oldPrice || 1000,
      reason: "Flight seats sold out during booking checkout.",
    });

    res.status(409).json({
      status: "flight_sold_out",
      message: "The selected flight became sold out before confirmation. Your payment has been automatically refunded.",
    });
    return;
  }

  if (paymentProvider.mode === "LIVE") {
    const [transaction] = await db.select().from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.userId, req.user!.id), eq(paymentTransactionsTable.providerOrderId, payment.orderId)))
      .limit(1);
    if (!transaction || transaction.amount !== reval.newPrice) {
      res.status(409).json({ status: "payment_quote_mismatch", message: "The payment amount does not match the current server-side flight quote." });
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

    if (!confirmation.success || confirmation.status === "FAILED") {
      // Record failed booking with refund pending
      const [failedBooking] = await db.insert(bookingsTable).values({
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
      await paymentProvider.refund({
        paymentId: payment.paymentId,
        amount: confirmation.amount || 0,
        reason: "Airline reservation failed",
      });

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

// --------------------------------------------------------------------------
// 6. User Bookings & Cancellation
// --------------------------------------------------------------------------
router.get("/bookings", requireAuth, async (req, res): Promise<void> => {
  try {
    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.ownerId, req.user!.id))
      .orderBy(desc(bookingsTable.createdAt));
    res.json({ results: bookings, bookings });
  } catch (error) {
    req.log.error({ err: error }, "Failed to list bookings");
    res.status(500).json({ status: "database_error", message: "Bookings could not be loaded." });
  }
});

router.get("/bookings/:id", requireAuth, async (req, res): Promise<void> => {
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

    res.json({ booking });
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch booking");
    res.status(500).json({ status: "database_error", message: "Booking could not be loaded." });
  }
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

router.post("/bookings/:id/cancel", requireAuth, async (req, res): Promise<void> => {
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

    if (booking.status === "CANCELLED" || booking.status === "DEMO_CANCELLED") {
      res.status(400).json({ status: "already_cancelled", message: "This booking has already been cancelled." });
      return;
    }

    // If it is a real FLIGHT booking with PNR
    if (booking.kind === "FLIGHT" && booking.pnr && booking.pnr !== "UNISSUED") {
      const flightProvider = getFlightProvider();
      const cancelResult = await flightProvider.cancelBooking(booking.pnr, req.body?.reason);

      // Refund payment if paymentId exists
      let refundStatus = "NOT_APPLICABLE";
      if (booking.paymentId && cancelResult.refundAmount > 0) {
        const paymentProvider = getPaymentProvider();
        const refundRes = await paymentProvider.refund({
          paymentId: booking.paymentId,
          amount: cancelResult.refundAmount,
          reason: "User requested flight cancellation",
        });
        refundStatus = refundRes.status;
      }

      const [updated] = await db.update(bookingsTable)
        .set({
          status: "CANCELLED",
          cancellationDetails: {
            ...cancelResult,
            refundStatus,
            cancelledAt: new Date().toISOString(),
          } as Record<string, unknown>,
          refundAmount: cancelResult.refundAmount,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, booking.id))
        .returning();

      // Audit + notification
      try {
        await Promise.all([
          db.insert(auditLogsTable).values({
            actorUserId: req.user!.id,
            action: "FLIGHT_BOOKING_CANCELLED",
            resourceType: "booking",
            resourceId: booking.id,
            ipAddress: req.ip,
            metadata: { pnr: booking.pnr, refundAmount: cancelResult.refundAmount, refundStatus },
          }),
          db.insert(notificationsTable).values({
            userId: req.user!.id,
            type: "BOOKING_CANCELLED",
            title: `Flight booking cancelled · PNR ${booking.pnr}`,
            body: `Your booking ${booking.bookingReference} has been cancelled. ${cancelResult.refundAmount > 0 ? `Refund of ₹${cancelResult.refundAmount.toLocaleString("en-IN")} is being processed.` : "No refund applicable."}`,
            metadata: { bookingId: booking.id, pnr: booking.pnr, refundAmount: cancelResult.refundAmount },
          }),
        ]);
      } catch (_) { /* non-critical */ }

      res.json({
        success: true,
        booking: updated,
        cancellation: cancelResult,
        message: cancelResult.message,
      });
      return;
    }

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

// --------------------------------------------------------------------------
// 7. Payment Webhook Endpoint
// --------------------------------------------------------------------------
router.post("/payments/webhook", async (req, res): Promise<void> => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (process.env.NODE_ENV === "production" && !secret) {
    res.status(503).json({ status: "not_configured", message: "Payment webhook verification is not configured." });
    return;
  }

  if (secret) {
    if (!signature) {
      res.status(400).json({ status: "invalid_signature", message: "Missing x-razorpay-signature header." });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf-8");
    const expected = crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf-8");
    const sigBuf = Buffer.from(signature, "utf-8");

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      res.status(400).json({ status: "invalid_signature", message: "Webhook signature mismatch." });
      return;
    }
  }

  const event = req.body?.event;
  const paymentPayload = req.body?.payload?.payment?.entity;

  if (paymentPayload?.order_id) {
    try {
      if (event === "payment.captured") {
        await db.update(bookingsTable)
          .set({ paymentStatus: "CAPTURED", updatedAt: new Date() })
          .where(eq(bookingsTable.paymentOrderId, paymentPayload.order_id));
        await db.update(paymentTransactionsTable).set({ providerPaymentId: paymentPayload.id, status: "CAPTURED", capturedAmount: Math.round(Number(paymentPayload.amount || 0) / 100), webhookEventId: req.body?.id, webhookEventType: event, updatedAt: new Date() }).where(eq(paymentTransactionsTable.providerOrderId, paymentPayload.order_id));
      } else if (event === "payment.failed") {
        await db.update(bookingsTable)
          .set({ paymentStatus: "FAILED", updatedAt: new Date() })
          .where(eq(bookingsTable.paymentOrderId, paymentPayload.order_id));
        await db.update(paymentTransactionsTable).set({ providerPaymentId: paymentPayload.id, status: "FAILED", failureReason: paymentPayload.error_description || "Payment failed", webhookEventId: req.body?.id, webhookEventType: event, updatedAt: new Date() }).where(eq(paymentTransactionsTable.providerOrderId, paymentPayload.order_id));
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
router.get("/hotels/search", (req, res) => {
  const query = z.object({
    destination: z.string().trim().default("Kashmir"),
    checkIn: z.string().trim().default("2026-10-12"),
    checkOut: z.string().trim().default("2026-10-17"),
    guests: z.coerce.number().int().min(1).max(20).default(2),
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

router.post("/bookings", requireAuth, async (req, res): Promise<void> => {
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
    const serverAmount = demoItemAmount(parsed.data.kind, parsed.data.itemId, destination) ?? parsed.data.amount;

    const idempotencyKey = parsed.data.idempotencyKey || `booking-${req.user!.id}-${parsed.data.kind}-${parsed.data.itemId}`;

    // Idempotency check
    const [existingBooking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.idempotencyKey, idempotencyKey)));
    if (existingBooking) {
      res.status(200).json({ booking: existingBooking, message: "Booking already exists (idempotent response). DEMO PAYMENT — NO REAL MONEY was charged." });
      return;
    }

    // 1. Create demo payment order
    const orderId = `order_demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const paymentId = `pay_demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;

    // Persist payment transaction (PENDING)
    const [transaction] = await db.insert(paymentTransactionsTable).values({
      userId: req.user!.id,
      provider: "demo",
      providerOrderId: orderId,
      amount: serverAmount,
      requestedAmount: serverAmount,
      currency: "INR",
      status: "CREATED",
      idempotencyKey,
      metadata: { kind: parsed.data.kind, itemId: parsed.data.itemId, mode: "DEMO" },
    }).returning();

    // 2. Persist booking as PENDING
    const reference = `WAY-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [booking] = await db.insert(bookingsTable).values({
      ownerId: req.user!.id,
      kind: parsed.data.kind,
      status: "PENDING",
      providerMode: "DEMO",
      providerReference: parsed.data.itemId,
      bookingReference: reference,
      amount: serverAmount,
      paymentId,
      paymentOrderId: orderId,
      paymentStatus: "PAYMENT_PENDING",
      idempotencyKey,
      payload: {
        ...parsed.data.payload,
        demoNote: "DEMO PAYMENT — NO REAL MONEY was charged.",
      },
    }).returning();

    // 3. Simulate demo payment capture (instant in demo mode)
    await db.update(paymentTransactionsTable).set({
      providerPaymentId: paymentId,
      capturedAmount: serverAmount,
      status: "CAPTURED",
      updatedAt: new Date(),
    }).where(eq(paymentTransactionsTable.id, transaction.id));

    // 4. Confirm booking
    const [confirmedBooking] = await db.update(bookingsTable).set({
      status: "CONFIRMED",
      paymentStatus: "PAYMENT_CONFIRMED",
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id)).returning();

    // 5. Update transaction with bookingId
    await db.update(paymentTransactionsTable).set({
      bookingId: confirmedBooking.id,
      updatedAt: new Date(),
    }).where(eq(paymentTransactionsTable.id, transaction.id));

    // 6. Audit + notification (non-blocking)
    try {
      await Promise.all([
        db.insert(auditLogsTable).values({
          actorUserId: req.user!.id,
          action: `${parsed.data.kind}_BOOKING_CONFIRMED`,
          resourceType: "booking",
          resourceId: confirmedBooking.id,
          ipAddress: req.ip,
          metadata: { bookingReference: reference, amount: serverAmount, mode: "DEMO" },
        }),
        db.insert(notificationsTable).values({
          userId: req.user!.id,
          type: "BOOKING_CONFIRMED",
          title: `${parsed.data.kind.charAt(0) + parsed.data.kind.slice(1).toLowerCase()} booking confirmed`,
          body: `${reference} is saved to My Bookings. Total: ₹${serverAmount.toLocaleString("en-IN")}. DEMO PAYMENT — NO REAL MONEY was charged.`,
          metadata: { bookingId: confirmedBooking.id, kind: parsed.data.kind },
        }),
      ]);
    } catch (_) { /* non-critical */ }

    res.status(201).json({
      booking: confirmedBooking,
      message: `${parsed.data.kind.charAt(0) + parsed.data.kind.slice(1).toLowerCase()} booking confirmed. DEMO PAYMENT — NO REAL MONEY was charged.`,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create demo booking");
    res.status(500).json({ status: "database_error", message: "Booking could not be created." });
  }
});

router.post("/payments/mock/order", requireAuth, (req, res) => {
  const parsed = z.object({ amount: z.coerce.number().int().positive().max(10_000_000) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide a valid amount." });
    return;
  }
  void new MockPaymentProvider().createOrder(parsed.data.amount).then((payment) => res.status(201).json(payment));
});

router.post("/payments/mock/verify", requireAuth, (req, res) => {
  const parsed = z.object({ orderId: z.string().trim().min(1).max(120) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide a valid demo order id." });
    return;
  }
  void new MockPaymentProvider().verify(parsed.data.orderId).then((payment) => {
    res.json({ ...payment, message: "Demo payment verified. No money was charged." });
  });
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const results = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.id))
      .orderBy(desc(notificationsTable.createdAt));
    res.json({ results: results.map((notification: typeof notificationsTable.$inferSelect) => ({ ...notification, unread: !notification.readAt })) });
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
  res.json({ id: updated.id, unread: false });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ readAt: new Date() }).where(and(eq(notificationsTable.userId, req.user!.id), isNull(notificationsTable.readAt)));
  res.json({ success: true });
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