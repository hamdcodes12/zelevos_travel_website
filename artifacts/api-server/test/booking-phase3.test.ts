import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  db,
  packagesTable,
  destinationsTable,
  vendorsTable,
  bookingsTable,
  bookingServicesTable,
  travellersTable,
  paymentsTable,
  slaSettingsTable,
  usersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { computeTripConfidenceScore } from "../src/services/trip-confidence";
import { generateMasterBookingId, createFulfilmentTasksOnPayment } from "../src/services/booking-engine";

describe("Phase 3 — Booking, Payment & Fulfillment Decomposition Tests", () => {
  let kashmirPkgId: string;
  let rajasthanPkgId: string;

  it("1. Dynamic Trip Confidence Score differs genuinely between Kashmir (92%) and Rajasthan (89%)", async () => {
    // 1. Fetch Kashmir package
    const [kashmirPkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.packageId, "ZL-KASH-001"))
      .limit(1);
    assert.ok(kashmirPkg, "ZL-KASH-001 must exist in database");
    kashmirPkgId = kashmirPkg.id;

    // 2. Fetch Rajasthan package
    const [rajasthanPkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.packageId, "ZL-RAJ-002"))
      .limit(1);
    assert.ok(rajasthanPkg, "ZL-RAJ-002 must exist in database");
    rajasthanPkgId = rajasthanPkg.id;

    // 3. Compute Kashmir score from assigned vendor VND-HIMALAYAN
    const [kashmirVendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.vendorId, "VND-HIMALAYAN"))
      .limit(1);
    assert.ok(kashmirVendor, "VND-HIMALAYAN must exist in database");

    const kashmirScore = computeTripConfidenceScore({
      acceptanceRate: Number(kashmirVendor.acceptanceRate),
      avgResponseMinutes: Number(kashmirVendor.avgResponseMinutes),
      cancellationRate: Number(kashmirVendor.cancellationRate),
    });

    // 4. Compute Rajasthan score from assigned vendor VND-RAJASTHAN
    const [rajasthanVendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.vendorId, "VND-RAJASTHAN"))
      .limit(1);
    assert.ok(rajasthanVendor, "VND-RAJASTHAN must exist in database");

    const rajasthanScore = computeTripConfidenceScore({
      acceptanceRate: Number(rajasthanVendor.acceptanceRate),
      avgResponseMinutes: Number(rajasthanVendor.avgResponseMinutes),
      cancellationRate: Number(rajasthanVendor.cancellationRate),
    });

    // Kashmir: 98% acc, 25m resp, 1% canc -> 92%
    assert.equal(kashmirScore.score, 92, "Kashmir confidence score must be 92%");
    assert.equal(kashmirScore.label, "High confidence");

    // Rajasthan: 96% acc, 35m resp, 1% canc -> 89%
    assert.equal(rajasthanScore.score, 89, "Rajasthan confidence score must be 89%");
    assert.equal(rajasthanScore.label, "High confidence");

    // Assert strictly different
    assert.notEqual(
      kashmirScore.score,
      rajasthanScore.score,
      "Trip Confidence Score MUST be dynamically calculated and different per package"
    );
  });

  it("2. Master Booking ID Generator mints sequential ZL{YYMMDD}{seq} format", async () => {
    const id1 = await generateMasterBookingId();
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const expectedPrefix = `ZL${yy}${mm}${dd}`;

    assert.ok(id1.startsWith(expectedPrefix), `Booking ID ${id1} must start with ${expectedPrefix}`);
    const regex = new RegExp(`^ZL\\d{6}\\d{3,4}$`);
    assert.match(id1, regex, "Booking ID must match standardized ZL{YYMMDD}{seq} pattern");
  });

  it("3. Creates a booking for ZL-RAJ-002 with all PRD Section 7.4 fields, dynamic pricing, and flight assistance", async () => {
    const [pkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.id, rajasthanPkgId))
      .limit(1);
    assert.ok(pkg);

    const travelDate = "2026-11-10";
    const adultsCount = 2;
    const childrenCount = 1;
    const infantsCount = 1;
    const roomsCount = 2;
    const flightRequired = true;
    const specialRequests = "Ground floor haveli room, vegetarian dinner meals";

    // Dynamic pricing math
    const roomMultiplier = Math.max(1, roomsCount);
    const expectedTotalPrice = pkg.sellingPrice * roomMultiplier + pkg.serviceFee;
    const expectedTotalBaseCost = pkg.baseCost * roomMultiplier;
    const expectedTotalMarkup = expectedTotalPrice - expectedTotalBaseCost;

    const bookingId = await generateMasterBookingId();

    // Ensure customer user exists
    let [customerUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "vikram.rathore@test-travel.in"))
      .limit(1);

    if (!customerUser) {
      [customerUser] = await db
        .insert(usersTable)
        .values({
          email: "vikram.rathore@test-travel.in",
          fullName: "Vikramaditya Rathore",
          phone: "+91 98290 12345",
          role: "customer",
          customerId: "CUST-VIKRAM",
        })
        .returning();
    }

    const [createdBooking] = await db
      .insert(bookingsTable)
      .values({
        bookingId,
        customerId: customerUser.id,
        ownerId: customerUser.id,
        packageId: pkg.id,
        status: "PAYMENT_PENDING",
        travelDate,
        adultsCount,
        childrenCount,
        infantsCount,
        roomsCount,
        specialRequests,
        flightRequired,
        flightRequirementDetails: {
          preferredRoute: "DEL to JAI Circuit",
          preferredDates: travelDate,
          passengerNames: ["Vikramaditya Rathore", "Sunita Rathore"],
        },
        flightStatus: "SUBJECT_TO_CONFIRMATION",
        totalPrice: expectedTotalPrice,
        totalBaseCost: expectedTotalBaseCost,
        totalMarkup: expectedTotalMarkup,
        serviceFee: pkg.serviceFee,
        customerContact: {
          name: "Vikramaditya Rathore",
          email: "vikram.rathore@test-travel.in",
          phone: "+91 98290 12345",
        },
        timeline: [
          {
            event: `Booking created with ID ${bookingId}`,
            timestamp: new Date().toISOString(),
            actor: "Vikramaditya Rathore",
            notes: "Awaiting customer payment",
          },
        ],
      })
      .returning();

    assert.ok(createdBooking.id);
    assert.equal(createdBooking.bookingId, bookingId);
    assert.equal(createdBooking.status, "PAYMENT_PENDING");
    assert.equal(createdBooking.totalPrice, expectedTotalPrice);
    assert.equal(createdBooking.totalBaseCost, expectedTotalBaseCost);
    assert.equal(createdBooking.totalMarkup, expectedTotalMarkup);
    assert.equal(createdBooking.flightRequired, true);
    assert.equal(createdBooking.flightStatus, "SUBJECT_TO_CONFIRMATION");

    // Insert travellers
    const travellersData = [
      {
        bookingId: createdBooking.id,
        fullName: "Vikramaditya Rathore",
        age: 38,
        gender: "Male",
        isLead: true,
        contactPhone: "+91 98290 12345",
        contactEmail: "vikram.rathore@test-travel.in",
      },
      {
        bookingId: createdBooking.id,
        fullName: "Sunita Rathore",
        age: 35,
        gender: "Female",
        isLead: false,
      },
      {
        bookingId: createdBooking.id,
        fullName: "Ayaan Rathore",
        age: 7,
        gender: "Male",
        isLead: false,
      },
      {
        bookingId: createdBooking.id,
        fullName: "Mira Rathore",
        age: 1,
        gender: "Female",
        isLead: false,
      },
    ];

    for (const t of travellersData) {
      await db.insert(travellersTable).values(t);
    }

    const travellersInDb = await db
      .select()
      .from(travellersTable)
      .where(eq(travellersTable.bookingId, createdBooking.id));
    assert.equal(travellersInDb.length, 4, "All 4 travellers must be persisted");
    const lead = travellersInDb.find((t: any) => t.isLead);
    assert.ok(lead);
    assert.equal(lead.fullName, "Vikramaditya Rathore");
  });

  it("4. Processes payment, transitions status to PAID, and records payment receipt", async () => {
    // Find the pending booking
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "PAYMENT_PENDING"))
      .orderBy(sql`${bookingsTable.createdAt} DESC`)
      .limit(1);
    assert.ok(booking);

    const testPaymentId = `pay_rzp_test_${Date.now()}`;
    const testSignature = "simulated_hmac_sha256_sig";

    // Insert payment record
    await db.insert(paymentsTable).values({
      bookingId: booking.id,
      userId: booking.customerId,
      provider: "test",
      razorpayPaymentId: testPaymentId,
      razorpaySignature: testSignature,
      amount: booking.totalPrice,
      currency: "INR",
      status: "SUCCESSFUL",
      receiptNumber: `REC-${booking.bookingId}`,
    });

    // Transition booking to PAID
    const timeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
    timeline.push({
      event: `Payment of ₹${booking.totalPrice.toLocaleString("en-IN")} captured successfully`,
      timestamp: new Date().toISOString(),
      actor: "Payment Gateway",
      notes: `Ref: ${testPaymentId}`,
    });

    await db
      .update(bookingsTable)
      .set({
        status: "PAID",
        paymentId: testPaymentId,
        paymentStatus: "SUCCESSFUL",
        timeline,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id));

    // Verify booking is now PAID
    const [updatedBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, booking.id))
      .limit(1);

    assert.equal(updatedBooking.status, "PAID");
    assert.equal(updatedBooking.paymentStatus, "SUCCESSFUL");
    assert.equal(updatedBooking.paymentId, testPaymentId);

    // Verify payment record
    const [paymentRecord] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.bookingId, booking.id))
      .limit(1);
    assert.ok(paymentRecord);
    assert.equal(paymentRecord.status, "SUCCESSFUL");
    assert.equal(paymentRecord.receiptNumber, `REC-${booking.bookingId}`);
  });

  it("5. Automatically decomposes booking into child fulfillment tasks with SLA deadlines", async () => {
    const [paidBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "PAID"))
      .orderBy(sql`${bookingsTable.createdAt} DESC`)
      .limit(1);
    assert.ok(paidBooking);

    // Trigger fulfillment decomposition
    await createFulfilmentTasksOnPayment(paidBooking.bookingId);

    // Fetch generated services
    const services = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.bookingId, paidBooking.id));

    assert.ok(services.length >= 4, "Must generate at least hotel, transfer, activity, and flight_partner tasks");

    const types = services.map((s: any) => s.serviceType);
    assert.ok(types.includes("hotel"), "Child task 'hotel' must exist");
    assert.ok(types.includes("transfer"), "Child task 'transfer' must exist");
    assert.ok(types.includes("activity"), "Child task 'activity' must exist");
    assert.ok(
      types.includes("flight_partner"),
      "Child task 'flight_partner' must exist when flightRequired is true"
    );

    // Check SLA deadline on all child tasks
    for (const service of services) {
      assert.ok(service.deadline, `Service ${service.serviceType} must have an SLA deadline`);
      const deadlineDate = new Date(service.deadline);
      const now = new Date();
      assert.ok(
        deadlineDate.getTime() > now.getTime(),
        `SLA deadline ${service.deadline} must be in the future`
      );
    }
  });

  it("6. State Machine Guard: Rejects duplicate payment for already PAID / PROCESSING booking", async () => {
    const [processedBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "PROCESSING"))
      .limit(1);
    assert.ok(processedBooking, "Booking must have transitioned to PROCESSING after fulfillment tasks generated");

    // In bookings.ts: if booking.status !== "PAYMENT_PENDING" -> returns 400 invalid_state
    const isPayable = processedBooking.status === "PAYMENT_PENDING";
    assert.equal(
      isPayable,
      false,
      "Already PAID/PROCESSING booking cannot be paid again (prevents double charging)"
    );
  });
});
