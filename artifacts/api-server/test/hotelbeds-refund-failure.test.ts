import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "hotelbeds-refund-failure-session";
process.env.PAYMENT_PROVIDER = "razorpay";
process.env.RAZORPAY_KEY_ID = "rzp_test_refund_failure";
process.env.RAZORPAY_KEY_SECRET = "refund_failure_secret";
process.env.HOTELBEDS_HOTEL_API_KEY = "hotelbeds-test-key";
process.env.HOTELBEDS_HOTEL_SECRET = "hotelbeds-test-secret";
process.env.HOTELBEDS_HOTEL_BASE_URL = "https://api.test.hotelbeds.com";

const { default: app } = await import("../src/app");
const { db, bookingsTable, paymentTransactionsTable, usersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let cookie = "";
let userId = "";
let originalFetch: typeof fetch;
let refundCalls = 0;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function api(path: string, init: RequestInit = {}) {
  const result = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(init.headers || {}) } });
  return { response: result, body: await result.json() as Record<string, unknown> };
}

function requestBody(idempotencyKey: string) {
  return {
    rateKey: "refund-failure-rate", rateType: "RECHECK", hotelName: "Refund Failure Hotel", destination: "London", checkIn: "2030-01-10", checkOut: "2030-01-12", currency: "INR",
    holder: { name: "Lead", surname: "Guest", email: "lead@example.com", phone: "0000000000" },
    rooms: [{ roomId: 1, paxes: [{ roomId: 1, name: "Lead", surname: "Guest", type: "AD" }] }], idempotencyKey,
  };
}

describe("Hotelbeds refund failure reconciliation", () => {
  before(async () => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.test.hotelbeds.com")) {
        const path = new URL(url).pathname;
        if (path.endsWith("/checkrates")) return response({ rate: { rateKey: "refund-failure-final", rateType: "BOOKABLE", net: "250", currency: "INR" } });
        if (path.endsWith("/bookings")) return response({ error: "definitive supplier failure" }, 503);
      }
      if (url.startsWith("https://api.razorpay.com/v1/orders")) return response({ id: "order_refund_failure", amount: 25000, currency: "INR" });
      if (url.includes("https://api.razorpay.com/v1/payments/") && url.endsWith("/refund")) { refundCalls += 1; return response({ error: "refund unavailable" }, 500); }
      return originalFetch(input, init);
    }) as typeof fetch;
    const signup = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: `refund-failure-${Date.now()}@example.com`, password: "password123456" }) });
    assert.equal(signup.response.status, 201);
    userId = String((signup.body.user as Record<string, unknown>).id);
    cookie = signup.response.headers.get("set-cookie")?.split(";")[0] || "";
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (userId) {
      const bookings = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.ownerId, userId));
      if (bookings.length) await db.delete(paymentTransactionsTable).where(inArray(paymentTransactionsTable.bookingId, bookings.map((booking) => booking.id)));
      await db.delete(bookingsTable).where(eq(bookingsTable.ownerId, userId));
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
    server.close();
  });

  it("ends in reconciliation without false confirmation or duplicate refund", async () => {
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify(requestBody(`refund-failure-${Date.now()}`)) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    const orderId = String(checkout.body.orderId);
    const paymentId = "pay_refund_failure";
    const signature = crypto.createHmac("sha256", "refund_failure_secret").update(`${orderId}|${paymentId}`).digest("hex");
    const bookingId = String((checkout.body.booking as Record<string, unknown>).id);
    const finalization = await api(`/api/hotelbeds/bookings/${bookingId}/payment`, { method: "POST", body: JSON.stringify({ orderId, paymentId, signature }) });
    assert.equal(finalization.response.status, 502);
    assert.equal(finalization.body.status, "REFUND_FAILED");
    const booking = await api(`/api/bookings/${bookingId}`);
    assert.equal(booking.body.booking.status, "RECONCILIATION_REQUIRED");
    assert.equal(booking.body.booking.paymentStatus, "REFUND_FAILED");
    assert.equal(refundCalls, 1);
  });
});
