import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "hotelbeds-concurrency-session";
process.env.PAYMENT_PROVIDER = "test";
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
let supplierBookingCalls = 0;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function api(path: string, init: RequestInit = {}) {
  const result = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(init.headers || {}) } });
  return { response: result, body: await result.json() as Record<string, unknown> };
}

describe("Hotelbeds concurrent supplier claim", () => {
  before(async () => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.test.hotelbeds.com")) {
        const path = new URL(url).pathname;
        if (path.endsWith("/checkrates")) return response({ rate: { rateKey: "concurrent-final", rateType: "BOOKABLE", net: "300", currency: "INR" } });
        if (path.endsWith("/bookings")) { supplierBookingCalls += 1; return response({ booking: { reference: "HB-CONCURRENT", status: "CONFIRMED" } }); }
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    const signup = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: `concurrency-${Date.now()}@example.com`, password: "password123456" }) });
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

  it("allows only one supplier booking attempt for concurrent finalization", async () => {
    const checkout = await api("/api/hotelbeds/checkout", { method: "POST", body: JSON.stringify({
      rateKey: "concurrent-rate", rateType: "RECHECK", hotelName: "Concurrent Hotel", destination: "London", checkIn: "2030-01-10", checkOut: "2030-01-12", currency: "INR",
      holder: { name: "Lead", surname: "Guest", email: "lead@example.com", phone: "0000000000" },
      rooms: [{ roomId: 1, paxes: [{ roomId: 1, name: "Lead", surname: "Guest", type: "AD" }] }], idempotencyKey: `concurrent-${Date.now()}`,
    }) });
    assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
    const bookingId = String((checkout.body.booking as Record<string, unknown>).id);
    const payment = { orderId: checkout.body.orderId, paymentId: "pay_concurrent", signature: "sig_test_valid" };
    const results = await Promise.all([
      api(`/api/hotelbeds/bookings/${bookingId}/payment`, { method: "POST", body: JSON.stringify(payment) }),
      api(`/api/hotelbeds/bookings/${bookingId}/payment`, { method: "POST", body: JSON.stringify(payment) }),
    ]);
    assert.equal(results.filter((result) => result.response.status === 200).length, 2);
    assert.equal(results.filter((result) => result.body.duplicate === true).length, 1);
    assert.equal(supplierBookingCalls, 1);
  });
});
