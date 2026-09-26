import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  vendorsTable,
  packagesTable,
  usersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { generateMasterBookingId, createFulfilmentTasksOnPayment, reevaluateBookingStatus } from "../src/services/booking-engine";

describe("Phase 4 — Operations Command Center & Vendor Portal Verification", () => {
  let testBookingId: string;
  let testBookingUuid: string;
  let hotelTaskId: string;
  let transferTaskId: string;
  let activityTaskId: string;
  let flightTaskId: string;
  let vendorId: string;

  it("1. Sets up a paid booking with hotel, transfer, activity, and flight desk tasks", async () => {
    // 1. Get Rajasthan package
    const [pkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.packageId, "ZL-RAJ-002"))
      .limit(1);
    assert.ok(pkg, "ZL-RAJ-002 package must exist");

    // 2. Get Rajasthan vendor
    const [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.vendorId, "VND-RAJASTHAN"))
      .limit(1);
    assert.ok(vendor, "VND-RAJASTHAN must exist");
    vendorId = vendor.id;

    // 3. Ensure test customer user
    let [customerUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "ops.test@zelevos.travel"))
      .limit(1);

    if (!customerUser) {
      [customerUser] = await db
        .insert(usersTable)
        .values({
          email: "ops.test@zelevos.travel",
          fullName: "Ops Tester",
          role: "customer",
          customerId: "CUST-OPSTEST",
        })
        .returning();
    }

    testBookingId = await generateMasterBookingId();

    const [createdBooking] = await db
      .insert(bookingsTable)
      .values({
        bookingId: testBookingId,
        customerId: customerUser.id,
        ownerId: customerUser.id,
        packageId: pkg.id,
        status: "PAID",
        paymentStatus: "SUCCESSFUL",
        travelDate: "2026-11-20",
        adultsCount: 2,
        childrenCount: 0,
        roomsCount: 1,
        flightRequired: true,
        flightStatus: "SUBJECT_TO_CONFIRMATION",
        totalPrice: 58000,
        totalBaseCost: 45000,
        totalMarkup: 13000,
        serviceFee: 0,
        customerContact: {
          name: "Ops Tester",
          email: "ops.test@zelevos.travel",
          phone: "+91 99999 88888",
        },
      })
      .returning();

    testBookingUuid = createdBooking.id;
    assert.ok(testBookingUuid);

    // Auto-generate child fulfillment tasks
    await createFulfilmentTasksOnPayment(testBookingId);

    const tasks = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.bookingId, testBookingUuid));

    assert.equal(tasks.length, 4, "Must have 4 tasks: hotel, transfer, activity, flight_partner");

    const hotel = tasks.find((t: any) => t.serviceType === "hotel");
    const transfer = tasks.find((t: any) => t.serviceType === "transfer");
    const activity = tasks.find((t: any) => t.serviceType === "activity");
    const flight = tasks.find((t: any) => t.serviceType === "flight_partner");

    assert.ok(hotel, "Hotel task must exist");
    assert.ok(transfer, "Transfer task must exist");
    assert.ok(activity, "Activity task must exist");
    assert.ok(flight, "Flight partner task must exist");

    hotelTaskId = hotel.id;
    transferTaskId = transfer.id;
    activityTaskId = activity.id;
    flightTaskId = flight.id;
  });

  it("2. Operations Task Assignment: Assigns task to vendor with SLA deadline", async () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 120 * 60 * 1000);

    const [updated] = await db
      .update(bookingServicesTable)
      .set({
        assignedVendorId: vendorId,
        status: "REQUESTED",
        deadline,
        requestedAt: now,
      })
      .where(eq(bookingServicesTable.id, hotelTaskId))
      .returning();

    assert.equal(updated.assignedVendorId, vendorId);
    assert.equal(updated.status, "REQUESTED");
    assert.ok(new Date(updated.deadline).getTime() > now.getTime(), "SLA deadline must be in the future");
  });

  it("3. Vendor Portal: Vendor accepts request and uploads confirmation voucher", async () => {
    const confirmationRef = "CONF-HTL-RAJ-9988";
    const voucherPdfUrl = "/vouchers/hotel-voucher-raj-9988.pdf";

    // 1. Vendor accepts
    const [accepted] = await db
      .update(bookingServicesTable)
      .set({
        status: "ACCEPTED",
        supplierConfirmationRef: confirmationRef,
        acceptedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, hotelTaskId))
      .returning();

    assert.equal(accepted.status, "ACCEPTED");
    assert.equal(accepted.supplierConfirmationRef, confirmationRef);

    // 2. Vendor uploads voucher
    const [voucherUploaded] = await db
      .update(bookingServicesTable)
      .set({
        voucherUrl: voucherPdfUrl,
        updatedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, hotelTaskId))
      .returning();

    assert.equal(voucherUploaded.voucherUrl, voucherPdfUrl);
  });

  it("4. Verification Gate: Customer status remains PROCESSING until all tasks verified", async () => {
    // 1. Operations verifies hotel task
    await db
      .update(bookingServicesTable)
      .set({
        status: "VERIFIED",
        customerFacingVerified: true,
        verifiedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, hotelTaskId));

    // Reevaluate booking status
    const status1 = await reevaluateBookingStatus(testBookingUuid);
    assert.equal(status1, "PARTIALLY_CONFIRMED", "Booking should be PARTIALLY_CONFIRMED when only 1 of 4 tasks is verified");

    // 2. Operations verifies transfer task
    await db
      .update(bookingServicesTable)
      .set({
        status: "VERIFIED",
        customerFacingVerified: true,
        supplierConfirmationRef: "CONF-TRF-001",
        verifiedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, transferTaskId));

    const status2 = await reevaluateBookingStatus(testBookingUuid);
    assert.equal(status2, "PARTIALLY_CONFIRMED", "Booking should still be PARTIALLY_CONFIRMED when 2 of 4 tasks verified");

    // 3. Operations verifies activity task
    await db
      .update(bookingServicesTable)
      .set({
        status: "VERIFIED",
        customerFacingVerified: true,
        supplierConfirmationRef: "CONF-ACT-001",
        verifiedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, activityTaskId));

    const status3 = await reevaluateBookingStatus(testBookingUuid);
    assert.equal(status3, "PARTIALLY_CONFIRMED", "Booking should still be PARTIALLY_CONFIRMED because flight desk is still pending!");
  });

  it("5. Manual Flight Desk: Issues PNR and e-ticket, unlocking final CONFIRMED status", async () => {
    const flightPnr = "6E-RAJ789";
    const ticketUrl = "/vouchers/e-ticket-raj789.pdf";

    // 1. Issue flight PNR on booking
    await db
      .update(bookingsTable)
      .set({
        flightPnr,
        flightTicketUrl: ticketUrl,
        flightStatus: "TICKETED",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, testBookingUuid));

    // 2. Verify flight_partner task
    await db
      .update(bookingServicesTable)
      .set({
        status: "VERIFIED",
        customerFacingVerified: true,
        supplierConfirmationRef: flightPnr,
        voucherUrl: ticketUrl,
        verifiedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, flightTaskId));

    // 3. Final reevaluation: ALL 4 tasks are now verified!
    const finalStatus = await reevaluateBookingStatus(testBookingUuid);
    assert.equal(finalStatus, "CONFIRMED", "Booking MUST transition to CONFIRMED once all tasks (including flight desk) are verified!");

    // Check booking record
    const [finalBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, testBookingUuid))
      .limit(1);

    assert.equal(finalBooking.status, "CONFIRMED");
    assert.equal(finalBooking.flightStatus, "TICKETED");
    assert.equal(finalBooking.flightPnr, flightPnr);
  });
});
