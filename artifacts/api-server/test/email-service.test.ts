import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";
import { EmailService } from "../src/services/email-service";
import type { Booking } from "@workspace/db";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-email-test";
process.env.CLIENT_BOOKING_EMAIL ??= "operations@wayora.travel";
process.env.EMAIL_PROVIDER ??= "test";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, bookingsTable, usersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const userAEmail = `email-user-a-${crypto.randomUUID()}@example.com`;
const userBEmail = `email-user-b-${crypto.randomUUID()}@example.com`;
let userIds: string[] = [];
let cookieA = "";
let cookieB = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  const resA = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userAEmail, password: "password123456" }),
  });
  cookieA = resA.headers.get("set-cookie")?.split(";")[0] ?? "";
  const bodyA = (await resA.json()) as { user: { id: string } };
  userIds.push(bodyA.user.id);

  const resB = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userBEmail, password: "password123456" }),
  });
  cookieB = resB.headers.get("set-cookie")?.split(";")[0] ?? "";
  const bodyB = (await resB.json()) as { user: { id: string } };
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
    ...((init.headers as Record<string, string>) || {}),
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

describe("Email Service Unit Tests", () => {
  const mockBooking: Booking = {
    id: "00000000-0000-0000-0000-000000000001",
    ownerId: "00000000-0000-0000-0000-000000000002",
    kind: "FLIGHT",
    status: "CONFIRMED",
    providerMode: "LIVE",
    providerReference: "DUFFEL_REF_12345",
    bookingReference: "WAY-XY9876",
    pnr: "XY9876",
    ticketNumber: "098-2345678901",
    flightOfferId: "off_123456",
    amount: 14500,
    fareSnapshot: {
      baseFare: 12000,
      taxes: 2500,
      baggage: "15 kg standard",
      cabinClass: "Economy",
    },
    passengers: [
      {
        title: "Mr",
        firstName: "Aarav",
        lastName: "Sharma",
        type: "ADULT",
        dateOfBirth: "1990-05-15",
        gender: "MALE",
        passportNumber: "Z1234567",
        passportExpiry: "2030-01-01",
      },
    ],
    contact: {
      email: "aarav.sharma@example.com",
      phone: "9876543210",
      countryCode: "+91",
    },
    segments: [
      {
        carrier: "IndiGo",
        flightNumber: "6E-501",
        origin: "DEL",
        destination: "BOM",
        departureTime: "06:10",
        arrivalTime: "08:35",
        duration: "2h 25m",
        cabin: "Economy",
      },
    ],
    addons: {
      extraBaggageKg: 5,
      extraBaggagePrice: 1500,
      seatCode: "12A",
      seatSelectionPrice: 400,
      mealSelection: "Vegetarian Hot Meal",
    },
    paymentId: "pay_rzp_live_998877",
    paymentOrderId: "order_rzp_live_112233",
    paymentStatus: "CAPTURED",
    idempotencyKey: "idem_test_email_001",
    cancellationDetails: null,
    refundAmount: null,
    emailStatus: "NOT_SENT",
    emailSentAt: null,
    emailError: null,
    clientEmail: null,
    payload: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renders plain text email with all required passenger, flight, payment and booking details", () => {
    const service = new EmailService({ isTestMode: true });
    const text = service.generatePlainTextEmail(mockBooking);

    assert.match(text, /ZELEVOS FLIGHT BOOKING CONFIRMATION/);
    assert.match(text, /PNR \/ Booking Reference: XY9876/);
    assert.match(text, /E-Ticket Number: 098-2345678901/);
    assert.match(text, /Provider Reference: DUFFEL_REF_12345/);
    assert.match(text, /Aarav Sharma/);
    assert.match(text, /Z1234567/);
    assert.match(text, /aarav\.sharma@example\.com/);
    assert.match(text, /IndiGo 6E-501/);
    assert.match(text, /DEL -> To: BOM/);
    assert.match(text, /Total Amount Paid: ₹14,500/);
    assert.match(text, /pay_rzp_live_998877/);
    assert.doesNotMatch(text, /RAZORPAY_KEY_SECRET/i);
  });

  it("renders HTML email with all structured cards and security sanitization", () => {
    const service = new EmailService({ isTestMode: true });
    const html = service.generateHtmlEmail(mockBooking);

    assert.match(html, /ZELEVOS TRAVEL/);
    assert.match(html, /XY9876/);
    assert.match(html, /098-2345678901/);
    assert.match(html, /IndiGo 6E-501/);
    assert.match(html, /Aarav/);
    assert.match(html, /Sharma/);
    assert.match(html, /14,500/);
    assert.match(html, /Cancellation & Refund Rules/);
    assert.doesNotMatch(html, /secret/i);
  });

  it("reports unavailable email delivery when no provider credentials exist", async () => {
    const service = new EmailService({ isTestMode: true, clientBookingEmail: "admin@wayora.travel" });
    const res = await service.sendBookingConfirmation(mockBooking);

    assert.equal(res.success, false);
    assert.equal(res.status, "UNAVAILABLE");
    assert.equal(res.recipient, "admin@wayora.travel");
    assert.equal(res.cc, "aarav.sharma@example.com");
    assert.match(res.error || "", /provider not configured/i);
  });
});

describe("End-to-End Flight Booking with Email Dispatch & Retry", () => {
  let createdBookingId = "";

  it("completes payment and booking flow and dispatches confirmation email", async () => {
    // 1. Search flight
    const searchRes = await api("/api/flights/search?from=DEL&to=BOM&departure=2026-10-15&travellers=1");
    assert.equal(searchRes.status, 200);
    const searchData = (await searchRes.json()) as { results: Array<{ id: string; price: number }> };
    assert.ok(searchData.results.length > 0);
    const offer = searchData.results[0];

    // 2. Create Payment Order
    const orderRes = await api(
      "/api/payments/order",
      {
        method: "POST",
        body: JSON.stringify({ amount: offer.price, currency: "INR" }),
      },
      cookieA,
    );
    assert.equal(orderRes.status, 201);
    const orderData = (await orderRes.json()) as { orderId: string; amount: number; provider: string };

    // 3. Confirm Flight Booking
    const bookRes = await api(
      "/api/flights/book",
      {
        method: "POST",
        body: JSON.stringify({
          offerId: offer.id,
          passengers: [
            {
              title: "Ms",
              firstName: "Priya",
              lastName: "Patel",
              type: "ADULT",
              dateOfBirth: "1994-08-20",
              gender: "FEMALE",
            },
          ],
          contact: {
            email: "priya.patel@example.com",
            phone: "9123456780",
            countryCode: "+91",
          },
          payment: {
            orderId: orderData.orderId,
            paymentId: `pay_test_${crypto.randomUUID().slice(0, 8)}`,
            signature: "simulated_signature",
          },
          idempotencyKey: `idem_email_flow_${crypto.randomUUID()}`,
        }),
      },
      cookieA,
    );

    assert.equal(bookRes.status, 201);
    const bookData = (await bookRes.json()) as {
      success: boolean;
      pnr: string;
      ticketNumber: string;
      emailStatus: string;
      booking: { id: string; emailStatus: string; clientEmail: string };
    };

    assert.equal(bookData.success, true);
    assert.ok(bookData.pnr);
    assert.ok(bookData.ticketNumber);
    assert.equal(bookData.emailStatus, "UNAVAILABLE");
    assert.ok(bookData.booking.clientEmail);
    createdBookingId = bookData.booking.id;
  });

  it("allows retrying booking confirmation email via POST /api/bookings/:id/email", async () => {
    assert.ok(createdBookingId);

    const retryRes = await api(`/api/bookings/${createdBookingId}/email`, { method: "POST" }, cookieA);
    assert.equal(retryRes.status, 502);
    const retryData = (await retryRes.json()) as {
      success: boolean;
      status: string;
      recipient: string;
      message: string;
    };

    assert.equal(retryData.success, false);
    assert.equal(retryData.status, "email_delivery_failed");
    assert.ok(retryData.recipient);
  });

  it("protects booking ownership and prevents another user from retrying email", async () => {
    assert.ok(createdBookingId);

    // User B attempts to retry email for User A's booking
    const unauthorizedRes = await api(`/api/bookings/${createdBookingId}/email`, { method: "POST" }, cookieB);
    assert.equal(unauthorizedRes.status, 404);
  });
});
