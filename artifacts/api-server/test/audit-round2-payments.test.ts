import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

/**
 * Audit round 2 - payments.
 *   P1  webhook vs /payments/verify race must never leave a paid booking PAYMENT_PENDING.
 *   P2  production must never be able to run with the test payment provider or an unsigned webhook.
 *   P3  the paid Google Maps proxy endpoints are throttled and cached.
 *
 * Every secret below is an obviously fake value. External HTTP providers (Razorpay, Google Maps) are replaced
 * by an in-process stub; any other outbound request is blocked, so nothing in this file can reach the network.
 */

const WEBHOOK_SECRET = "r2_fake_webhook_secret_for_tests_only_0001";
const LIVE_KEY_ID = "rzp_live_R2FakeKeyIdForTests01";
const LIVE_KEY_SECRET = "r2_fake_key_secret_for_tests_only_0002";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-audit-round2-payments-123456";
process.env.EMAIL_PROVIDER ??= "test";
process.env.PAYMENT_PROVIDER = "test";
process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

const paymentService = await import("../src/services/payment-service");
const { default: app } = await import("../src/app");
const {
  db,
  usersTable,
  partnersTable,
  bookingsTable,
  bookingServicesTable,
  commissionsTable,
  paymentsTable,
  paymentTransactionsTable,
} = await import("@workspace/db");
const { and, eq } = await import("drizzle-orm");
const { clearRateLimitStore } = await import("../src/middlewares/rate-limiter");
const { hashPassword } = await import("../src/lib/auth");

// ---------------------------------------------------------------------------
// Outbound network guard + provider stubs
// ---------------------------------------------------------------------------
type ExternalHandler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

const realFetch = globalThis.fetch;
const externalHandlers = new Map<string, ExternalHandler>();
const externalCalls: string[] = [];

const guardedFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    return realFetch(input, init);
  }
  externalCalls.push(`${init?.method ?? "GET"} ${url.hostname}${url.pathname}`);
  const handler = externalHandlers.get(url.hostname);
  if (!handler) {
    throw new Error(`Blocked unexpected external request during test: ${url.hostname}${url.pathname}`);
  }
  return handler(url, init);
};
globalThis.fetch = guardedFetch;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

// Razorpay stub: orders are created here, payments are "captured" by registering them.
const razorpayPayments = new Map<string, { order_id: string; amount: number; currency: string; status: string }>();
function installRazorpayStub(): void {
  externalHandlers.set("api.razorpay.com", async (url, init) => {
    if (url.pathname === "/v1/orders" && init?.method === "POST") {
      const sent = JSON.parse(String(init.body)) as { amount: number; currency: string };
      return jsonResponse({ id: `order_R2Live${crypto.randomBytes(6).toString("hex")}`, amount: sent.amount, currency: sent.currency });
    }
    const paymentMatch = /^\/v1\/payments\/([^/]+)$/.exec(url.pathname);
    if (paymentMatch && (init?.method ?? "GET") === "GET") {
      const known = razorpayPayments.get(decodeURIComponent(paymentMatch[1]));
      return known ? jsonResponse(known) : jsonResponse({ error: { description: "not found" } }, 404);
    }
    return jsonResponse({ error: { description: "unexpected stub call" } }, 500);
  });
}

// ---------------------------------------------------------------------------
// Env helper (always restores, deleting keys that were originally absent)
// ---------------------------------------------------------------------------
async function withEnv<T>(overrides: Record<string, string | undefined>, run: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const liveEnv = { PAYMENT_PROVIDER: "razorpay", RAZORPAY_KEY_ID: LIVE_KEY_ID, RAZORPAY_KEY_SECRET: LIVE_KEY_SECRET };

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
interface ApiBody {
  status?: string;
  message?: string;
  verified?: boolean;
  duplicate?: boolean;
  success?: boolean;
  ignored?: boolean;
  orderId?: string;
  transactionId?: string;
  results?: unknown[];
  route?: { origin: string; destination: string };
  retryAfterSeconds?: number;
  booking?: { id: string; status: string; paymentStatus: string };
}

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let customerId = "";
let customerCookie = "";
let partnerId = "";
const PARTNER_RATE_PERCENT = "7.5";

async function api(path: string, init: { method?: string; body?: string; headers?: Record<string, string>; cookie?: string } = {}) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.cookie) headers["Cookie"] = init.cookie;
  const response = await fetch(`${baseUrl}${path}`, { method: init.method, body: init.body, headers, redirect: "manual" });
  const text = await response.text();
  let body: ApiBody | string | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiBody) : null;
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body: (typeof body === "object" && body !== null ? body : {}) as ApiBody, text };
}

function postJson(path: string, payload: unknown, cookie?: string) {
  return api(path, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, cookie });
}

function sign(rawBody: string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

interface WebhookOptions {
  eventId?: string;
  signature?: string | null; // null => header omitted
  secret?: string;
  amountRupees?: number;
  rawBodyOverride?: string;
}

function postWebhook(event: string, orderId: string, paymentId: string, amountRupees: number, options: WebhookOptions = {}) {
  const rawBody = options.rawBodyOverride ?? JSON.stringify({
    id: options.eventId ?? `evt_${crypto.randomBytes(8).toString("hex")}`,
    event,
    payload: {
      payment: { entity: { id: paymentId, order_id: orderId, amount: Math.round((options.amountRupees ?? amountRupees) * 100), currency: "INR", status: event === "payment.failed" ? "failed" : "captured" } },
    },
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.signature !== null) headers["x-razorpay-signature"] = options.signature ?? sign(rawBody, options.secret);
  return api("/api/payments/webhook", { method: "POST", body: rawBody, headers });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
interface Checkout {
  bookingDbId: string;
  bookingCode: string;
  orderId: string;
  totalPrice: number;
  hasPartner: boolean;
  flightRequired: boolean;
  live: boolean;
}

let bookingCounter = 0;

async function seedCheckout(options: { partner?: boolean; flightRequired?: boolean; live?: boolean; bookingStatus?: string } = {}): Promise<Checkout> {
  bookingCounter += 1;
  const totalPrice = 43333 + bookingCounter;
  const bookingCode = `ZLR2${Date.now().toString().slice(-6)}${String(bookingCounter).padStart(3, "0")}`;
  const flightRequired = options.flightRequired ?? false;
  const [booking] = await db.insert(bookingsTable).values({
    bookingId: bookingCode,
    customerId,
    ownerId: customerId,
    partnerId: options.partner ? partnerId : undefined,
    status: options.bookingStatus ?? "PAYMENT_PENDING",
    paymentStatus: "PENDING",
    travelDate: "2026-12-05",
    adultsCount: 2,
    totalPrice,
    totalBaseCost: totalPrice - 9000,
    totalMarkup: 9000,
    serviceFee: 500,
    flightRequired,
    flightStatus: flightRequired ? "SUBJECT_TO_CONFIRMATION" : "NONE",
    timeline: [{ event: `Booking created with ID ${bookingCode}`, timestamp: new Date().toISOString(), actor: "Round 2 test", notes: "Awaiting customer payment" }],
    customerContact: { name: "Round Two", email: "round.two@example.com", phone: "+91 90000 00002" },
    kind: "PACKAGE",
    providerMode: "LIVE",
    providerReference: "R2-TEST-PACKAGE",
    bookingReference: bookingCode,
    amount: totalPrice,
  }).returning();

  const createOrder = () => postJson("/api/payments/order", { bookingId: booking.id, idempotencyKey: `r2-order-${bookingCode}` }, customerCookie);
  const order = options.live ? await withEnv(liveEnv, createOrder) : await createOrder();
  assert.equal(order.status, 201, `order creation failed: ${order.text}`);
  assert.ok(order.body.orderId, "order id expected");
  return { bookingDbId: booking.id, bookingCode, orderId: order.body.orderId as string, totalPrice, hasPartner: Boolean(options.partner), flightRequired, live: Boolean(options.live) };
}

function newPaymentId(): string {
  return `pay_r2_${crypto.randomBytes(7).toString("hex")}`;
}

/** Client side verify, mirroring what Razorpay Checkout's success handler posts. */
async function verifyPayment(checkout: Checkout, paymentId: string) {
  if (!checkout.live) {
    return postJson("/api/payments/verify", { orderId: checkout.orderId, paymentId, signature: "sig_test_valid" }, customerCookie);
  }
  razorpayPayments.set(paymentId, { order_id: checkout.orderId, amount: checkout.totalPrice * 100, currency: "INR", status: "captured" });
  const signature = crypto.createHmac("sha256", LIVE_KEY_SECRET).update(`${checkout.orderId}|${paymentId}`).digest("hex");
  return withEnv(liveEnv, () => postJson("/api/payments/verify", { orderId: checkout.orderId, paymentId, signature }, customerCookie));
}

async function snapshot(bookingDbId: string) {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingDbId));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.bookingId, bookingDbId));
  const commissions = await db.select().from(commissionsTable).where(eq(commissionsTable.bookingId, bookingDbId));
  const services = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.bookingId, bookingDbId));
  const [transaction] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.bookingId, bookingDbId));
  return { booking, payments, commissions, services, transaction };
}

/** The exact end state the existing happy path (/payments/verify alone) produces. */
async function assertConfirmedExactlyOnce(checkout: Checkout, paymentId: string) {
  const { booking, payments, commissions, services, transaction } = await snapshot(checkout.bookingDbId);

  assert.equal(booking.status, "PROCESSING", "booking must be finalised (PAID -> PROCESSING once fulfilment tasks exist)");
  assert.equal(booking.paymentStatus, "SUCCESSFUL");
  assert.equal(booking.paymentId, paymentId);

  assert.equal(payments.length, 1, "exactly one payments row");
  assert.equal(payments[0].status, "SUCCESSFUL");
  assert.equal(payments[0].verificationStatus, "VERIFIED");
  assert.equal(payments[0].razorpayOrderId, checkout.orderId);
  assert.equal(payments[0].razorpayPaymentId, paymentId);
  assert.equal(payments[0].amount, checkout.totalPrice);
  assert.equal(payments[0].currency, "INR");
  assert.equal(payments[0].userId, customerId);
  assert.equal(payments[0].receiptNumber, `REC-${checkout.bookingCode}`);

  if (checkout.hasPartner) {
    assert.equal(commissions.length, 1, "exactly one commission row");
    assert.equal(commissions[0].partnerId, partnerId);
    assert.equal(commissions[0].bookingAmount, checkout.totalPrice);
    assert.equal(Number(commissions[0].commissionPercent), Number(PARTNER_RATE_PERCENT));
    assert.equal(commissions[0].commissionAmount, Math.round((checkout.totalPrice * Number(PARTNER_RATE_PERCENT)) / 100));
    assert.equal(commissions[0].status, "PENDING");
  } else {
    assert.equal(commissions.length, 0, "no partner referral => no commission");
  }

  const serviceTypes = services.map((service: { serviceType: string }) => service.serviceType).sort();
  assert.deepEqual(serviceTypes, checkout.flightRequired ? ["activity", "flight_partner", "hotel", "transfer"] : ["activity", "hotel", "transfer"], "fulfilment tasks created exactly once");

  const timeline: Array<{ event: string }> = booking.timeline;
  assert.equal(timeline.filter((entry) => entry.event.startsWith("Payment of")).length, 1, "payment timeline entry written once");
  assert.equal(timeline.filter((entry) => entry.event === "PAYMENT_CAPTURED").length, 1, "fulfilment timeline entry written once");

  assert.equal(transaction.status, "CAPTURED");
  assert.equal(transaction.providerPaymentId, paymentId);
  assert.equal(transaction.capturedAmount, checkout.totalPrice);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  const suffix = crypto.randomBytes(5).toString("hex");
  const [partner] = await db.insert(partnersTable).values({
    partnerId: `PRT-R2-${suffix}`,
    agencyName: "Round Two Travel",
    contactName: "Round Two Partner",
    email: `partner-r2-${suffix}@example.com`,
    phone: "+91 90000 00003",
    referralCode: `R2REF${suffix.toUpperCase()}`,
    commissionRatePercent: PARTNER_RATE_PERCENT,
    status: "approved",
  }).returning();
  partnerId = partner.id;

  const email = `customer-r2-${suffix}@example.com`;
  const [customer] = await db.insert(usersTable).values({
    email,
    fullName: "Round Two Customer",
    passwordHash: hashPassword("RoundTwoPass123!"),
    role: "customer",
    emailVerified: true,
    status: "active",
  }).returning();
  customerId = customer.id;

  const login = await postJson("/api/auth/login", { email, password: "RoundTwoPass123!" });
  assert.equal(login.status, 200, `customer login failed: ${login.text}`);
  customerCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.ok(customerCookie, "customer session cookie expected");

  installRazorpayStub();
});

beforeEach(() => {
  clearRateLimitStore();
});

after(async () => {
  clearRateLimitStore();
  globalThis.fetch = realFetch;
  if (originalMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ===========================================================================
// P1 - webhook vs verify finalisation
// ===========================================================================
describe("P1: a captured payment always finalises its booking exactly once", () => {
  it("P1 control: /payments/verify alone finalises (baseline happy path)", async () => {
    const checkout = await seedCheckout({ partner: true });
    const paymentId = newPaymentId();
    const verify = await verifyPayment(checkout, paymentId);
    assert.equal(verify.status, 200, verify.text);
    assert.equal(verify.body.verified, true);
    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1a: webhook arrives first, then /payments/verify -> booking finalised once (partner commission x1)", async () => {
    const checkout = await seedCheckout({ partner: true });
    const paymentId = newPaymentId();

    const hook = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice);
    assert.equal(hook.status, 200, hook.text);

    const verify = await verifyPayment(checkout, paymentId);
    assert.equal(verify.status, 200, verify.text);
    assert.equal(verify.body.verified, true);

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1b: /payments/verify first, then webhook -> no duplicate rows and paymentStatus is not clobbered (no partner => no commission)", async () => {
    const checkout = await seedCheckout({ partner: false });
    const paymentId = newPaymentId();

    const verify = await verifyPayment(checkout, paymentId);
    assert.equal(verify.status, 200, verify.text);

    const hook = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice);
    assert.equal(hook.status, 200, hook.text);

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1c: the same webhook delivered twice is idempotent and finalises the booking", async () => {
    const checkout = await seedCheckout({ partner: true });
    const paymentId = newPaymentId();
    const eventId = `evt_${crypto.randomBytes(8).toString("hex")}`;

    const first = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { eventId });
    assert.equal(first.status, 200, first.text);
    const second = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { eventId });
    assert.equal(second.status, 200, second.text);
    assert.equal(second.body.duplicate, true, "second delivery of the same event id is reported as a duplicate");

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1d: payment.captured then order.paid (different event ids) then verify -> still exactly one finalisation", async () => {
    const checkout = await seedCheckout({ partner: true });
    const paymentId = newPaymentId();

    assert.equal((await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice)).status, 200);
    assert.equal((await postWebhook("order.paid", checkout.orderId, paymentId, checkout.totalPrice)).status, 200);
    const verify = await verifyPayment(checkout, paymentId);
    assert.equal(verify.status, 200, verify.text);

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1e: concurrent webhook + verify + retries finalise exactly once (partner + flight desk task)", async () => {
    const checkout = await seedCheckout({ partner: true, flightRequired: true });
    const paymentId = newPaymentId();
    const eventId = `evt_${crypto.randomBytes(8).toString("hex")}`;

    const results = await Promise.all([
      postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { eventId }),
      verifyPayment(checkout, paymentId),
      postWebhook("order.paid", checkout.orderId, paymentId, checkout.totalPrice),
      verifyPayment(checkout, paymentId),
      postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { eventId }),
      verifyPayment(checkout, paymentId),
    ]);
    for (const result of results) {
      assert.equal(result.status, 200, `every concurrent caller must succeed, got ${result.status}: ${result.text}`);
    }

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1f: a late payment.failed webhook does not downgrade an already paid booking", async () => {
    const checkout = await seedCheckout({ partner: false });
    const paymentId = newPaymentId();

    const verify = await verifyPayment(checkout, paymentId);
    assert.equal(verify.status, 200, verify.text);
    const late = await postWebhook("payment.failed", checkout.orderId, newPaymentId(), checkout.totalPrice);
    assert.equal(late.status, 200, late.text);

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1g: a captured webhook never resurrects a cancelled booking", async () => {
    const checkout = await seedCheckout({ partner: true });
    await db.update(bookingsTable).set({ status: "CANCELLED" }).where(eq(bookingsTable.id, checkout.bookingDbId));

    const hook = await postWebhook("payment.captured", checkout.orderId, newPaymentId(), checkout.totalPrice);
    assert.equal(hook.status, 200, hook.text);

    const { booking, payments, commissions, services } = await snapshot(checkout.bookingDbId);
    assert.equal(booking.status, "CANCELLED");
    assert.equal(payments.length, 0);
    assert.equal(commissions.length, 0);
    assert.equal(services.length, 0);
  });

  it("P1h: a webhook whose amount differs from the order cannot confirm the booking", async () => {
    const checkout = await seedCheckout({ partner: true });
    const hook = await postWebhook("payment.captured", checkout.orderId, newPaymentId(), checkout.totalPrice, { amountRupees: 1 });
    assert.equal(hook.status, 400, hook.text);
    assert.equal(hook.body.status, "amount_mismatch");

    const { booking, payments, transaction } = await snapshot(checkout.bookingDbId);
    assert.equal(booking.status, "PAYMENT_PENDING");
    assert.equal(payments.length, 0);
    assert.equal(transaction.status, "CREATED");
  });

  it("P1i (live Razorpay provider, stubbed HTTP): webhook first, then /payments/verify -> finalised once", async () => {
    const checkout = await seedCheckout({ partner: true, live: true });
    const paymentId = newPaymentId();

    const hook = await withEnv(liveEnv, () => postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice));
    assert.equal(hook.status, 200, hook.text);
    const verify = await verifyPayment(checkout, paymentId);
    assert.equal(verify.status, 200, verify.text);
    assert.equal(verify.body.verified, true);

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1j (live): POST /bookings/:id/payment alone finalises exactly once, with the partner commission", async () => {
    const checkout = await seedCheckout({ partner: true, live: true });
    const paymentId = newPaymentId();
    razorpayPayments.set(paymentId, { order_id: checkout.orderId, amount: checkout.totalPrice * 100, currency: "INR", status: "captured" });
    const signature = crypto.createHmac("sha256", LIVE_KEY_SECRET).update(`${checkout.orderId}|${paymentId}`).digest("hex");

    const paid = await withEnv(liveEnv, () => postJson(`/api/bookings/${checkout.bookingDbId}/payment`, { orderId: checkout.orderId, paymentId, signature }, customerCookie));
    assert.equal(paid.status, 200, paid.text);
    assert.equal(paid.body.success, true);
    assert.equal(paid.body.duplicate, false);

    await assertConfirmedExactlyOnce(checkout, paymentId);

    const replay = await withEnv(liveEnv, () => postJson(`/api/bookings/${checkout.bookingDbId}/payment`, { orderId: checkout.orderId, paymentId, signature }, customerCookie));
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.body.duplicate, true);
    await assertConfirmedExactlyOnce(checkout, paymentId);
  });

  it("P1k (live): webhook first, then POST /bookings/:id/payment -> reported as success (duplicate), no second finalisation", async () => {
    const checkout = await seedCheckout({ partner: true, live: true });
    const paymentId = newPaymentId();
    razorpayPayments.set(paymentId, { order_id: checkout.orderId, amount: checkout.totalPrice * 100, currency: "INR", status: "captured" });
    const signature = crypto.createHmac("sha256", LIVE_KEY_SECRET).update(`${checkout.orderId}|${paymentId}`).digest("hex");

    const hook = await withEnv(liveEnv, () => postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice));
    assert.equal(hook.status, 200, hook.text);
    const paid = await withEnv(liveEnv, () => postJson(`/api/bookings/${checkout.bookingDbId}/payment`, { orderId: checkout.orderId, paymentId, signature }, customerCookie));
    assert.equal(paid.status, 200, paid.text);
    assert.equal(paid.body.success, true);

    await assertConfirmedExactlyOnce(checkout, paymentId);
  });
});

// ===========================================================================
// P2 - production payment configuration must fail closed
// ===========================================================================
describe("P2: production payment configuration fails closed", () => {
  const validProduction = {
    NODE_ENV: "production",
    PAYMENT_PROVIDER: "razorpay",
    RAZORPAY_KEY_ID: LIVE_KEY_ID,
    RAZORPAY_KEY_SECRET: LIVE_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  };

  function assertRejects(env: Record<string, string | undefined>, pattern: RegExp) {
    assert.throws(() => paymentService.assertProductionPaymentConfig(env), (error: unknown) => error instanceof Error && pattern.test(error.message));
  }

  it("P2: assertProductionPaymentConfig rejects PAYMENT_PROVIDER=test in production", () => {
    assertRejects({ ...validProduction, PAYMENT_PROVIDER: "test" }, /PAYMENT_PROVIDER/);
    assertRejects({ ...validProduction, PAYMENT_PROVIDER: "  TEST " }, /PAYMENT_PROVIDER/);
  });

  it("P2: assertProductionPaymentConfig rejects a missing or blank RAZORPAY_WEBHOOK_SECRET in production", () => {
    assertRejects({ ...validProduction, RAZORPAY_WEBHOOK_SECRET: undefined }, /RAZORPAY_WEBHOOK_SECRET/);
    assertRejects({ ...validProduction, RAZORPAY_WEBHOOK_SECRET: "" }, /RAZORPAY_WEBHOOK_SECRET/);
    assertRejects({ ...validProduction, RAZORPAY_WEBHOOK_SECRET: "   " }, /RAZORPAY_WEBHOOK_SECRET/);
  });

  it("P2: assertProductionPaymentConfig rejects missing or blank Razorpay key id / key secret in production", () => {
    assertRejects({ ...validProduction, RAZORPAY_KEY_ID: undefined }, /RAZORPAY_KEY_ID/);
    assertRejects({ ...validProduction, RAZORPAY_KEY_ID: " " }, /RAZORPAY_KEY_ID/);
    assertRejects({ ...validProduction, RAZORPAY_KEY_SECRET: undefined }, /RAZORPAY_KEY_SECRET/);
    assertRejects({ ...validProduction, RAZORPAY_KEY_SECRET: "" }, /RAZORPAY_KEY_SECRET/);
  });

  it("P2: assertProductionPaymentConfig reports every problem at once", () => {
    assertRejects({ NODE_ENV: "production", PAYMENT_PROVIDER: "test" }, /PAYMENT_PROVIDER[\s\S]*RAZORPAY_KEY_ID[\s\S]*RAZORPAY_KEY_SECRET[\s\S]*RAZORPAY_WEBHOOK_SECRET/);
  });

  it("P2: assertProductionPaymentConfig accepts a complete production config (rzp_test_ staging keys are not rejected)", () => {
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig(validProduction));
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig({ ...validProduction, PAYMENT_PROVIDER: undefined }));
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig({ ...validProduction, RAZORPAY_KEY_ID: "rzp_test_R2FakeStagingKey01" }));
  });

  it("P2: assertProductionPaymentConfig does not restrict non-production environments", () => {
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig({ NODE_ENV: "development", PAYMENT_PROVIDER: "test" }));
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig({ NODE_ENV: "test", PAYMENT_PROVIDER: "test" }));
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig({ PAYMENT_PROVIDER: "test" }));
    assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig({}));
  });

  it("P2: assertProductionPaymentConfig defaults to process.env", async () => {
    await withEnv({ NODE_ENV: "production", PAYMENT_PROVIDER: "test" }, () => {
      assert.throws(() => paymentService.assertProductionPaymentConfig(), /PAYMENT_PROVIDER/);
    });
    await withEnv({ NODE_ENV: "development", PAYMENT_PROVIDER: "test" }, () => {
      assert.doesNotThrow(() => paymentService.assertProductionPaymentConfig());
    });
  });

  it("P2: getPaymentProvider() never returns the test provider in production", async () => {
    await withEnv({ NODE_ENV: "production", PAYMENT_PROVIDER: "test", RAZORPAY_KEY_ID: LIVE_KEY_ID, RAZORPAY_KEY_SECRET: LIVE_KEY_SECRET }, () => {
      assert.throws(() => paymentService.getPaymentProvider(), /production/i);
    });
    await withEnv({ NODE_ENV: "production", PAYMENT_PROVIDER: "test", RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, () => {
      assert.throws(() => paymentService.getPaymentProvider(), /production|not configured/i);
    });
    await withEnv({ NODE_ENV: "production", PAYMENT_PROVIDER: undefined, RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, () => {
      assert.throws(() => paymentService.getPaymentProvider(), /not configured/i);
    });
    await withEnv({ NODE_ENV: "production", PAYMENT_PROVIDER: undefined, RAZORPAY_KEY_ID: LIVE_KEY_ID, RAZORPAY_KEY_SECRET: LIVE_KEY_SECRET }, () => {
      const provider = paymentService.getPaymentProvider();
      assert.equal(provider.mode, "LIVE");
      assert.ok(!(provider instanceof paymentService.TestPaymentProvider));
    });
  });

  it("P2: the test provider cannot even be constructed in production", async () => {
    await withEnv({ NODE_ENV: "production" }, () => {
      assert.throws(() => new paymentService.TestPaymentProvider(), /production/i);
    });
    await withEnv({ NODE_ENV: "development" }, () => {
      assert.equal(new paymentService.TestPaymentProvider().mode, "TEST");
    });
  });

  it("P2: outside production the factory still serves the test provider (existing suites rely on it)", async () => {
    await withEnv({ NODE_ENV: "development", PAYMENT_PROVIDER: "test" }, () => {
      assert.equal(paymentService.getPaymentProvider().mode, "TEST");
    });
  });

  it("P2: webhook without RAZORPAY_WEBHOOK_SECRET is refused (503) in every environment and changes nothing", async () => {
    const checkout = await seedCheckout({ partner: true });
    const paymentId = newPaymentId();
    const unsigned = await withEnv({ RAZORPAY_WEBHOOK_SECRET: undefined }, () => postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { signature: null }));
    assert.equal(unsigned.status, 503, `an unsigned webhook must not be processed: ${unsigned.text}`);
    const signedWithGuess = await withEnv({ RAZORPAY_WEBHOOK_SECRET: "" }, () => postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { signature: "sig_test_valid" }));
    assert.equal(signedWithGuess.status, 503, signedWithGuess.text);

    const { booking, payments, transaction } = await snapshot(checkout.bookingDbId);
    assert.equal(booking.status, "PAYMENT_PENDING");
    assert.equal(booking.paymentStatus, "PENDING");
    assert.equal(payments.length, 0);
    assert.equal(transaction.status, "CREATED");
  });

  it("P2: webhook without RAZORPAY_WEBHOOK_SECRET is refused (503) when NODE_ENV=production", async () => {
    const checkout = await seedCheckout({ partner: true });
    const response = await withEnv({ NODE_ENV: "production", RAZORPAY_WEBHOOK_SECRET: undefined }, () => postWebhook("payment.captured", checkout.orderId, newPaymentId(), checkout.totalPrice, { signature: null }));
    assert.equal(response.status, 503, response.text);
    assert.equal((await snapshot(checkout.bookingDbId)).booking.status, "PAYMENT_PENDING");
  });

  it("P2: webhook with a missing, wrong, or body-mismatched signature is rejected (400) and changes nothing", async () => {
    const checkout = await seedCheckout({ partner: true });
    const paymentId = newPaymentId();

    const missing = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { signature: null });
    assert.equal(missing.status, 400, missing.text);
    const wrong = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { signature: "0".repeat(64) });
    assert.equal(wrong.status, 400, wrong.text);
    const wrongSecret = await postWebhook("payment.captured", checkout.orderId, paymentId, checkout.totalPrice, { secret: "some-other-secret" });
    assert.equal(wrongSecret.status, 400, wrongSecret.text);

    const signedBody = JSON.stringify({ id: "evt_signed", event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: checkout.orderId, amount: 100 } } } });
    const tamperedBody = JSON.stringify({ id: "evt_tampered", event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: checkout.orderId, amount: checkout.totalPrice * 100 } } } });
    const tampered = await api("/api/payments/webhook", { method: "POST", body: tamperedBody, headers: { "Content-Type": "application/json", "x-razorpay-signature": sign(signedBody) } });
    assert.equal(tampered.status, 400, tampered.text);

    const { booking, payments, transaction } = await snapshot(checkout.bookingDbId);
    assert.equal(booking.status, "PAYMENT_PENDING");
    assert.equal(payments.length, 0);
    assert.equal(transaction.status, "CREATED");
  });

  it("P2: in production the test provider's magic webhook signature is not accepted (webhook refuses to run with the test provider)", async () => {
    const checkout = await seedCheckout({ partner: true });
    const response = await withEnv(
      { NODE_ENV: "production", PAYMENT_PROVIDER: "test", RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET },
      () => postWebhook("payment.captured", checkout.orderId, newPaymentId(), checkout.totalPrice, { signature: "sig_test_valid" }),
    );
    assert.ok(response.status >= 400, `the webhook must not be accepted with the test provider in production, got ${response.status}: ${response.text}`);

    const { booking, payments, transaction } = await snapshot(checkout.bookingDbId);
    assert.equal(booking.status, "PAYMENT_PENDING");
    assert.equal(payments.length, 0);
    assert.equal(transaction.status, "CREATED");
  });

  it("P2: in production the checkout verify endpoint cannot be satisfied with test-provider magic signatures", async () => {
    const checkout = await seedCheckout({ partner: true });
    const response = await withEnv(
      { NODE_ENV: "production", PAYMENT_PROVIDER: "test" },
      () => postJson("/api/payments/verify", { orderId: checkout.orderId, paymentId: "pay_test_free_booking", signature: "sig_test_valid" }, customerCookie),
    );
    assert.ok(response.status >= 400, `verify must fail closed, got ${response.status}: ${response.text}`);

    const { booking, payments } = await snapshot(checkout.bookingDbId);
    assert.equal(booking.status, "PAYMENT_PENDING");
    assert.equal(payments.length, 0);
  });
});

// ===========================================================================
// P3 - Google Maps proxy endpoints (public: used by logged-out visitors on the
//      home page Travel Hub, the planner and /flights) => throttled + cached
// ===========================================================================
describe("P3: Google Maps proxy endpoints are throttled and cached", () => {
  const mapsUrl = "maps.googleapis.com";
  const googleCalls = () => externalCalls.filter((call) => call.includes(mapsUrl));

  function installGoogleStub() {
    externalHandlers.set(mapsUrl, (url) => {
      if (url.pathname.endsWith("/place/autocomplete/json")) {
        return jsonResponse({ status: "OK", predictions: [{ place_id: "place_r2_1", description: "Goa, India", structured_formatting: { main_text: "Goa", secondary_text: "India" } }] });
      }
      if (url.pathname.endsWith("/directions/json")) {
        return jsonResponse({ status: "OK", routes: [{ overview_polyline: { points: "r2poly" }, legs: [{ distance: { value: 1200, text: "1.2 km" }, duration: { value: 300, text: "5 mins" } }] }] });
      }
      if (url.pathname.endsWith("/staticmap")) {
        return new Response(Buffer.from("R2-FAKE-PNG"), { status: 200, headers: { "content-type": "image/png" } });
      }
      return jsonResponse({ status: "REQUEST_DENIED" }, 403);
    });
  }

  it("P3: anonymous visitors still reach the endpoints (public by design) but fail closed without an API key and never touch the network", async () => {
    await withEnv({ GOOGLE_MAPS_API_KEY: undefined }, async () => {
      const before = externalCalls.length;
      const autocomplete = await api("/api/maps/autocomplete?input=Goa");
      assert.equal(autocomplete.status, 503, autocomplete.text);
      assert.equal(autocomplete.body.status, "maps_unavailable");
      assert.deepEqual(autocomplete.body.results, []);
      const route = await api("/api/maps/route?origin=Goa&destination=Pune");
      assert.equal(route.status, 503, route.text);
      const staticMap = await api("/api/maps/static?origin=Goa&destination=Pune");
      assert.equal(staticMap.status, 503, staticMap.text);
      assert.equal(externalCalls.length, before, "no outbound request may be attempted without an API key");
    });
  });

  it("P3: over-long queries are rejected before any paid lookup", async () => {
    await withEnv({ GOOGLE_MAPS_API_KEY: "r2-fake-maps-key-not-real" }, async () => {
      installGoogleStub();
      try {
        const before = googleCalls().length;
        const longInput = "a".repeat(5000);
        const autocomplete = await api(`/api/maps/autocomplete?input=${longInput}`);
        assert.equal(autocomplete.status, 400, autocomplete.text);
        const route = await api(`/api/maps/route?origin=${longInput}&destination=Pune`);
        assert.equal(route.status, 400, route.text);
        assert.equal(googleCalls().length, before, "rejected requests must not reach Google");
      } finally {
        externalHandlers.delete(mapsUrl);
      }
    });
  });

  it("P3: repeated lookups are served from a normalised, bounded TTL cache instead of paying Google again", async () => {
    await withEnv({ GOOGLE_MAPS_API_KEY: "r2-fake-maps-key-not-real" }, async () => {
      installGoogleStub();
      try {
        const start = googleCalls().length;

        const first = await api("/api/maps/autocomplete?input=Goa%20Beach");
        assert.equal(first.status, 200, first.text);
        assert.equal(googleCalls().length - start, 1);
        const second = await api("/api/maps/autocomplete?input=%20%20goa%20%20BEACH%20");
        assert.equal(second.status, 200, second.text);
        assert.deepEqual(second.body, first.body);
        assert.equal(googleCalls().length - start, 1, "same query (case / whitespace differences) must hit the cache");
        const other = await api("/api/maps/autocomplete?input=Manali");
        assert.equal(other.status, 200, other.text);
        assert.equal(googleCalls().length - start, 2, "a different query is a cache miss");

        const routeBefore = googleCalls().length;
        const route = await api("/api/maps/route?origin=Delhi%20airport&destination=Manali%20airport");
        assert.equal(route.status, 200, route.text);
        assert.equal(googleCalls().length - routeBefore, 1);
        const image = await api("/api/maps/static?origin=delhi%20airport&destination=MANALI%20airport");
        assert.equal(image.status, 200);
        assert.equal(image.text, "R2-FAKE-PNG");
        assert.equal(googleCalls().length - routeBefore, 2, "static map reuses the cached route: only the static image is fetched");
        const imageAgain = await api("/api/maps/static?origin=Delhi%20Airport&destination=Manali%20Airport");
        assert.equal(imageAgain.status, 200);
        const routeAgain = await api("/api/maps/route?origin=Delhi%20Airport&destination=Manali%20Airport");
        assert.equal(routeAgain.status, 200, routeAgain.text);
        assert.equal(googleCalls().length - routeBefore, 2, "repeat static/route requests are fully cached");
      } finally {
        externalHandlers.delete(mapsUrl);
      }
    });
  });

  it("P3: upstream failures are not cached", async () => {
    await withEnv({ GOOGLE_MAPS_API_KEY: "r2-fake-maps-key-not-real" }, async () => {
      let healthy = false;
      externalHandlers.set(mapsUrl, () => (healthy
        ? jsonResponse({ status: "OK", predictions: [{ place_id: "place_r2_2", description: "Kochi, India", structured_formatting: { main_text: "Kochi", secondary_text: "India" } }] })
        : jsonResponse({ status: "OVER_QUERY_LIMIT", error_message: "quota" }, 200)));
      try {
        const failing = await api("/api/maps/autocomplete?input=Kochi%20Fort");
        assert.equal(failing.status, 503, failing.text);
        healthy = true;
        const recovered = await api("/api/maps/autocomplete?input=Kochi%20Fort");
        assert.equal(recovered.status, 200, recovered.text);
        assert.equal(recovered.body.results?.length, 1);
      } finally {
        externalHandlers.delete(mapsUrl);
      }
    });
  });

  it("P3: anonymous callers are rate limited per IP (429 after 30 requests/minute) with a dedicated limiter", async () => {
    await withEnv({ ENABLE_TEST_RATE_LIMIT: "1", GOOGLE_MAPS_API_KEY: undefined }, async () => {
      clearRateLimitStore();
      try {
        const statuses: number[] = [];
        for (let i = 1; i <= 30; i += 1) {
          statuses.push((await api(`/api/maps/autocomplete?input=Goa${i}`)).status);
        }
        assert.ok(statuses.every((status) => status === 503), `the first 30 lookups are allowed through (fail closed, no key): ${statuses.join(",")}`);

        const limited = await api("/api/maps/autocomplete?input=Goa31");
        assert.equal(limited.status, 429, limited.text);
        assert.equal(limited.body.status, "rate_limited");
        assert.equal(limited.headers.get("x-ratelimit-limit"), "30", "the dedicated maps limiter (30/min), not the 200/min global one, must be the one that answered");
        assert.ok(limited.headers.get("retry-after"));

        const otherEndpoint = await api("/api/maps/route?origin=Goa&destination=Pune");
        assert.equal(otherEndpoint.status, 429, "the three maps endpoints share one per-IP budget");
      } finally {
        clearRateLimitStore();
      }
    });
  });
});
