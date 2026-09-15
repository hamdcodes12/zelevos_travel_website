import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-flight-test";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, bookingsTable, usersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const userAEmail = `flight-user-a-${crypto.randomUUID()}@example.com`;
const userBEmail = `flight-user-b-${crypto.randomUUID()}@example.com`;
let userIds: string[] = [];
let cookieA = "";
let cookieB = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Register User A
  const resA = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userAEmail, password: "password123456" }),
  });
  cookieA = resA.headers.get("set-cookie")?.split(";")[0] ?? "";
  const bodyA = await resA.json() as { user: { id: string } };
  userIds.push(bodyA.user.id);

  // Register User B
  const resB = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userBEmail, password: "password123456" }),
  });
  cookieB = resB.headers.get("set-cookie")?.split(";")[0] ?? "";
  const bodyB = await resB.json() as { user: { id: string } };
  userIds.push(bodyB.user.id);
});

after(async () => {
  if (userIds.length) {
    await db.delete(bookingsTable).where(inArray(bookingsTable.ownerId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  server.close();
});

async function api(path: string, init: RequestInit = {}, cookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

describe("Flight Booking Architecture & Flows", () => {
  let selectedOfferId = "";
  let offerPrice = 0;

  it("1. Returns flight provider status", async () => {
    const { response, body } = await api("/api/providers/status");
    assert.equal(response.status, 200);
    assert.ok(body.status.flights);
    assert.ok(body.mode.flights);
  });

  it("2. Searches real flights for a route (DEL to BOM)", async () => {
    const { response, body } = await api("/api/flights/search?from=DEL&to=BOM&departure=2026-11-15&travellers=1&cabin=Economy");
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.results));
    assert.ok(body.results.length > 0, "Should return available flight offers");

    const first = body.results[0];
    assert.ok(first.id, "Flight offer should have an ID");
    assert.ok(first.airline);
    assert.ok(first.price > 0);
    assert.ok(Array.isArray(first.segments));
    assert.equal(first.currency, "INR");

    selectedOfferId = first.id;
    offerPrice = first.price;
  });

  it("3. Revalidates flight price, fare rules, and seat availability", async () => {
    const { response, body } = await api("/api/flights/revalidate", {
      method: "POST",
      body: JSON.stringify({ offerId: selectedOfferId, expectedPrice: offerPrice }),
    });

    assert.equal(response.status, 200);
    assert.equal(body.valid, true);
    assert.equal(body.soldOut, false);
    assert.equal(body.offerId, selectedOfferId);
    assert.ok(body.flight);
  });

  it("4. Creates payment order with keyId and amount in paise", async () => {
    const { response, body } = await api("/api/payments/order", {
      method: "POST",
      body: JSON.stringify({ amount: offerPrice, currency: "INR" }),
    }, cookieA);

    assert.equal(response.status, 201);
    assert.ok(body.orderId.startsWith("order_"));
    assert.equal(body.amount, offerPrice);
    assert.equal(body.amountSubunits, offerPrice * 100);
    assert.equal(body.currency, "INR");
  });

  it("5. Verifies valid payment signature and rejects invalid signatures", async () => {
    // Valid payment test
    const validRes = await api("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order_test_12345",
        paymentId: "pay_test_998877",
        signature: "sig_test_valid",
      }),
    }, cookieA);
    assert.equal(validRes.response.status, 200);
    assert.equal(validRes.body.verified, true);

    // Invalid signature
    const invalidRes = await api("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order_test_12345",
        paymentId: "pay_test_998877",
        signature: "sig_test_invalid",
      }),
    }, cookieA);
    assert.equal(invalidRes.response.status, 400);
    assert.equal(invalidRes.body.verified, false);
  });

  it("6. Rejects booking when passenger validation fails (e.g. no adult, child age out of bounds)", async () => {
    // Attempt with child claiming to be adult
    const invalidAgeRes = await api("/api/flights/book", {
      method: "POST",
      body: JSON.stringify({
        offerId: selectedOfferId,
        passengers: [
          {
            type: "ADULT",
            title: "Mr",
            firstName: "Young",
            lastName: "Traveler",
            dateOfBirth: "2022-05-10", // 4 years old, cannot be Adult
            gender: "MALE",
            nationality: "IN",
          },
        ],
        contact: { email: "passenger@example.com", phone: "+919876543210" },
        payment: { orderId: "order_test_1", paymentId: "pay_test_1", signature: "sig_test_valid" },
        idempotencyKey: crypto.randomUUID(),
      }),
    }, cookieA);

    assert.equal(invalidAgeRes.response.status, 400);
    assert.ok(invalidAgeRes.body.message.includes("Adults must be 12+"));

    // Attempt with infants exceeding adults
    const infantOverloadRes = await api("/api/flights/book", {
      method: "POST",
      body: JSON.stringify({
        offerId: selectedOfferId,
        passengers: [
          {
            type: "ADULT",
            title: "Mr",
            firstName: "Raj",
            lastName: "Sharma",
            dateOfBirth: "1990-01-01",
            gender: "MALE",
            nationality: "IN",
          },
          {
            type: "INFANT",
            title: "Master",
            firstName: "Baby1",
            lastName: "Sharma",
            dateOfBirth: "2025-06-01",
            gender: "MALE",
            nationality: "IN",
          },
          {
            type: "INFANT",
            title: "Miss",
            firstName: "Baby2",
            lastName: "Sharma",
            dateOfBirth: "2025-07-01",
            gender: "FEMALE",
            nationality: "IN",
          },
        ],
        contact: { email: "passenger@example.com", phone: "+919876543210" },
        payment: { orderId: "order_test_1", paymentId: "pay_test_1", signature: "sig_test_valid" },
        idempotencyKey: crypto.randomUUID(),
      }),
    }, cookieA);

    assert.equal(infantOverloadRes.response.status, 400);
    assert.ok(infantOverloadRes.body.message.includes("Infants cannot exceed"));
  });

  let confirmedBookingId = "";
  let confirmedPnr = "";
  const bookingIdempotencyKey = `idem-${crypto.randomUUID()}`;

  it("7. Successfully confirms flight booking, issues PNR, e-ticket and captures payment", async () => {
    const bookingRes = await api("/api/flights/book", {
      method: "POST",
      body: JSON.stringify({
        offerId: selectedOfferId,
        passengers: [
          {
            type: "ADULT",
            title: "Mr",
            firstName: "Rohan",
            lastName: "Kapoor",
            dateOfBirth: "1988-08-15",
            gender: "MALE",
            nationality: "IN",
          },
        ],
        contact: { email: "rohan.kapoor@example.com", phone: "9876543210" },
        addons: {
          extraBaggageKg: 5,
          extraBaggagePrice: 1200,
          seatPreference: "Window",
        },
        payment: {
          orderId: "order_test_book_1",
          paymentId: "pay_test_book_1",
          signature: "sig_test_valid",
        },
        idempotencyKey: bookingIdempotencyKey,
      }),
    }, cookieA);

    assert.equal(bookingRes.response.status, 201);
    assert.equal(bookingRes.body.success, true);
    assert.ok(bookingRes.body.pnr, "PNR must be generated");
    assert.ok(bookingRes.body.ticketNumber, "Ticket number must be issued");
    assert.equal(bookingRes.body.booking.status, "CONFIRMED");
    assert.equal(bookingRes.body.booking.paymentStatus, "CAPTURED");
    assert.ok(Array.isArray(bookingRes.body.segments));

    confirmedBookingId = bookingRes.body.booking.id;
    confirmedPnr = bookingRes.body.pnr;
  });

  it("8. Enforces idempotency when booking request is repeated with same key", async () => {
    const retryRes = await api("/api/flights/book", {
      method: "POST",
      body: JSON.stringify({
        offerId: selectedOfferId,
        passengers: [
          {
            type: "ADULT",
            title: "Mr",
            firstName: "Rohan",
            lastName: "Kapoor",
            dateOfBirth: "1988-08-15",
            gender: "MALE",
            nationality: "IN",
          },
        ],
        contact: { email: "rohan.kapoor@example.com", phone: "9876543210" },
        payment: {
          orderId: "order_test_book_1",
          paymentId: "pay_test_book_1",
          signature: "sig_test_valid",
        },
        idempotencyKey: bookingIdempotencyKey,
      }),
    }, cookieA);

    assert.equal(retryRes.response.status, 200);
    assert.equal(retryRes.body.booking.id, confirmedBookingId);
    assert.equal(retryRes.body.pnr, confirmedPnr);
    assert.ok(retryRes.body.message.includes("idempotent"));
  });

  it("9. Confirmed booking appears in user's bookings history with live details", async () => {
    const listRes = await api("/api/bookings", {}, cookieA);
    assert.equal(listRes.response.status, 200);
    assert.ok(Array.isArray(listRes.body.results));

    const found = listRes.body.results.find((b: any) => b.id === confirmedBookingId);
    assert.ok(found, "User's confirmed booking should be in list");
    assert.equal(found.pnr, confirmedPnr);
    assert.equal(found.status, "CONFIRMED");
    assert.equal(found.kind, "FLIGHT");
    assert.ok(found.ticketNumber);
  });

  it("10. User B cannot access or cancel User A's booking", async () => {
    // User B tries to view User A's booking
    const viewRes = await api(`/api/bookings/${confirmedBookingId}`, {}, cookieB);
    assert.equal(viewRes.response.status, 404);

    // User B tries to cancel User A's booking
    const cancelRes = await api(`/api/bookings/${confirmedBookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Malicious cancellation attempt" }),
    }, cookieB);
    assert.equal(cancelRes.response.status, 404);
  });

  it("11. Cancels flight booking, calculates refund, and updates status", async () => {
    const cancelRes = await api(`/api/bookings/${confirmedBookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Change of plans" }),
    }, cookieA);

    assert.equal(cancelRes.response.status, 200);
    assert.equal(cancelRes.body.success, true);
    assert.equal(cancelRes.body.booking.status, "CANCELLED");
    assert.ok(cancelRes.body.cancellation.cancellationReference);
    assert.ok(typeof cancelRes.body.cancellation.refundAmount === "number");
    assert.ok(cancelRes.body.cancellation.refundAmount >= 0);

    // Attempting to cancel again should fail
    const repeatCancelRes = await api(`/api/bookings/${confirmedBookingId}/cancel`, {
      method: "POST",
    }, cookieA);
    assert.equal(repeatCancelRes.response.status, 400);
    assert.equal(repeatCancelRes.body.status, "already_cancelled");
  });
});
