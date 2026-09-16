import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "hotelbeds-payment-test-session";
process.env.PAYMENT_PROVIDER = "test";
process.env.HOTELBEDS_HOTEL_API_KEY = "hotelbeds-test-key";
process.env.HOTELBEDS_HOTEL_SECRET = "hotelbeds-test-secret";
process.env.HOTELBEDS_HOTEL_BASE_URL = "https://api.test.hotelbeds.com";

const { default: app } = await import("../src/app");
const { db, bookingsTable, paymentTransactionsTable, usersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let userId = "";
let cookie = "";
let originalFetch: typeof fetch;
let bookingResponses: Array<unknown> = [];
let hotelbedsPaths: string[] = [];

function hotelbedsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(init.headers || {}) } });
  const body = await response.json() as Record<string, unknown>;
  return { response, body };
}

function checkoutBody(idempotencyKey: string) {
  return {
    rateKey: "rate-key-test", rateType: "RECHECK", hotelName: "Test Hotel", destination: "London", checkIn: "2030-01-10", checkOut: "2030-01-12",
    roomType: "Double Room", boardType: "Breakfast", currency: "INR", price: 1, cancellationPolicies: [],
    holder: { name: "Lead", surname: "Guest", email: "lead@example.com", phone: "0000000000" },
    rooms: [{ roomId: 1, paxes: [{ roomId: 1, name: "Lead", surname: "Guest", type: "AD" }] }], idempotencyKey,
  };
}

describe("Hotelbeds Razorpay orchestration", { concurrency: false }, () => {
  before(async () => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith("https://api.test.hotelbeds.com")) return originalFetch(input, init);
      const path = new URL(url).pathname;
      hotelbedsPaths.push(path);
      if (path.endsWith("/checkrates")) return hotelbedsResponse({ rate: { rateKey: "rate-final", rateType: "BOOKABLE", net: "123.45", currency: "INR", cancellationPolicies: [] } });
      if (path.endsWith("/bookings")) {
        const next = bookingResponses.shift() as { httpStatus?: number; body?: unknown } | unknown;
        if (next && typeof next === "object" && "httpStatus" in next) {
          const fixture = next as { httpStatus: number; body: unknown };
          return hotelbedsResponse(fixture.body, fixture.httpStatus);
        }
        return hotelbedsResponse(next || { booking: { reference: "HB-CONFIRMED", status: "CONFIRMED" } });
      }
      return hotelbedsResponse({ hotels: [] });
    }) as typeof fetch;
    const signup = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: `hotel-payment-${Date.now()}@example.com`, password: "password123456" }) });
    assert.equal(signup.response.status, 201);
    userId = String((signup.body.user as Record<string, unknown>).id);
    cookie = signup.response.headers.get("set-cookie")?.split(";")[0] || "";
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (userId) {
      const bookings = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(inArray(bookingsTable.ownerId, [userId]));
      if (bookings.length) await db.delete(paymentTransactionsTable).where(inArray(paymentTransactionsTable.bookingId, bookings.map((booking) => booking.id)));
      await db.delete(bookingsTable).where(inArray(bookingsTable.ownerId, [userId]));
      await db.delete(usersTable).where(inArray(usersTable.id, [userId]));
    }
    server.close();
  });

  it("uses CheckRate price for the Razorpay order and rejects invalid payment before Hotelbeds booking", async () => {
    hotelbedsPaths = [];
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify(checkoutBody(`hotel-payment-${Date.now()}`)) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    assert.equal(checkout.body.amount, 123);
    assert.equal(checkout.body.amountSubunits, 12300);
    assert.deepEqual(hotelbedsPaths, ["/hotel-api/1.0/checkrates"]);
    const payment = await api(`/api/hotelbeds/bookings/${String((checkout.body.booking as Record<string, unknown>).id)}/payment`, { method: "POST", body: JSON.stringify({ orderId: checkout.body.orderId, paymentId: "pay-test-invalid", signature: "sig_test_invalid" }) });
    assert.equal(payment.response.status, 400);
    assert.equal(hotelbedsPaths.includes("/hotel-api/1.0/bookings"), false);
  });

  it("books once after verified payment and treats duplicate finalization as idempotent", async () => {
    hotelbedsPaths = [];
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify(checkoutBody(`hotel-payment-${Date.now()}`)) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    const paymentBody = { orderId: checkout.body.orderId, paymentId: "pay-test-confirmed", signature: "sig_test_valid" };
    const first = await api(`/api/hotelbeds/bookings/${String((checkout.body.booking as Record<string, unknown>).id)}/payment`, { method: "POST", body: JSON.stringify(paymentBody) });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.status, "SUPPLIER_CONFIRMED");
    const second = await api(`/api/hotelbeds/bookings/${String((checkout.body.booking as Record<string, unknown>).id)}/payment`, { method: "POST", body: JSON.stringify(paymentBody) });
    assert.equal(second.response.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(hotelbedsPaths.filter((path) => path.endsWith("/bookings")).length, 1);
  });

  it("moves clear supplier failure through refund and blocks retry", async () => {
    hotelbedsPaths = [];
    bookingResponses = [{ error: "supplier unavailable" }];
    bookingResponses = [{ httpStatus: 503, body: { error: "supplier unavailable" } }];
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify(checkoutBody(`hotel-payment-${Date.now()}`)) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    const failed = await api(`/api/hotelbeds/bookings/${String((checkout.body.booking as Record<string, unknown>).id)}/payment`, { method: "POST", body: JSON.stringify({ orderId: checkout.body.orderId, paymentId: "pay-test-failure", signature: "sig_test_valid" }) });
    assert.equal(failed.response.status, 502);
    assert.equal(failed.body.status, "REFUND_PROCESSED");
    const retry = await api(`/api/hotelbeds/bookings/${String((checkout.body.booking as Record<string, unknown>).id)}/payment`, { method: "POST", body: JSON.stringify({ orderId: checkout.body.orderId, paymentId: "pay-test-failure", signature: "sig_test_valid" }) });
    assert.equal(retry.response.status, 409);
  });

  it("does not confirm an ambiguous supplier response", async () => {
    bookingResponses = [{ booking: { reference: "HB-AMBIGUOUS" } }];
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify(checkoutBody(`hotel-payment-${Date.now()}`)) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    const result = await api(`/api/hotelbeds/bookings/${String((checkout.body.booking as Record<string, unknown>).id)}/payment`, { method: "POST", body: JSON.stringify({ orderId: checkout.body.orderId, paymentId: "pay-test-ambiguous", signature: "sig_test_valid" }) });
    assert.equal(result.response.status, 202);
    assert.equal(result.body.status, "RECONCILIATION_REQUIRED");
  });

  it("marks a browser-disconnected captured hotel payment for reconciliation and deduplicates webhook events", async () => {
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify(checkoutBody(`hotel-payment-${Date.now()}`)) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    const webhook = { id: `evt_hotel_${Date.now()}`, event: "payment.captured", payload: { payment: { entity: { id: "pay-test-webhook", order_id: checkout.body.orderId, amount: 12300 } } } };
    const first = await api("/api/payments/webhook", { method: "POST", body: JSON.stringify(webhook) });
    assert.equal(first.response.status, 200);
    const bookingId = String((checkout.body.booking as Record<string, unknown>).id);
    const booking = await api(`/api/bookings/${bookingId}`);
    assert.equal(booking.body.booking.status, "RECONCILIATION_REQUIRED");
    assert.equal(booking.body.booking.paymentStatus, "PAYMENT_CAPTURED");
    const duplicate = await api("/api/payments/webhook", { method: "POST", body: JSON.stringify(webhook) });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.body.duplicate, true);
  });
});
