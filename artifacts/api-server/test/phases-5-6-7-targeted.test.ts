import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-phases-5-6-7";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "ZT002121";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const {
  db,
  bookingsTable,
  packagesTable,
  destinationsTable,
  adminUsersTable,
  partnersTable,
  commissionsTable,
  refundsTable,
  supportTicketsTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let adminCookie = "";
let customerCookie = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Ensure admin user exists
  const { hashPassword } = await import("../src/lib/auth.js");
  const [existing] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.adminId, "zelevos-travelai00"))
    .limit(1);

  if (existing) {
    await db
      .update(adminUsersTable)
      .set({
        passwordHash: hashPassword("ZT002121"),
        totpEnabled: false,
      })
      .where(eq(adminUsersTable.id, existing.id));
  } else {
    await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("ZT002121"),
      role: "admin",
    });
  }

  // Admin login
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId: "zelevos-travelai00", password: "ZT002121" }),
  });
  assert.equal(loginRes.status, 200);
  adminCookie = loginRes.headers.get("set-cookie") || "";

  const customerRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Phase Customer",
      email: `phase-customer-${Date.now()}@zelevos.test`,
      password: "PhaseCustomer123!",
      confirmPassword: "PhaseCustomer123!",
    }),
  });
  assert.equal(customerRes.status, 201);
  customerCookie = customerRes.headers.get("set-cookie") || "";
  assert.ok(adminCookie, "Admin cookie acquired");
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("Phases 5, 6, 7 Targeted Features Test Suite", () => {
  let testPackageId: string;
  let testBookingId: string;
  let testPartnerReferralCode: string;
  let testPartnerId: string;
  let testRefundId: string;

  it("0. Pre-requisite: Ensure a test destination and package exist", async () => {
    let [dest] = await db.select().from(destinationsTable).limit(1);
    if (!dest) {
    let testBookingDbId: string;
      [dest] = await db
        .insert(destinationsTable)
        .values({
          name: "Himachal Pradesh",
          slug: `himachal-pradesh-${Date.now()}`,
          country: "India",
          state: "Himachal Pradesh",
          overview: "Picturesque mountain getaways",
          bestTravelPeriod: "April to June",
          heroImage: "/himachal.jpg",
          status: "active",
        })
        .returning();
    }

    const [pkg] = await db
      .insert(packagesTable)
      .values({
        packageId: `PKG-P567-${Date.now()}`,
        title: "Kullu Manali Alpine Delight",
        slug: `kullu-manali-${Date.now()}`,
        destinationId: dest.id,
        locations: ["Manali", "Solang", "Kullu"],
        durationDays: 5,
        durationNights: 4,
        theme: "adventure",
        sellingPrice: 35000,
        baseCost: 26000,
        markupType: "fixed",
        markupValue: "9000",
        serviceFee: 1500,
        status: "active",
      })
      .returning();

    testPackageId = pkg.id;
    assert.ok(testPackageId);
  });

  // ==========================================================================
  // PHASE 5: CUSTOMER EXPERIENCE
  // ==========================================================================
  it("Phase 5.1: Create holiday booking and generate digital printable itinerary", async () => {
    // 1. Create booking
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({
        packageId: testPackageId,
        travelDate: "2026-11-20",
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        roomsCount: 1,
        customerContact: {
          name: "Siddharth Verma",
          email: "siddharth.verma@example.com",
          phone: "+91 98765 11223",
        },
        travellers: [
          { fullName: "Siddharth Verma", age: 32, gender: "MALE", isLead: true },
          { fullName: "Pooja Verma", age: 30, gender: "FEMALE", isLead: false },
        ],
      }),
    });
    assert.equal(bookRes.status, 201);
    const bookData = await bookRes.json();
    testBookingId = bookData.booking.bookingId;
    assert.ok(testBookingId);

    // 2. Pay booking
    const testBookingDbId = bookData.booking.id;
    const orderRes = await fetch(`${baseUrl}/api/payments/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({ bookingId: testBookingDbId, idempotencyKey: `phase5-${testBookingId}` }),
    });
    assert.equal(orderRes.status, 201);
    const orderData = await orderRes.json();

    const verifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({ orderId: orderData.orderId, paymentId: `pay_p5_${Date.now()}`, signature: "sig_test_valid" }),
    });
    assert.equal(verifyRes.status, 200);

    const itinRes = await fetch(`${baseUrl}/api/bookings/${testBookingId}/itinerary`, { headers: { Cookie: customerCookie } });
    assert.equal(itinRes.status, 200);
    const html = await itinRes.text();
    assert.ok(html.includes("ZELEVOS"));
    assert.ok(html.includes(testBookingId));
    assert.ok(html.includes("Cancellation & Refund Policy"));
    assert.ok(html.includes("operations@zelevos.travel"));
  });

  it("Phase 5.2: Customer submits support ticket and operations resolves it", async () => {
    // Submit ticket
    const ticketRes = await fetch(`${baseUrl}/api/support/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({
        name: "Siddharth Verma",
        email: "siddharth.verma@example.com",
        subject: `Room Upgrade Request for ${testBookingId}`,
        description: "Could we request a valley-view room at the Manali resort?",
        priority: "MEDIUM",
        bookingId: testBookingId,
      }),
    });
    assert.equal(ticketRes.status, 201);
    const ticketData = await ticketRes.json();
    assert.ok(ticketData.ticketNumber);
    const ticketId = ticketData.ticket.id;

    // Fetch tickets list
    const listRes = await fetch(`${baseUrl}/api/support/tickets`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    const found = listData.tickets.find((t: any) => t.id === ticketId);
    assert.ok(found);
    assert.equal(found.status, "OPEN");

    // Operations resolves ticket
    const resolveRes = await fetch(`${baseUrl}/api/support/tickets/${ticketId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ notes: "Valley view room confirmed with hotel." }),
    });
    assert.equal(resolveRes.status, 200);
    const resolvedData = await resolveRes.json();
    assert.equal(resolvedData.ticket.status, "RESOLVED");
  });

  it("Phase 5.3: Customer triggers cancellation request and refund record is created", async () => {
    const cancelRes = await fetch(`${baseUrl}/api/bookings/${testBookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({ reason: "Customer requested schedule postponement" }),
    });
    assert.equal(cancelRes.status, 200);
    const cancelData = await cancelRes.json();
    assert.equal(cancelData.booking.status, "CANCEL_REQUESTED");

    // Verify refund row exists in db
    const [refund] = await db
      .select()
      .from(refundsTable)
      .where(eq(refundsTable.bookingId, cancelData.booking.id))
      .limit(1);
    assert.ok(refund, "Refund record created in refundsTable");
    assert.equal(refund.status, "REQUESTED");
    testRefundId = refund.id;
  });

  // ==========================================================================
  // PHASE 6: PARTNER NETWORK
  // ==========================================================================
  it("Phase 6.1: Register partner account and verify unique referral code generation", async () => {
    const email = `partner.travel.${Date.now()}@zelevos.test`;
    const regRes = await fetch(`${baseUrl}/api/partners/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({
        agencyName: "Himalayan Expeditions India",
        contactName: "Vikram Singhania",
        email,
        phone: "+91 99887 76655",
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.partner);
    assert.ok(regData.partner.referralCode);
    testPartnerReferralCode = regData.partner.referralCode;
    testPartnerId = regData.partner.id;

    // Approve partner via admin approval endpoint
    const appRes = await fetch(`${baseUrl}/api/admin/partners/${testPartnerId}/approve`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(appRes.status, 200);
    const appData = await appRes.json();
    assert.equal(appData.partner.status, "approved");
  });

  it("Phase 6.2: Booking with partner referral calculates and credits commission in ledger", async () => {
    // 1. Create booking with partner referral code
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({
        packageId: testPackageId,
        travelDate: "2026-12-10",
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        roomsCount: 1,
        referralCode: testPartnerReferralCode,
        customerContact: {
          name: "Ananya Roy",
          email: "ananya.roy@example.com",
          phone: "+91 98112 23344",
        },
        travellers: [
          { fullName: "Ananya Roy", age: 29, gender: "FEMALE", isLead: true },
        ],
      }),
    });
    assert.equal(bookRes.status, 201);
    const bookData = await bookRes.json();
    const referredBookingId = bookData.booking.bookingId;
    assert.equal(bookData.booking.partnerId, testPartnerId);

    // 2. Pay booking -> triggers commission calculation (5%)
    const orderRes = await fetch(`${baseUrl}/api/payments/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({ bookingId: bookData.booking.id, idempotencyKey: `phase6-${referredBookingId}` }),
    });
    assert.equal(orderRes.status, 201);
    const orderData = await orderRes.json();
    const payRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({ orderId: orderData.orderId, paymentId: `pay_ref_${Date.now()}`, signature: "sig_test_valid" }),
    });
    assert.equal(payRes.status, 200);

    // 3. Verify Commission in Ledger
    const ledgerRes = await fetch(`${baseUrl}/api/partners/ledger`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(ledgerRes.status, 200);
    const ledgerData = await ledgerRes.json();
    assert.ok(Array.isArray(ledgerData.commissions));

    const foundComm = ledgerData.commissions.find((c: any) => c.partnerId === testPartnerId);
    assert.ok(foundComm, "Commission for partner recorded in ledger");
    const expectedCommission = Math.round((bookData.booking.totalPrice * 5) / 100);
    assert.equal(foundComm.commissionAmount, expectedCommission);
  });

  // ==========================================================================
  // PHASE 7: FINANCE & SECURITY HARDENING
  // ==========================================================================
  it("Phase 7.1: Finance overview and booking margin ledger report accurate metrics", async () => {
    const ovRes = await fetch(`${baseUrl}/api/finance/overview`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(ovRes.status, 200);
    const ovData = await ovRes.json();
    assert.ok(ovData.overview);
    assert.ok(ovData.overview.totalCustomerCollections > 0);
    assert.ok(ovData.overview.totalRealizedGrossMargin > 0);
    assert.ok(ovData.overview.pendingRefundsCount >= 1);

    const ledgerRes = await fetch(`${baseUrl}/api/finance/bookings`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(ledgerRes.status, 200);
    const ledgerData = await ledgerRes.json();
    assert.ok(Array.isArray(ledgerData.ledger));
    assert.ok(ledgerData.ledger.length >= 2);
  });

  it("Phase 7.2: Finance authorizes customer refund via /api/finance/refunds/:id/approve", async () => {
    assert.ok(testRefundId, "Test refund ID exists");

    const appRes = await fetch(`${baseUrl}/api/finance/refunds/${testRefundId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ notes: "Approved by Finance Executive for customer satisfaction." }),
    });
    assert.equal(appRes.status, 200);
    const appData = await appRes.json();
    assert.equal(appData.refund.status, "APPROVED");

    // Verify booking updated to REFUNDED
    const [refundedBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.bookingId, testBookingId))
      .limit(1);
    assert.equal(refundedBooking.status, "REFUNDED");
  });

  it("Phase 7.3: Signed document URL HMAC token generation and verification", async () => {
    // Generate signed document token
    const signRes = await fetch(`${baseUrl}/api/documents/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        documentId: testBookingId,
        documentType: "itinerary",
        bookingId: testBookingId,
      }),
    });
    assert.equal(signRes.status, 200);
    const signData = await signRes.json();
    assert.equal(signData.status, "success");
    assert.ok(signData.token);
    assert.ok(signData.signedUrl.includes("/api/documents/signed-view?token="));

    const viewRes = await fetch(`${baseUrl}${signData.signedUrl}`);
    assert.equal(viewRes.status, 200);
    assert.ok((await viewRes.text()).includes(testBookingId));
  });
});
