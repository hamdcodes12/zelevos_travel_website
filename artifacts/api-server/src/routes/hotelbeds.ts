import { and, eq, or } from "drizzle-orm";
import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { bookingsTable, db, paymentTransactionsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/authMiddleware";
import { HotelbedsError, HotelbedsProvider, getHotelbedsConfig, hotelbedsEnvironment, hotelbedsVoucherPdf, type HotelbedsSearchInput } from "../services/hotelbeds";
import { getPaymentProvider } from "../services/payment-service";

const router: IRouter = Router();

function failure(error: unknown) {
  return error instanceof HotelbedsError ? error : new HotelbedsError(502, "upstream", `Hotelbeds ${hotelbedsEnvironment()} API is temporarily unavailable.`);
}

function respondFailure(res: any, error: unknown) {
  const issue = failure(error);
  res.status(issue.statusCode).json({ status: "hotelbeds_error", provider: "HOTELBEDS", environment: hotelbedsEnvironment(), message: issue.message });
}

const roomSchema = z.object({
  adults: z.coerce.number().int().min(1).max(9),
  children: z.coerce.number().int().min(0).max(8).default(0),
  childAges: z.array(z.coerce.number().int().min(0).max(17)).default([]),
}).superRefine((room, context) => {
  if (room.childAges.length !== room.children) context.addIssue({ code: "custom", message: "Each child must have an age." });
});

const availabilitySchema = z.object({
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  destination: z.string().trim().max(10).optional(),
  hotelIds: z.array(z.string().trim().regex(/^\d+$/)).max(200).optional(),
  rooms: z.array(roomSchema).min(1).max(8),
  sourceMarket: z.string().trim().length(2).optional(),
}).superRefine((input, context) => {
  if (input.checkOut <= input.checkIn) context.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in." });
});

router.get("/hotelbeds/health", async (_req, res): Promise<void> => {
  if (!getHotelbedsConfig().apiKey || !getHotelbedsConfig().secret) {
    res.status(503).json({ connected: false, provider: "HOTELBEDS", environment: hotelbedsEnvironment() });
    return;
  }
  try { res.json(await new HotelbedsProvider().health()); } catch (error) { respondFailure(res, error); }
});

router.post("/hotelbeds/availability", async (req, res): Promise<void> => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ status: "invalid_request", message: "Provide valid Hotelbeds dates, rooms, occupancies, and child ages." }); return; }
  try {
    const input = parsed.data as HotelbedsSearchInput;
    const rates = await new HotelbedsProvider().availability(input);
    res.json({ provider: "HOTELBEDS", environment: hotelbedsEnvironment(), count: rates.length, results: rates });
  } catch (error) { respondFailure(res, error); }
});

router.post("/hotelbeds/check-rate", async (req, res): Promise<void> => {
  const parsed = z.object({ rateKey: z.string().trim().min(1).max(400) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ status: "invalid_request", message: "A Hotelbeds rateKey is required." }); return; }
  try { res.json({ provider: "HOTELBEDS", environment: hotelbedsEnvironment(), result: await new HotelbedsProvider().checkRate(parsed.data.rateKey) }); } catch (error) { respondFailure(res, error); }
});

router.get("/hotelbeds/rate-comments", async (req, res): Promise<void> => {
  const parsed = z.object({ code: z.string().trim().min(1).max(200), date: z.string().date() }).safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ status: "invalid_request", message: "A Hotelbeds rate comment code and date are required." }); return; }
  try { res.json({ provider: "HOTELBEDS", environment: hotelbedsEnvironment(), result: await new HotelbedsProvider().rateCommentDetails(parsed.data.code, parsed.data.date) }); } catch (error) { respondFailure(res, error); }
});

const guestSchema = z.object({ roomId: z.coerce.number().int().positive().optional(), name: z.string().trim().min(1).max(100), surname: z.string().trim().min(1).max(100), type: z.enum(["AD", "CH"]).default("AD"), age: z.coerce.number().int().min(0).max(120).optional() });
const bookingSchema = z.object({
  rateKey: z.string().trim().min(1).max(400),
  hotelName: z.string().trim().min(1).max(200),
  hotelAddress: z.string().trim().max(500).optional(),
  destination: z.string().trim().max(100).optional(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  roomType: z.string().trim().max(200).optional(),
  boardType: z.string().trim().max(100).optional(),
  rateType: z.string().trim().max(30).default("BOOKABLE"),
  hotelCategory: z.string().trim().max(100).optional(),
  price: z.coerce.number().positive(),
  currency: z.string().trim().length(3),
  rateComments: z.string().trim().max(2000).optional(),
  cancellationPolicies: z.array(z.record(z.string(), z.unknown())).default([]),
  holder: z.object({ name: z.string().trim().min(1).max(100), surname: z.string().trim().min(1).max(100), email: z.string().email(), phone: z.string().trim().min(7).max(30) }),
  rooms: z.array(z.object({ roomId: z.coerce.number().int().positive().optional(), paxes: z.array(guestSchema).min(1) })).min(1).max(8),
  idempotencyKey: z.string().trim().min(8).max(120),
  remark: z.string().trim().max(500).optional(),
});

const hotelCheckoutSchema = z.object({
  rateKey: z.string().trim().min(1).max(400),
  rateType: z.string().trim().max(30).default("BOOKABLE"),
  hotelName: z.string().trim().min(1).max(200),
  hotelCategory: z.string().trim().max(100).optional(),
  hotelAddress: z.string().trim().max(500).optional(),
  destination: z.string().trim().max(100).optional(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  roomType: z.string().trim().max(200).optional(),
  boardType: z.string().trim().max(100).optional(),
  currency: z.string().trim().length(3).default("INR"),
  rateComments: z.string().trim().max(2000).optional(),
  cancellationPolicies: z.array(z.record(z.string(), z.unknown())).default([]),
  holder: z.object({ name: z.string().trim().min(1).max(100), surname: z.string().trim().min(1).max(100), email: z.string().email(), phone: z.string().trim().min(7).max(30) }),
  rooms: z.array(z.object({ roomId: z.coerce.number().int().positive().optional(), paxes: z.array(guestSchema).min(1) })).min(1).max(8),
  idempotencyKey: z.string().trim().min(8).max(120),
  remark: z.string().trim().max(500).optional(),
});

function supplierStatus(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : undefined;
}

function supplierReference(value: Record<string, unknown>): string | undefined {
  const reference = value.reference || value.bookingReference || value.confirmationNumber;
  return typeof reference === "string" && reference.trim() ? reference.trim() : undefined;
}

function publicHotelBooking(booking: typeof bookingsTable.$inferSelect) {
  const payload = { ...(booking.payload || {}) } as Record<string, unknown>;
  const snapshot = { ...(booking.fareSnapshot || {}) } as Record<string, unknown>;
  delete payload.rateKey;
  delete snapshot.rateKey;
  return { ...booking, payload, fareSnapshot: snapshot };
}

async function refundHotelPayment(booking: typeof bookingsTable.$inferSelect, transaction: typeof paymentTransactionsTable.$inferSelect, reason: string) {
  const paymentProvider = getPaymentProvider();
  await db.update(bookingsTable).set({ status: "SUPPLIER_FAILED", paymentStatus: "REFUND_PENDING", updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id));
  await db.update(paymentTransactionsTable).set({ refundStatus: "REFUND_PENDING", updatedAt: new Date() }).where(eq(paymentTransactionsTable.id, transaction.id));
  try {
    const refund = await paymentProvider.refund({ paymentId: transaction.providerPaymentId || booking.paymentId || "", amount: transaction.capturedAmount || transaction.amount, reason });
    if (!refund.success || refund.status === "FAILED") throw new Error(refund.message);
    await db.update(paymentTransactionsTable).set({ refundStatus: "REFUND_PROCESSED", refundAmount: refund.amount, updatedAt: new Date() }).where(eq(paymentTransactionsTable.id, transaction.id));
    return db.update(bookingsTable).set({ paymentStatus: "REFUND_PROCESSED", updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
  } catch (error) {
    await db.update(paymentTransactionsTable).set({ refundStatus: "REFUND_FAILED", failureReason: error instanceof Error ? error.message : "Refund failed.", updatedAt: new Date() }).where(eq(paymentTransactionsTable.id, transaction.id));
    return db.update(bookingsTable).set({ status: "RECONCILIATION_REQUIRED", paymentStatus: "REFUND_FAILED", updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
  }
}

router.post("/hotelbeds/checkout", requireAuth, async (req, res): Promise<void> => {
  const parsed = hotelCheckoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ status: "invalid_request", message: "Valid Hotelbeds rate, guest, and stay details are required." }); return; }
  try {
    const existing = await db.select().from(bookingsTable).where(and(eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.kind, "HOTEL"), eq(bookingsTable.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
    if (existing[0]) {
      if (existing[0].paymentOrderId) { res.json({ booking: publicHotelBooking(existing[0]), duplicate: true, status: "PAYMENT_REQUIRED" }); return; }
      res.status(409).json({ status: "checkout_in_progress", message: "This hotel checkout is already being prepared." });
      return;
    }

    const provider = new HotelbedsProvider();
    const checked = await provider.checkRate(parsed.data.rateKey) as { rate?: Record<string, unknown> };
    const rate = checked.rate || {};
    const finalPrice = typeof rate.price === "number" ? rate.price : Number(rate.net ?? rate.sellingRate);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) throw new HotelbedsError(502, "invalid_response", "Hotelbeds did not return a payable final price.");
    const paymentAmount = Math.round(finalPrice);
    const finalCurrency = typeof rate.currency === "string" && rate.currency.trim() ? rate.currency : parsed.data.currency;
    const checkedRateKey = typeof rate.rateKey === "string" && rate.rateKey.trim() ? rate.rateKey : parsed.data.rateKey;
    const finalPolicies = Array.isArray(rate.cancellationPolicies) ? rate.cancellationPolicies : parsed.data.cancellationPolicies;
    const finalComments = typeof rate.rateComments === "string" ? rate.rateComments : parsed.data.rateComments;
    const reference = `WAY-HB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const snapshot = {
      provider: "HOTELBEDS", environment: hotelbedsEnvironment(), hotelName: parsed.data.hotelName, hotelCategory: parsed.data.hotelCategory,
      hotelbedsHotelId: typeof rate.hotelCode === "string" ? rate.hotelCode : undefined, hotelAddress: parsed.data.hotelAddress,
      destination: parsed.data.destination, roomType: parsed.data.roomType, boardType: parsed.data.boardType,
      rateKey: checkedRateKey, rateType: supplierStatus(rate.rateType) || supplierStatus(parsed.data.rateType) || "BOOKABLE",
      price: finalPrice, paymentAmount, currency: finalCurrency, cancellationPolicies: finalPolicies, rateComments: finalComments,
      rooms: parsed.data.rooms, holder: parsed.data.holder, checkIn: parsed.data.checkIn, checkOut: parsed.data.checkOut,
      createdAt: new Date().toISOString(), ownerId: req.user!.id, attemptId: reference,
    };
    const [booking] = await db.insert(bookingsTable).values({
      ownerId: req.user!.id, kind: "HOTEL", status: "PENDING", providerMode: "HOTELBEDS_TEST", providerReference: "PENDING", bookingReference: reference,
      amount: paymentAmount, paymentStatus: "PAYMENT_PENDING", idempotencyKey: parsed.data.idempotencyKey, fareSnapshot: snapshot, payload: snapshot,
    }).returning();
    const paymentProvider = getPaymentProvider();
    const order = await paymentProvider.createOrder({ amount: paymentAmount, currency: finalCurrency, receipt: reference, notes: { bookingId: booking.id, provider: "HOTELBEDS" } });
    const [transaction] = await db.insert(paymentTransactionsTable).values({ userId: req.user!.id, bookingId: booking.id, provider: order.provider, providerOrderId: order.orderId, amount: paymentAmount, requestedAmount: paymentAmount, currency: order.currency, status: "CREATED", idempotencyKey: parsed.data.idempotencyKey, metadata: { provider: "HOTELBEDS", bookingId: booking.id } }).returning();
    const [updatedBooking] = await db.update(bookingsTable).set({ paymentOrderId: order.orderId, updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
    res.status(201).json({ booking: publicHotelBooking(updatedBooking), transactionId: transaction.id, orderId: order.orderId, amount: order.amount, amountSubunits: order.amountSubunits, currency: order.currency, keyId: order.keyId, provider: order.provider, status: "PAYMENT_REQUIRED" });
  } catch (error) { req.log.error({ err: error }, "Hotelbeds payment checkout failed"); res.status(500).json({ status: "payment_checkout_error", message: "Hotelbeds payment checkout could not be created." }); }
});

router.post("/hotelbeds/bookings/:id/payment", requireAuth, async (req, res): Promise<void> => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  const parsedPayment = z.object({ orderId: z.string().trim().min(1), paymentId: z.string().trim().min(1), signature: z.string().trim().min(1) }).safeParse(req.body);
  if (!parsedId.success || !parsedPayment.success) { res.status(400).json({ status: "invalid_request", message: "A valid hotel booking and payment confirmation are required." }); return; }
  try {
    const [booking] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, parsedId.data), eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.kind, "HOTEL"))).limit(1);
    if (!booking) { res.status(404).json({ status: "not_found", message: "Hotel booking not found." }); return; }
    if (booking.status === "SUPPLIER_CONFIRMED") { res.json({ success: true, duplicate: true, booking: publicHotelBooking(booking) }); return; }
    if (["SUPPLIER_BOOKING_PENDING", "SUPPLIER_FAILED", "RECONCILIATION_REQUIRED", "REFUND_PENDING", "REFUND_FAILED"].includes(booking.status) || booking.paymentStatus === "REFUND_PROCESSED") { res.status(409).json({ status: booking.status.toLowerCase(), message: "This hotel booking is already being reconciled and will not be retried automatically." }); return; }
    if (booking.paymentOrderId !== parsedPayment.data.orderId) { res.status(409).json({ status: "payment_order_mismatch", message: "The payment order does not belong to this booking." }); return; }
    const paymentProvider = getPaymentProvider();
    const verification = await paymentProvider.verifyPayment(parsedPayment.data);
    if (!verification.verified) { res.status(400).json({ status: "verification_failed", verified: false, message: verification.error || "Payment verification failed." }); return; }
    const [transaction] = await db.select().from(paymentTransactionsTable).where(and(eq(paymentTransactionsTable.bookingId, booking.id), eq(paymentTransactionsTable.providerOrderId, parsedPayment.data.orderId), eq(paymentTransactionsTable.userId, req.user!.id))).limit(1);
    if (!transaction || transaction.providerPaymentId && transaction.providerPaymentId !== parsedPayment.data.paymentId) { res.status(409).json({ status: "payment_not_found", message: "The payment transaction is not linked to this booking." }); return; }
    if (transaction.status !== "CREATED" && transaction.status !== "CAPTURED") { res.status(409).json({ status: "payment_not_payable", message: "This payment is not payable." }); return; }
    await db.update(paymentTransactionsTable).set({ providerPaymentId: parsedPayment.data.paymentId, status: "CAPTURED", capturedAmount: transaction.amount, updatedAt: new Date() }).where(and(eq(paymentTransactionsTable.id, transaction.id), or(eq(paymentTransactionsTable.status, "CREATED"), eq(paymentTransactionsTable.status, "CAPTURED"))));
    const [claimed] = await db.update(bookingsTable).set({ status: "SUPPLIER_BOOKING_PENDING", paymentStatus: "PAYMENT_CAPTURED", paymentId: parsedPayment.data.paymentId, updatedAt: new Date() }).where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "PENDING"))).returning();
    if (!claimed) { res.status(409).json({ status: "supplier_claimed", message: "Supplier booking is already in progress." }); return; }
    const snapshot = (claimed.fareSnapshot || claimed.payload) as Record<string, unknown>;
    const provider = new HotelbedsProvider();
    let providerResult: Record<string, unknown>;
    try { providerResult = await provider.booking({ rateKey: String(snapshot.rateKey), clientReference: claimed.bookingReference, holder: snapshot.holder as { name: string; surname: string; email?: string; phone?: string }, rooms: snapshot.rooms as Array<{ roomId?: number; paxes: Array<{ roomId?: number; name: string; surname: string; type?: "AD" | "CH"; age?: number }> }>, remark: typeof snapshot.remark === "string" ? snapshot.remark : undefined }) as Record<string, unknown>; }
    catch (error) {
      if (error instanceof HotelbedsError && (error.code === "timeout" || error.code === "invalid_response")) { const [updated] = await db.update(bookingsTable).set({ status: "RECONCILIATION_REQUIRED", paymentStatus: "PAYMENT_CAPTURED", updatedAt: new Date() }).where(eq(bookingsTable.id, claimed.id)).returning(); res.status(202).json({ success: false, status: "RECONCILIATION_REQUIRED", booking: publicHotelBooking(updated), message: "Payment was captured, but Hotelbeds requires reconciliation before any retry." }); return; }
      const [updated] = await refundHotelPayment(claimed, transaction, "Hotelbeds booking failed after payment.");
      res.status(502).json({ success: false, status: updated?.paymentStatus || "REFUND_PENDING", booking: updated ? publicHotelBooking(updated) : updated, message: "Hotelbeds booking failed after payment; refund processing has started." }); return;
    }
    const supplierBooking = providerResult.booking && typeof providerResult.booking === "object" ? providerResult.booking as Record<string, unknown> : providerResult;
    const confirmedStatus = supplierStatus(supplierBooking.status);
    const reference = supplierReference(supplierBooking);
    if (confirmedStatus !== "CONFIRMED" || !reference) {
      const [updated] = await db.update(bookingsTable).set({ status: "RECONCILIATION_REQUIRED", paymentStatus: "PAYMENT_CAPTURED", providerReference: reference || "PENDING", payload: { ...claimed.payload, supplierResponse: { status: confirmedStatus, reference } }, updatedAt: new Date() }).where(eq(bookingsTable.id, claimed.id)).returning();
      res.status(202).json({ success: false, status: "RECONCILIATION_REQUIRED", booking: publicHotelBooking(updated), message: "Hotelbeds did not provide explicit confirmation; reconciliation is required." }); return;
    }
    const [updated] = await db.update(bookingsTable).set({ status: "SUPPLIER_CONFIRMED", paymentStatus: "PAYMENT_CAPTURED", providerReference: reference, payload: { ...claimed.payload, supplierResponse: supplierBooking, hotelbedsReference: reference }, updatedAt: new Date() }).where(eq(bookingsTable.id, claimed.id)).returning();
    res.json({ success: true, status: "SUPPLIER_CONFIRMED", booking: publicHotelBooking(updated), hotelbedsReference: reference, zelevosReference: claimed.bookingReference });
  } catch (error) { req.log.error({ err: error }, "Hotelbeds payment finalization failed"); res.status(500).json({ status: "payment_error", message: "Hotelbeds payment finalization could not be completed." }); }
});

router.post("/hotelbeds/bookings/:id/reconcile", requireAdmin, async (req, res): Promise<void> => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) { res.status(400).json({ status: "invalid_request", message: "A valid hotel booking id is required." }); return; }
  try {
    const [booking] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, parsedId.data), eq(bookingsTable.kind, "HOTEL"))).limit(1);
    if (!booking) { res.status(404).json({ status: "not_found", message: "Hotel booking not found." }); return; }
    if (booking.status === "SUPPLIER_CONFIRMED") { res.json({ status: "SUPPLIER_CONFIRMED", duplicate: true, booking: publicHotelBooking(booking) }); return; }
    if (!booking.providerReference || booking.providerReference === "PENDING") {
      const [updated] = await db.update(bookingsTable).set({ status: "RECONCILIATION_REQUIRED", cancellationDetails: { provider: "HOTELBEDS", reason: "Supplier reference is unavailable; no automatic retry was attempted.", reconciledAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
      res.status(202).json({ status: "RECONCILIATION_REQUIRED", retryAttempted: false, booking: publicHotelBooking(updated), message: "Hotelbeds supplier state cannot be safely verified without a supplier reference." });
      return;
    }
    const supplierResult = await new HotelbedsProvider().bookingDetails(booking.providerReference) as Record<string, unknown>;
    const supplierBooking = supplierResult.booking && typeof supplierResult.booking === "object" ? supplierResult.booking as Record<string, unknown> : supplierResult;
    const status = supplierStatus(supplierBooking.status);
    const reference = supplierReference(supplierBooking) || booking.providerReference;
    if (status === "CONFIRMED" && reference) {
      const [updated] = await db.update(bookingsTable).set({ status: "SUPPLIER_CONFIRMED", paymentStatus: "PAYMENT_CAPTURED", providerReference: reference, payload: { ...booking.payload, supplierResponse: supplierBooking, hotelbedsReference: reference }, cancellationDetails: { provider: "HOTELBEDS", reconciledAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
      res.json({ status: "SUPPLIER_CONFIRMED", retryAttempted: false, booking: publicHotelBooking(updated) });
      return;
    }
    const [updated] = await db.update(bookingsTable).set({ status: "RECONCILIATION_REQUIRED", providerReference: reference, cancellationDetails: { provider: "HOTELBEDS", supplierStatus: status || null, reason: "Supplier status remains ambiguous; no booking retry was attempted.", reconciledAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
    res.status(202).json({ status: "RECONCILIATION_REQUIRED", retryAttempted: false, booking: publicHotelBooking(updated) });
  } catch (error) { req.log.error({ err: error }, "Hotelbeds reconciliation failed"); res.status(502).json({ status: "RECONCILIATION_REQUIRED", message: "Hotelbeds supplier state could not be reconciled safely." }); }
});

router.post("/hotelbeds/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ status: "invalid_request", message: "Valid hotel guest, rate, and stay details are required." }); return; }
  res.status(410).json({ status: "payment_required", message: "Hotelbeds bookings must be created through the verified payment checkout flow." });
});

router.get("/hotelbeds/bookings/:reference", requireAuth, async (req, res): Promise<void> => {
  try { res.json({ provider: "HOTELBEDS", environment: hotelbedsEnvironment(), result: await new HotelbedsProvider().bookingDetails(String(req.params.reference)) }); } catch (error) { respondFailure(res, error); }
});

router.post("/hotelbeds/bookings/:reference/cancel", requireAuth, async (req, res): Promise<void> => {
  const reference = String(req.params.reference);
  try {
    const [booking] = await db.select().from(bookingsTable).where(and(
      eq(bookingsTable.ownerId, req.user!.id),
      eq(bookingsTable.kind, "HOTEL"),
      eq(bookingsTable.providerReference, reference),
    )).limit(1);
    if (!booking) {
      res.status(404).json({ status: "not_found", provider: "HOTELBEDS", environment: hotelbedsEnvironment(), message: "Hotelbeds booking was not found for this account." });
      return;
    }
    if (booking.status === "CANCELLED") {
      res.status(409).json({ status: "already_cancelled", provider: "HOTELBEDS", environment: hotelbedsEnvironment(), hotelbedsReference: reference, zelevosReference: booking.bookingReference });
      return;
    }
    const result = await new HotelbedsProvider().cancel(reference) as Record<string, unknown>;
    const supplierBooking = result.booking && typeof result.booking === "object" ? result.booking as Record<string, unknown> : result;
    if (String(supplierBooking.status || "").toUpperCase() !== "CANCELLED") {
      res.status(502).json({ status: "supplier_cancellation_unconfirmed", provider: "HOTELBEDS", environment: hotelbedsEnvironment(), hotelbedsReference: reference, zelevosReference: booking.bookingReference, message: "Hotelbeds did not confirm cancellation." });
      return;
    }
    const [updated] = await db.update(bookingsTable).set({
      status: "CANCELLED",
      cancellationDetails: { provider: "HOTELBEDS", environment: hotelbedsEnvironment(), hotelbedsReference: reference, supplierStatus: "CANCELLED", supplierCancellationReference: supplierBooking.cancellationReference || null, cancelledAt: new Date().toISOString() },
      updatedAt: new Date(),
    }).where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.ownerId, req.user!.id))).returning();
    res.json({ provider: "HOTELBEDS", environment: hotelbedsEnvironment(), status: "CANCELLED", booking: updated, result });
  } catch (error) { respondFailure(res, error); }
});

router.get("/hotelbeds/content/:hotelCode", async (req, res): Promise<void> => {
  if (!/^\d+$/.test(req.params.hotelCode)) { res.status(400).json({ status: "invalid_request", message: "Hotel code must be numeric." }); return; }
  try { res.json({ provider: "HOTELBEDS", environment: hotelbedsEnvironment(), result: await new HotelbedsProvider().content(req.params.hotelCode) }); } catch (error) { respondFailure(res, error); }
});

router.post("/hotelbeds/voucher", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ bookingId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ status: "invalid_request", message: "A valid Zelevos booking id is required." }); return; }
  const [booking] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, parsed.data.bookingId), eq(bookingsTable.ownerId, req.user!.id), eq(bookingsTable.kind, "HOTEL"))).limit(1);
  if (!booking) { res.status(404).json({ status: "not_found", message: "Hotel booking not found." }); return; }
  if (booking.status !== "SUPPLIER_CONFIRMED" && booking.status !== "CONFIRMED") { res.status(409).json({ status: "not_confirmed", message: "A voucher is available only after explicit Hotelbeds confirmation." }); return; }
  const voucher = { ...(booking.payload || {}), zelevosReference: booking.bookingReference, hotelbedsReference: booking.providerReference, status: booking.status };
  res.type("application/pdf").set("Content-Disposition", `attachment; filename="zelevos-hotel-${booking.bookingReference}.pdf"`).send(hotelbedsVoucherPdf(voucher));
});

export default router;