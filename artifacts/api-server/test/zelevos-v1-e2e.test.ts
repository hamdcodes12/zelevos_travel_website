import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth";
import { generateTotp } from "../src/services/totp-service";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-e2e";
process.env.CLIENT_BOOKING_EMAIL ??= "operations@zelevos.travel";
process.env.EMAIL_PROVIDER ??= "test";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const {
  db,
  usersTable,
  adminUsersTable,
  destinationsTable,
  packagesTable,
  vendorsTable,
  bookingsTable,
  partnersTable,
  commissionsTable,
  refundsTable,
  slaSettingsTable,
  customTripRequestsTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

// Session variables
let adminCookie = "";
let customerCookie = "";
let customerId = "";
let customerEmail = "";
let testDestinationId = "";
let testVendorId = "";
let testPackageId = "";
let createdBookingDbId = "";
let createdBookingPublicId = "";
let fulfillmentTaskId = "";
let partnerReferralCode = "";
let partnerDbId = "";
let refundId = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // 1. Create Admin in adminUsersTable and log in via /api/admin/login
  const adminId = `ADM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const adminPass = "AdminSecret123!";
  const [adminUserRecord] = await db
    .insert(adminUsersTable)
    .values({
      adminId,
      passwordHash: hashPassword(adminPass),
      role: "admin",
    })
    .returning();

  const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId, password: adminPass }),
  });
  const adminSessionCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

  // 2. Create User in usersTable with role: 'admin' and log in
  const adminUserEmail = `superadmin-${crypto.randomUUID().slice(0, 6)}@zelevos.travel`;
  const admUserRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminUserEmail, password: "AdminPass123!" }),
  });
  const admUserCookie = admUserRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  const admUserData = (await admUserRes.json()) as any;
  await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, admUserData.user.id));

  // Combine both session cookies so all admin / role middleware checks pass
  adminCookie = `${adminSessionCookie}; ${admUserCookie}`;

  // 3. Create regular customer user
  customerEmail = `e2e-cust-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const custRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: customerEmail, password: "CustomerPass123!" }),
  });
  customerCookie = custRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  const custBody = (await custRes.json()) as any;
  customerId = custBody.user.id;

  // 4. Seed a curated destination
  const destSlug = `himachal-e2e-${crypto.randomUUID().slice(0, 6)}`;
  const [dest] = await db
    .insert(destinationsTable)
    .values({
      slug: destSlug,
      name: "Himachal Pradesh",
      country: "India",
      state: "Himachal Pradesh",
      city: "Shimla & Manali",
      overview: "Scenic valleys and snow-capped Himalayan peaks.",
      bestTravelPeriod: "March to June, October to February",
      heroImage: "https://images.unsplash.com/photo-himachal.jpg",
      status: "active",
    })
    .returning();
  testDestinationId = dest.id;

  // 5. Seed an approved test vendor
  const vendorEmail = `vendor-e2e-${crypto.randomUUID().slice(0, 6)}@himalayastours.com`;
  const [vendor] = await db
    .insert(vendorsTable)
    .values({
      vendorId: `VND-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      businessName: "Himalayan Hospitality & Adventures",
      contactName: "Vikram Sharma",
      email: vendorEmail,
      phone: "+91 9876543210",
      serviceCategories: ["hotel", "transfer", "activity"],
      operatingLocations: ["Himachal Pradesh", "Manali"],
      approvalStatus: "approved",
      kycStatus: "approved",
      acceptanceRate: 96,
      avgResponseMinutes: 20,
      cancellationRate: 1,
    })
    .returning();
  testVendorId = vendor.id;
});

after(async () => {
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

describe("Zelevos V1 API-Free Marketplace End-to-End Suite", () => {
  it("1. Admin can create and publish a complete travel package (Section 8)", async () => {
    const pkgPayload = {
      packageId: `PKG-HIM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      title: "Majestic Manali & Solang Valley Escape",
      slug: `manali-solang-escape-${crypto.randomUUID().slice(0, 6)}`,
      destinationId: testDestinationId,
      locations: ["Manali", "Solang Valley", "Rohtang Pass"],
      durationDays: 5,
      durationNights: 4,
      theme: "Mountain Adventure & Scenic Leisure",
      travellerSuitability: "Couples, Families & Photography enthusiasts",
      baseCost: 28000,
      sellingPrice: 38500,
      markupType: "fixed",
      markupValue: 10500,
      serviceFee: 500,
      inventory: 15,
      inclusions: [
        "4 Nights Deluxe Mountain View Room",
        "Daily Buffet Breakfast & Dinner",
        "Private AC Sedan for all transfers",
        "Guided excursion to Solang Valley",
      ],
      exclusions: ["Personal laundry & beverages", "Flight / Train tickets to Chandigarh"],
      policies: { cancellation: "100% refund up to 7 days prior to travel" },
      media: { hero: "https://images.unsplash.com/photo-manali.jpg" },
      status: "active",
      assignedVendorIds: [testVendorId],
      featured: true,
      days: [
        {
          dayNumber: 1,
          title: "Arrival in Manali & Hotel Check-in",
          description: "Scenic transfer from Bhuntar / Chandigarh followed by leisure evening at Mall Road.",
          mealsIncluded: "Dinner",
          hotelDetails: "Himalayan View Resort (Deluxe Valley Room)",
        },
        {
          dayNumber: 2,
          title: "Solang Valley Adventure Day",
          description: "Full day excursion to Solang Valley with paragliding and cable car ride.",
          mealsIncluded: "Breakfast & Dinner",
        },
      ],
    };

    const res = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify(pkgPayload),
    }, adminCookie);

    const body = await res.json() as any;
    assert.equal(res.status, 201, `Failed to create package: ${JSON.stringify(body)}`);
    assert.ok(body.package.id, "Package ID must be generated");
    assert.equal(body.package.title, pkgPayload.title);
    assert.equal(body.package.baseCost, 28000);
    assert.equal(body.package.sellingPrice, 38500);
    assert.equal(body.days.length, 2);

    testPackageId = body.package.id;

    // Verify package appears in public catalogue with dynamic Trip Confidence Score
    const publicRes = await api(`/api/packages/${body.package.slug}`);
    assert.equal(publicRes.status, 200);
    const publicBody = await publicRes.json() as any;
    assert.equal(publicBody.package.id, testPackageId);
    assert.ok(publicBody.package.tripConfidenceScore, "Public package detail must include Trip Confidence Score");
    assert.ok(publicBody.package.tripConfidenceScore.score >= 0 && publicBody.package.tripConfidenceScore.score <= 100);
  });

  it("2. Customer books package end-to-end with flight-without-API request (ZL{YYMMDD}{seq})", async () => {
    const bookingPayload = {
      packageId: testPackageId,
      travelDate: "2026-10-15",
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
      roomsCount: 1,
      selectedAddons: ["Candlelight Dinner"],
      specialRequests: "High floor room facing snow peaks",
      flightRequired: true,
      flightRequirementDetails: {
        preferredRoute: "DEL -> KUU (Kullu Bhuntar)",
        preferredDates: "2026-10-15 morning",
        passengerNames: ["Aarav Sharma", "Priya Sharma"],
        baggageRequirements: "15kg check-in per passenger",
      },
      customerContact: {
        name: "Aarav Sharma",
        email: customerEmail,
        phone: "+91 9811223344",
      },
      travellers: [
        {
          fullName: "Aarav Sharma",
          age: 32,
          gender: "Male",
          isLead: true,
          contactPhone: "+91 9811223344",
          contactEmail: customerEmail,
        },
        {
          fullName: "Priya Sharma",
          age: 29,
          gender: "Female",
          isLead: false,
        },
      ],
    };

    const res = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify(bookingPayload),
    }, customerCookie);

    const body = await res.json() as any;
    assert.equal(res.status, 201, `Failed to create booking: ${JSON.stringify(body)}`);
    assert.ok(body.booking.id);
    assert.ok(body.booking.bookingId, "Master Booking ID must be generated");

    createdBookingDbId = body.booking.id;
    createdBookingPublicId = body.booking.bookingId;

    // Acceptance Criteria: Payment creates a unique Zelevos Booking ID in format ZL{YYMMDD}{seq}
    const bookingIdRegex = /^ZL\d{6}\d{3,4}$/;
    assert.match(
      body.booking.bookingId,
      bookingIdRegex,
      `Booking ID '${body.booking.bookingId}' must match format ZL{YYMMDD}{seq}`
    );

    // Acceptance Criteria: Flight-without-API flow shows 'subject to confirmation'
    assert.equal(body.booking.flightRequired, true);
    assert.equal(body.booking.flightStatus, "SUBJECT_TO_CONFIRMATION");
    assert.equal(body.booking.status, "PAYMENT_PENDING");
  });

  it("3. Payment capture updates booking to PAID & auto-creates fulfilment tasks with SLA deadlines", async () => {
    const orderRes = await api("/api/payments/order", {
      method: "POST",
      body: JSON.stringify({ bookingId: createdBookingDbId, idempotencyKey: `e2e-${createdBookingPublicId}` }),
    }, customerCookie);
    const orderBody = await orderRes.json() as any;
    assert.equal(orderRes.status, 201, `Payment order failed: ${JSON.stringify(orderBody)}`);

    const verifyRes = await api("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({
        orderId: orderBody.orderId,
        paymentId: `pay_test_${crypto.randomUUID().slice(0, 8)}`,
        signature: "sig_test_valid",
      }),
    }, customerCookie);
    const verifyBody = await verifyRes.json() as any;
    assert.equal(verifyRes.status, 200, `Payment capture failed: ${JSON.stringify(verifyBody)}`);
    assert.equal(verifyBody.verified, true);

    const bookingRes = await api(`/api/bookings/${createdBookingPublicId}`, {}, customerCookie);
    const bookingBody = await bookingRes.json() as any;
    assert.equal(bookingBody.booking.status, "PROCESSING");
    assert.equal(bookingBody.booking.paymentStatus, "SUCCESSFUL");

    // Verify fulfilment tasks auto-created for operations in bookingServicesTable
    const tasksRes = await api(`/api/operations/tasks?bookingId=${createdBookingPublicId}`, {}, adminCookie);
    assert.equal(tasksRes.status, 200);
    const tasksBody = await tasksRes.json() as any;
    assert.ok(tasksBody.tasks.length > 0, "Tasks must be auto-generated upon payment success");

    const firstTask = tasksBody.tasks[0].task;
    fulfillmentTaskId = firstTask.id;
    assert.ok(firstTask.deadline, "Fulfillment task must have dynamic SLA deadline calculated");
    assert.equal(firstTask.customerFacingVerified, false, "Task must start with customerFacingVerified = false");
  });

  it("4. Operations assigns task to vendor with SLA tracking", async () => {
    const assignRes = await api(`/api/operations/tasks/${fulfillmentTaskId}/assign`, {
      method: "POST",
      body: JSON.stringify({
        vendorId: testVendorId,
        notes: "Priority high-season booking for honeymoon couple.",
      }),
    }, adminCookie);

    const assignBody = await assignRes.json() as any;
    assert.equal(assignRes.status, 200, `Task assignment failed: ${JSON.stringify(assignBody)}`);
    assert.equal(assignBody.task.status, "REQUESTED");
    assert.equal(assignBody.task.assignedVendorId, testVendorId);
  });

  it("5. Vendor accepts request, but Operations Verification Gate prevents premature customer confirmation", async () => {
    // Vendor accepts via Vendor Portal
    const acceptRes = await api(`/api/vendor/portal/requests/${fulfillmentTaskId}/accept`, {
      method: "POST",
      headers: { "x-vendor-id": testVendorId },
      body: JSON.stringify({
        confirmationRef: "HOTEL-CONF-8899",
        notes: "Deluxe valley view room locked for 4 nights.",
      }),
    });

    const acceptBody = await acceptRes.json() as any;
    assert.equal(acceptRes.status, 200, `Accept failed: ${JSON.stringify(acceptBody)}`);
    assert.equal(acceptBody.task.status, "ACCEPTED");

    // Acceptance Criteria: Operations verification gate — customer status only updates after verification
    const bookingCheck = await api(`/api/bookings/${createdBookingPublicId}`, {}, customerCookie);
    const bookingBody = await bookingCheck.json() as any;
    assert.notEqual(
      bookingBody.booking.status,
      "CONFIRMED",
      "Customer status MUST NOT be CONFIRMED until Operations explicitly verifies supplier confirmation"
    );
  });

  it("6. Operations verifies supplier confirmation & triggers customer status and voucher release", async () => {
    const verifyRes = await api(`/api/operations/tasks/${fulfillmentTaskId}/verify`, {
      method: "POST",
      body: JSON.stringify({
        confirmationRef: "HOTEL-CONF-8899-VERIFIED",
        voucherUrl: "/vouchers/manali-hotel.pdf",
        notes: "Confirmed directly with hotel general manager.",
      }),
    }, adminCookie);

    const verifyBody = await verifyRes.json() as any;
    assert.equal(verifyRes.status, 200, `Verification failed: ${JSON.stringify(verifyBody)}`);
    assert.equal(verifyBody.task.status, "VERIFIED");
    assert.equal(verifyBody.task.customerFacingVerified, true);

    // Customer can now see verified progress in My Trips
    const myTripsRes = await api("/api/bookings/my-trips", {}, customerCookie);
    assert.equal(myTripsRes.status, 200);
    const myTripsBody = await myTripsRes.json() as any;
    assert.ok(myTripsBody.trips.some((t: any) => t.bookingId === createdBookingPublicId));
  });

  it("7. Flight-without-API flow: Ops uploads manual flight PNR & ticket", async () => {
    const flightPnrRes = await api(`/api/operations/bookings/${createdBookingPublicId}/flight-pnr`, {
      method: "POST",
      body: JSON.stringify({
        pnr: "6E-KULLU-9842",
        airline: "IndiGo / Alliance Air",
        ticketUrl: "/tickets/flight-aarav-priya.pdf",
        notes: "Booked direct via offline airline agent desk.",
      }),
    }, adminCookie);

    const flightBody = await flightPnrRes.json() as any;
    assert.equal(flightPnrRes.status, 200, `Flight PNR upload failed: ${JSON.stringify(flightBody)}`);
    assert.equal(flightBody.booking.flightStatus, "TICKETED");
    assert.equal(flightBody.booking.flightPnr, "6E-KULLU-9842");

    // Trip detail reflects issued PNR
    const tripDetail = await api(`/api/bookings/${createdBookingPublicId}`, {}, customerCookie);
    const tripBody = await tripDetail.json() as any;
    assert.equal(tripBody.booking.flightPnr, "6E-KULLU-9842");
    assert.equal(tripBody.booking.flightStatus, "TICKETED");
  });

  it("8. Customer views Section 11 live timeline and downloads consolidated digital itinerary", async () => {
    const tripRes = await api(`/api/bookings/${createdBookingPublicId}`, {}, customerCookie);
    assert.equal(tripRes.status, 200);
    const tripData = await tripRes.json() as any;

    // Timeline validation (Section 11)
    assert.ok(Array.isArray(tripData.booking.timeline));
    assert.ok(tripData.booking.timeline.length >= 2, "Timeline must contain multiple events");

    // Download consolidated HTML/PDF itinerary
    const itineraryRes = await api(`/api/bookings/${createdBookingPublicId}/itinerary`, {}, customerCookie);
    assert.equal(itineraryRes.status, 200);
    const itineraryHtml = await itineraryRes.text();
    assert.ok(itineraryHtml.includes("Zelevos"), "Itinerary must contain Zelevos branding");
    assert.ok(itineraryHtml.includes(createdBookingPublicId), "Itinerary must contain Master Booking ID");
    assert.ok(itineraryHtml.includes("6E-KULLU-9842"), "Itinerary must display manual flight PNR");
  });

  it("9. Sensitive document security: signed 15-minute token URL serving (Gap 3)", async () => {
    // Generate signed token
    const signRes = await api("/api/documents/sign", {
      method: "POST",
      body: JSON.stringify({
        documentId: "VOUCHER-MANALI-01",
        documentType: "voucher",
        bookingId: createdBookingPublicId,
      }),
    }, customerCookie);

    const signBody = await signRes.json() as any;
    assert.equal(signRes.status, 200, `Sign failed: ${JSON.stringify(signBody)}`);
    assert.ok(signBody.token);
    assert.ok(signBody.signedUrl.includes("/api/documents/signed-view?token="));

    // Access document with valid signed token
    const viewRes = await fetch(`${baseUrl}${signBody.signedUrl}`);
    assert.equal(viewRes.status, 200);
    const viewHtml = await viewRes.text();
    assert.ok(viewHtml.includes("VOUCHER-MANALI-01"));

    // Verify invalid or tampered token returns 403 Forbidden
    const tamperedRes = await fetch(`${baseUrl}/api/documents/signed-view?token=invalid.tampered.token`);
    assert.equal(tamperedRes.status, 403);
  });

  it("10. Partner Network: Registration, referral tracking, and commission ledger update", async () => {
    const partnerEmail = `partner-e2e-${crypto.randomUUID().slice(0, 6)}@voyages.com`;
    const regRes = await api("/api/partners/register", {
      method: "POST",
      body: JSON.stringify({
        agencyName: "Voyages Elite Travel",
        contactName: "Sunita Roy",
        email: partnerEmail,
        phone: "+91 9988776655",
        bankDetails: { accountNumber: "987654321098", ifsc: "HDFC0001234" },
      }),
    });

    const regBody = await regRes.json() as any;
    assert.equal(regRes.status, 201, `Partner registration failed: ${JSON.stringify(regBody)}`);
    assert.ok(regBody.partner.referralCode);
    partnerReferralCode = regBody.partner.referralCode;
    partnerDbId = regBody.partner.id;

    // Approve partner so commissions record
    await db.update(partnersTable).set({ status: "approved" }).where(eq(partnersTable.id, partnerDbId));

    // Book another package with referral code
    const refBookingPayload = {
      packageId: testPackageId,
      travelDate: "2026-11-20",
      adultsCount: 2,
      referralCode: partnerReferralCode,
      customerContact: {
        name: "Referred Client",
        email: `client-ref-${crypto.randomUUID().slice(0, 6)}@example.com`,
        phone: "+91 9877112233",
      },
      travellers: [{ fullName: "Referred Client", age: 35, gender: "Male", isLead: true }],
    };

    const refBookRes = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify(refBookingPayload),
    }, customerCookie);
    const refBookBody = await refBookRes.json() as any;
    assert.equal(refBookRes.status, 201, `Referred booking failed: ${JSON.stringify(refBookBody)}`);

    // Pay for referred booking
    const refOrderRes = await api("/api/payments/order", {
      method: "POST",
      body: JSON.stringify({ bookingId: refBookBody.booking.id, idempotencyKey: `e2e-ref-${refBookBody.booking.bookingId}` }),
    }, customerCookie);
    const refOrderBody = await refOrderRes.json() as any;
    assert.equal(refOrderRes.status, 201, `Payment order failed: ${JSON.stringify(refOrderBody)}`);
    const refVerifyRes = await api("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({ orderId: refOrderBody.orderId, paymentId: `pay_ref_${Date.now()}`, signature: "sig_test_valid" }),
    }, customerCookie);
    assert.equal(refVerifyRes.status, 200, `Payment verification failed: ${JSON.stringify(await refVerifyRes.json())}`);

    // Verify commission recorded in partner ledger
    const [commission] = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.partnerId, partnerDbId));

    assert.ok(commission, "Commission must be generated in commission ledger");
    assert.equal(commission.bookingAmount, 39000);
    assert.ok(commission.commissionAmount > 0, "Commission amount must be greater than 0");
  });

  it("11. 'Build My Trip' custom vacation request creates lead visible to Ops", async () => {
    const customTripRes = await api("/api/custom-trips", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Rohan Varma",
        customerEmail: "rohan.varma@example.com",
        customerPhone: "+91 9776655443",
        destinations: ["Kashmir", "Gulmarg", "Pahalgam"],
        durationDays: 6,
        travellersCount: 4,
        budgetPerPerson: 45000,
        hotelPreference: "5 Star Luxury",
        transportPreference: "Innova Crysta",
        activitiesInterests: ["Shikara Ride", "Gondola Phase 2", "Snow Trekking"],
        specialRequests: "Anniversary celebration on Day 3",
      }),
    }, customerCookie);

    const leadBody = await customTripRes.json() as any;
    assert.equal(customTripRes.status, 201, `Failed to submit custom trip: ${JSON.stringify(leadBody)}`);
    assert.ok(leadBody.lead.leadNumber.startsWith("LEAD-"));
    const leadId = leadBody.lead.id;

    // Ops views custom leads
    const opsLeadsRes = await api("/api/admin/custom-trips", {}, adminCookie);
    assert.equal(opsLeadsRes.status, 200);
    const opsLeadsBody = await opsLeadsRes.json() as any;
    assert.ok(opsLeadsBody.leads.some((l: any) => l.id === leadId));

    // Ops sends proposal
    const proposalRes = await api(`/api/admin/custom-trips/${leadId}/proposal`, {
      method: "POST",
      body: JSON.stringify({
        proposalTitle: "Custom 6-Day Royal Kashmir Luxury Tour",
        proposalAmount: 180000,
        proposalPaymentLink: "https://zelevos.travel/pay/lead-royalkashmir",
      }),
    }, adminCookie);

    const propBody = await proposalRes.json() as any;
    assert.equal(proposalRes.status, 200, `Failed to send proposal: ${JSON.stringify(propBody)}`);
    assert.equal(propBody.lead.status, "PROPOSAL_SENT");
  });

  it("12. Finance dashboard displays collections, supplier costs, margins, and handles refunds", async () => {
    // 1. Finance Overview
    const overviewRes = await api("/api/finance/overview", {}, adminCookie);
    assert.equal(overviewRes.status, 200);
    const overviewBody = await overviewRes.json() as any;
    assert.ok(overviewBody.overview.totalCustomerCollections > 0, "Collections must be > 0");
    assert.ok(overviewBody.overview.activeBookingsCount >= 1, "Active bookings count must be >= 1");

    // 2. Booking Ledger
    const ledgerRes = await api("/api/finance/bookings-ledger", {}, adminCookie);
    assert.equal(ledgerRes.status, 200);
    const ledgerBody = await ledgerRes.json() as any;
    assert.ok(ledgerBody.ledger.length >= 1);
    const sampleEntry = ledgerBody.ledger[0];
    assert.ok(typeof sampleEntry.computedMargin === "number");

    // 3. Customer requests cancellation
    const cancelRes = await api(`/api/bookings/${createdBookingPublicId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Medical emergency in family" }),
    }, customerCookie);

    assert.equal(cancelRes.status, 200);

    // Verify refund entry was created
    const [refund] = await db
      .select()
      .from(refundsTable)
      .where(eq(refundsTable.bookingId, createdBookingDbId));

    assert.ok(refund, "Refund record must be created on cancellation request");
    refundId = refund.id;

    // 4. Finance officer approves refund
    const processRes = await api(`/api/finance/refunds/${refundId}/process`, {
      method: "POST",
      body: JSON.stringify({
        action: "APPROVE",
        notes: "Approved per 7-day cancellation policy.",
      }),
    }, adminCookie);

    const processBody = await processRes.json() as any;
    assert.equal(processRes.status, 200, `Process refund failed: ${JSON.stringify(processBody)}`);
    assert.equal(processBody.refund.status, "APPROVED");
  });

  it("13. Configurable SLA settings can be updated by admin (Gap 5)", async () => {
    const getSlaRes = await api("/api/admin/sla-settings", {}, adminCookie);
    assert.equal(getSlaRes.status, 200);
    const slaBody = await getSlaRes.json() as any;
    assert.ok(slaBody.settings.length > 0);

    // Update threshold
    const updateRes = await api("/api/admin/sla-settings/standard_supplier_confirmation", {
      method: "PUT",
      body: JSON.stringify({
        durationMinutes: 45,
        displayName: "Standard Supplier Confirmation (Fast-Tracked)",
      }),
    }, adminCookie);

    assert.ok(updateRes.status === 200 || updateRes.status === 201, `SLA update failed: status ${updateRes.status}`);
    const updatedBody = await updateRes.json() as any;
    assert.equal(updatedBody.setting.durationMinutes, 45);
  });

  it("14. 2FA works for Admin logins (Setup, Enable, and TOTP verification)", async () => {
    // 1. Setup 2FA
    const setupRes = await api("/api/admin/2fa/setup", { method: "POST" }, adminCookie);
    const setupBody = await setupRes.json() as any;
    assert.equal(setupRes.status, 200, `2FA setup failed: ${JSON.stringify(setupBody)}`);
    assert.ok(setupBody.secret);

    // 2. Generate valid TOTP token and enable
    const validToken = generateTotp(setupBody.secret);
    const enableRes = await api("/api/admin/2fa/enable", {
      method: "POST",
      body: JSON.stringify({
        secret: setupBody.secret,
        token: validToken,
      }),
    }, adminCookie);

    const enableBody = await enableRes.json() as any;
    assert.equal(enableRes.status, 200, `2FA enable failed: ${JSON.stringify(enableBody)}`);
    assert.equal(enableBody.status, "success");
  });
});
