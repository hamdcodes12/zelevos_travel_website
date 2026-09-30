import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth";

process.env.SESSION_SECRET ??= "test-session-secret-custom-trip";
process.env.CLIENT_BOOKING_EMAIL ??= "operations@zelevos.travel";
process.env.EMAIL_PROVIDER ??= "test";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const {
  db,
  usersTable,
  adminUsersTable,
  bookingsTable,
  customTripRequestsTable,
  notificationsTable,
  paymentsTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

let customerACookie = "";
let customerAId = "";
let customerACustomerId = "";
let customerAEmail = "";

let customerBCookie = "";
let customerBId = "";
let customerBEmail = "";

let adminCookie = "";
let adminEmail = "";

let leadId = "";
let leadNumber = "";
let bookingDbId = "";
let masterBookingId = "";
let razorpayOrderId = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;

  // Create Customer A
  customerAEmail = `customer_a_${Date.now()}@example.com`;
  const [createdUserA] = await db
    .insert(usersTable)
    .values({
      email: customerAEmail,
      fullName: "Aarav Sharma",
      phone: "+91 9876543210",
      passwordHash: await hashPassword("CustomerSecret123!"),
      customerId: `ZLV-CUS-${Date.now().toString().slice(-6)}`,
      emailVerified: true,
      status: "ACTIVE",
    })
    .returning();
  customerAId = createdUserA.id;
  customerACustomerId = createdUserA.customerId!;

  const loginResA = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: customerAEmail, password: "CustomerSecret123!" }),
  });
  assert.equal(loginResA.status, 200, "Customer A login must succeed");
  customerACookie = loginResA.headers.get("set-cookie")?.split(";")[0] || "";

  // Create Customer B (for IDOR attack tests)
  customerBEmail = `customer_b_${Date.now()}@example.com`;
  const [createdUserB] = await db
    .insert(usersTable)
    .values({
      email: customerBEmail,
      fullName: "Bhavna Patel",
      phone: "+91 9811223344",
      passwordHash: await hashPassword("CustomerBSecret123!"),
      customerId: `ZLV-CUS-${(Date.now() + 1).toString().slice(-6)}`,
      emailVerified: true,
      status: "ACTIVE",
    })
    .returning();
  customerBId = createdUserB.id;

  const loginResB = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: customerBEmail, password: "CustomerBSecret123!" }),
  });
  assert.equal(loginResB.status, 200, "Customer B login must succeed");
  customerBCookie = loginResB.headers.get("set-cookie")?.split(";")[0] || "";

  // Create Admin
  const adminId = `ADM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const adminPass = "AdminSecret123!";
  const [createdAdmin] = await db
    .insert(adminUsersTable)
    .values({
      adminId,
      passwordHash: hashPassword(adminPass),
      role: "admin",
    })
    .returning();

  const adminLoginRes = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId, password: adminPass }),
  });
  assert.equal(adminLoginRes.status, 200, "Admin login must succeed");
  adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";
});

after(async () => {
  if (leadId) {
    await db.delete(customTripRequestsTable).where(eq(customTripRequestsTable.id, leadId));
  }
  if (bookingDbId) {
    await db.delete(bookingsTable).where(eq(bookingsTable.id, bookingDbId));
  }
  if (customerAId) {
    await db.delete(usersTable).where(eq(usersTable.id, customerAId));
  }
  if (customerBId) {
    await db.delete(usersTable).where(eq(usersTable.id, customerBId));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Zelevos Custom Trip End-to-End Workflow & Security Tests", () => {
  const fullSpecialRequestText =
    "Airport pickup chahiye, vegetarian food, Gulmarg snow activity, houseboat in Dal Lake on first night, child stroller support.";

  it("1. Customer submits Build My Trip request — all fields persist and customerId is derived securely", async () => {
    const res = await fetch(`${baseUrl}/custom-trips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerACookie,
      },
      body: JSON.stringify({
        customerName: "Aarav Sharma",
        customerEmail: customerAEmail,
        customerPhone: "+91 9876543210",
        destinations: ["Kashmir", "Gulmarg", "Pahalgam"],
        startDate: "2026-10-15",
        durationDays: 6,
        travellersCount: 2,
        budgetPerPerson: 45000,
        hotelPreference: "4 Star / Boutique",
        transportPreference: "Private Cab",
        activitiesInterests: ["Snow", "Houseboat", "Local Dining"],
        specialRequests: fullSpecialRequestText,
      }),
    });

    assert.equal(res.status, 201, "Custom trip submission must return 201 Created");
    const data = await res.json();
    assert.equal(data.status, "success");
    assert.ok(data.request.id, "Lead must have an ID");
    assert.ok(data.request.leadNumber, "Lead must have a leadNumber");

    leadId = data.request.id;
    leadNumber = data.request.leadNumber;

    // Verify database row directly
    const [dbRow] = await db
      .select()
      .from(customTripRequestsTable)
      .where(eq(customTripRequestsTable.id, leadId))
      .limit(1);

    assert.ok(dbRow, "Database row must exist");
    assert.equal(dbRow.customerId, customerACustomerId, "customerId must be securely derived from authenticated user");
    assert.equal(dbRow.specialRequests, fullSpecialRequestText, "Special requests must not be truncated");
    assert.equal(dbRow.budgetPerPerson, 45000);
    assert.equal(dbRow.travellersCount, 2);
    assert.equal(dbRow.durationDays, 6);
    assert.equal(dbRow.hotelPreference, "4 Star / Boutique");
    assert.equal(dbRow.transportPreference, "Private Cab");
  });

  it("2. Admin accesses Custom Trip Leads and sees the complete A-Z request without truncation", async () => {
    const res = await fetch(`${baseUrl}/admin/custom-trips`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.leads), "Leads must be returned as an array");

    const found = data.leads.find((l: any) => l.id === leadId);
    assert.ok(found, "Created lead must be visible to admin");
    assert.equal(found.specialRequests, fullSpecialRequestText, "Admin must see full untruncated special requests");
    assert.equal(found.customerId, customerACustomerId, "Admin must see Customer ID");
    assert.equal(found.customerEmail, customerAEmail);
  });

  it("3. Admin creates and sends proposal with day-wise itinerary, pricing, and Admin Note", async () => {
    const proposalPayload = {
      proposalTitle: "6D5N Kashmir Bespoke Experience",
      proposalAmount: 90000,
      notes: "We have prepared this itinerary according to your requested stay, transport preference and budget.",
      proposalItinerary: [
        { day: 1, date: "2026-10-15", location: "Srinagar", activity: "Arrival & Dal Lake Houseboat", meal: "Dinner", description: "Private cab pickup from airport to luxury houseboat." },
        { day: 2, date: "2026-10-16", location: "Gulmarg", activity: "Gondola ride and snow activities", meal: "Breakfast & Dinner", description: "Full day snow adventure with guide." },
        { day: 3, date: "2026-10-17", location: "Pahalgam", activity: "Betaab Valley & Aru Valley", meal: "Breakfast", description: "Scenic sightseeing with private chauffeur." },
        { day: 4, date: "2026-10-18", location: "Pahalgam", activity: "Baisaran meadow trek", meal: "Breakfast", description: "Horse riding and local pine forest exploration." },
        { day: 5, date: "2026-10-19", location: "Srinagar", activity: "Mughal Gardens & Shikara Ride", meal: "Breakfast & Dinner", description: "Nishat & Shalimar bagh followed by sunset cruise." },
        { day: 6, date: "2026-10-20", location: "Srinagar", activity: "Departure Transfer", meal: "Breakfast", description: "Airport transfer with sweet memories." },
      ],
    };

    const res = await fetch(`${baseUrl}/admin/custom-trips/${leadId}/proposal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify(proposalPayload),
    });

    assert.equal(res.status, 200, "Sending proposal must succeed");
    const data = await res.json();
    assert.equal(data.status, "success");
    assert.equal(data.lead.status, "PROPOSAL_SENT");
    assert.equal(data.lead.proposalAmount, 90000);
    assert.equal(data.lead.proposalNotes, proposalPayload.notes);
    assert.equal(data.lead.proposalItinerary.length, 6);
  });

  it("4. Customer receives in-app notification for Proposal Sent", async () => {
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: customerACookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.notifications));

    const notif = data.notifications.find((n: any) =>
      n.title?.toLowerCase().includes("proposal") || n.body?.toLowerCase().includes("itinerary") || n.category === "CUSTOM_TRIP"
    );
    assert.ok(notif, "Notification about proposal must be present in customer's inbox");
  });

  it("5. Customer A views proposal with complete details and Admin Note", async () => {
    const res = await fetch(`${baseUrl}/custom-trips/${leadId}`, {
      headers: { Cookie: customerACookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "success");
    assert.equal(data.request.proposalAmount, 90000);
    assert.ok(data.request.proposalNotes.includes("according to your requested stay"));
    assert.equal(data.request.proposalItinerary.length, 6);
  });

  it("6. IDOR Protection: Customer B CANNOT view or accept Customer A's proposal", async () => {
    // Attempt to view
    const viewRes = await fetch(`${baseUrl}/custom-trips/${leadId}`, {
      headers: { Cookie: customerBCookie },
    });
    assert.equal(viewRes.status, 404, "Customer B must receive 404/Not Found for Customer A's proposal");

    // Attempt to accept
    const acceptRes = await fetch(`${baseUrl}/custom-trips/${leadId}/accept`, {
      method: "POST",
      headers: { Cookie: customerBCookie },
    });
    assert.equal(acceptRes.status, 404, "Customer B cannot accept Customer A's proposal");
  });

  it("7. Customer A accepts proposal — creates real booking without raw database error (BUG FIX VERIFIED)", async () => {
    const res = await fetch(`${baseUrl}/custom-trips/${leadId}/accept`, {
      method: "POST",
      headers: { Cookie: customerACookie },
    });

    assert.equal(res.status, 200, "Accept proposal must return 200 OK (no Postgres NOT NULL constraint error)");
    const data = await res.json();
    assert.equal(data.status, "success");
    assert.ok(data.booking, "Booking record must be returned");
    assert.ok(data.booking.bookingId, "Booking reference must exist");
    assert.equal(data.booking.totalPrice, 90000, "Booking total price must match proposal amount");
    assert.equal(data.booking.paymentStatus, "PENDING");

    bookingDbId = data.booking.id;
    masterBookingId = data.booking.bookingId;

    // Verify in database
    const [bookingRow] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingDbId))
      .limit(1);

    assert.ok(bookingRow, "Booking row must exist in Postgres");
    assert.equal(bookingRow.totalPrice, 90000);
    assert.equal(bookingRow.customerId, customerAId);
  });

  it("8. Idempotency: Double-click / repeat acceptance returns existing booking without duplicating", async () => {
    const res = await fetch(`${baseUrl}/custom-trips/${leadId}/accept`, {
      method: "POST",
      headers: { Cookie: customerACookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.booking.id, bookingDbId, "Must return original booking ID");
    assert.equal(data.booking.bookingId, masterBookingId, "Must return original booking reference");
  });

  it("9. Razorpay Order Creation — server prices the order authoritative from booking, rejecting client tampering", async () => {
    // Attempt tampering: passing amount: 1 should NOT change the server's price
    const res = await fetch(`${baseUrl}/payments/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerACookie,
      },
      body: JSON.stringify({
        bookingId: bookingDbId,
        amount: 1, // Malicious attempt to change price to 1 INR
        idempotencyKey: `custom-trip-${leadId}-${bookingDbId}`,
      }),
    });

    assert.equal(res.status, 201, "Order creation must succeed");
    const data = await res.json();
    assert.ok(data.orderId, "Razorpay orderId must be returned");
    razorpayOrderId = data.orderId;
    assert.equal(data.amountSubunits, 9000000, "Order amount must be 90000 INR (9000000 paise) ignoring client amount: 1");
    assert.equal(data.currency, "INR");
  });

  it("10. Payment Verification: Tampered / fake signature is rejected by Razorpay provider", async () => {
    const { RazorpayPaymentProvider } = await import("../src/services/payment-service");
    const rzp = new RazorpayPaymentProvider("rzp_live_test_key123", "rzp_test_secret");
    const tampered = await rzp.verifyPayment({
      orderId: razorpayOrderId || "order_test_12345",
      paymentId: "pay_test_12345",
      signature: "invalid_tampered_signature_hex",
    });
    assert.equal(tampered.verified, false, "Tampered signature must fail verification");
  });

  it("11. Payment Verification: Real test payment verification marks booking and custom trip as PAID", async () => {
    const paymentId = `pay_test_${Date.now()}`;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "test_secret_zelevos_safe_key_123";

    // Generate valid HMAC SHA256 signature
    const signature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${paymentId}`)
      .digest("hex");

    const res = await fetch(`${baseUrl}/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerACookie,
      },
      body: JSON.stringify({ orderId: razorpayOrderId, paymentId, signature }),
    });

    assert.equal(res.status, 200, "Valid signature verification must succeed");
    const data = await res.json();
    assert.equal(data.verified, true);

    // Verify booking is marked PAID
    const [bookingAfter] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingDbId))
      .limit(1);

    assert.equal(bookingAfter.paymentStatus, "SUCCESSFUL");

    // Verify custom trip request is marked PAID
    const [leadAfter] = await db
      .select()
      .from(customTripRequestsTable)
      .where(eq(customTripRequestsTable.id, leadId))
      .limit(1);

    assert.equal(leadAfter.status, "PAID");
  });

  it("12. Automatic Payment Receipt generation — customer can download own receipt with real details", async () => {
    const res = await fetch(`${baseUrl}/bookings/${masterBookingId}/receipt?format=json`, {
      headers: { Cookie: customerACookie },
    });

    assert.equal(res.status, 200, "Receipt retrieval must return 200 OK");
    const data = await res.json();
    assert.equal(data.status, "success");
    assert.ok(data.receipt.receiptNumber, "Receipt number must exist");
    assert.equal(data.receipt.customerId, customerACustomerId);
    assert.equal(data.receipt.customerEmail, customerAEmail);
    assert.equal(data.receipt.totalPaid, 90000);
    assert.equal(data.receipt.paymentStatus, "PAID");
    assert.equal(data.receipt.paymentMethod, "Razorpay");

    // HTML / Download file test
    const dlRes = await fetch(`${baseUrl}/bookings/${masterBookingId}/receipt/download?download=true`, {
      headers: { Cookie: customerACookie },
    });
    assert.equal(dlRes.status, 200);
    assert.ok(dlRes.headers.get("content-disposition")?.includes("attachment"));
    const html = await dlRes.text();
    assert.ok(html.includes("ZELEVOS"), "Receipt HTML must contain brand name");
    assert.ok(html.includes("Payment Receipt &amp; Invoice") || html.includes("Payment Receipt & Invoice"));
    assert.ok(html.includes(customerACustomerId), "Receipt must contain Customer ID");
    assert.ok(html.includes("90,000"), "Receipt must contain the formatted paid amount");
  });

  it("13. Receipt Security & IDOR: Customer B CANNOT download Customer A's receipt", async () => {
    const res = await fetch(`${baseUrl}/bookings/${masterBookingId}/receipt`, {
      headers: { Cookie: customerBCookie },
    });

    assert.ok(
      res.status === 403 || res.status === 404,
      `Customer B must receive 403 or 404 when requesting Customer A's receipt (got ${res.status})`
    );
  });

  it("14. Admin Custom Trips view reflects PAID status, booking reference, and receipt availability", async () => {
    const res = await fetch(`${baseUrl}/admin/custom-trips`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const lead = data.leads.find((l: any) => l.id === leadId);
    assert.ok(lead);
    assert.equal(lead.status, "PAID");
    assert.equal(lead.paymentStatus, "SUCCESSFUL");
    assert.equal(lead.masterBookingId, masterBookingId);
  });
});
