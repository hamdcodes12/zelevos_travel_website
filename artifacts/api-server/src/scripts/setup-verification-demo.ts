import {
  db,
  bookingsTable,
  bookingServicesTable,
  usersTable,
  packagesTable,
  vendorsTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";

async function main() {
  console.log("Setting up ZL260920001 verification demo state...");

  // 1. Ensure customer user exists
  const customerEmail = "customer@zelevos.com";
  let [customer] = await db.select().from(usersTable).where(eq(usersTable.email, customerEmail)).limit(1);
  if (!customer) {
    [customer] = await db.insert(usersTable).values({
      email: customerEmail,
      passwordHash: hashPassword("CustomerPass123!"),
      fullName: "Aarav Sharma",
      role: "customer",
      phone: "+91 9811223344",
    }).returning();
    console.log("Created customer:", customer.email, customer.id);
  } else {
    console.log("Found customer:", customer.email, customer.id);
  }

  // 2. Ensure Rajasthan package exists
  let [pkg] = await db.select().from(packagesTable).where(or(eq(packagesTable.packageId, "ZL-RAJ-002"), eq(packagesTable.slug, "royal-rajasthan-heritage"))).limit(1);
  if (!pkg) {
    const pkgs = await db.select().from(packagesTable).limit(1);
    pkg = pkgs[0];
  }
  console.log("Using package:", pkg?.title, pkg?.id);

  // 3. Ensure approved vendor exists
  let [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.approvalStatus, "approved")).limit(1);
  if (!vendor) {
    [vendor] = await db.insert(vendorsTable).values({
      vendorId: "VND-RAJ-001",
      businessName: "Heritage Royal Stays & Tours",
      contactName: "Rajendra Singh",
      email: "rajendra@heritageroyal.in",
      phone: "+91 9829012345",
      serviceCategories: ["hotel", "transfer"],
      operatingLocations: ["Rajasthan", "Jaipur", "Udaipur"],
      approvalStatus: "approved",
      kycStatus: "approved",
      acceptanceRate: 98,
      avgResponseMinutes: 15,
      cancellationRate: 0,
    }).returning();
  }
  console.log("Using vendor:", vendor.businessName, vendor.id);

  // 4. Check or create booking ZL260920001
  let [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingId, "ZL260920001")).limit(1);
  if (!booking) {
    [booking] = await db.insert(bookingsTable).values({
      bookingId: "ZL260920001",
      customerId: customer.id,
      ownerId: customer.id,
      packageId: pkg?.id,
      packageTitle: pkg?.title || "Royal Rajasthan Heritage & Desert Experience",
      status: "PROCESSING", // non-confirmed / pending status
      paymentStatus: "PAID",
      totalPrice: 48500,
      amount: 48500,
      currency: "INR",
      travelDate: "2026-10-20",
      adultsCount: 2,
      childrenCount: 0,
      roomsCount: 1,
      flightRequired: true,
      flightStatus: "SUBJECT_TO_CONFIRMATION",
      tripConfidenceScore: 89,
      customerContact: {
        name: "Aarav Sharma",
        email: customerEmail,
        phone: "+91 9811223344",
      },
    }).returning();
    console.log("Created booking ZL260920001:", booking.id, booking.status);
  } else {
    // Reset to PROCESSING / unverified so we have before verification state
    [booking] = await db.update(bookingsTable).set({
      customerId: customer.id,
      ownerId: customer.id,
      packageId: pkg?.id,
      packageTitle: pkg?.title || "Royal Rajasthan Heritage & Desert Experience",
      status: "PROCESSING",
      paymentStatus: "PAID",
      tripConfidenceScore: 89,
      flightRequired: true,
      flightStatus: "SUBJECT_TO_CONFIRMATION",
    }).where(eq(bookingsTable.id, booking.id)).returning();
    console.log("Reset booking ZL260920001 to status PROCESSING:", booking.id);
  }

  // 5. Ensure fulfillment task exists and is in REQUESTED / ACCEPTED state awaiting Operations verification
  let [task] = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.bookingId, booking.id)).limit(1);
  if (!task) {
    [task] = await db.insert(bookingServicesTable).values({
      bookingId: booking.id,
      assignedVendorId: vendor.id,
      serviceType: "hotel",
      title: "Royal Heritage Haveli - Deluxe Suite",
      status: "REQUESTED",
      customerFacingVerified: false,
      deadline: new Date(Date.now() + 4 * 3600 * 1000),
    }).returning();
    console.log("Created task:", task.id, task.status);
  } else {
    [task] = await db.update(bookingServicesTable).set({
      assignedVendorId: vendor.id,
      status: "REQUESTED",
      customerFacingVerified: false,
      confirmationRef: null,
      voucherUrl: null,
      verifiedBy: null,
      verifiedAt: null,
    }).where(eq(bookingServicesTable.id, task.id)).returning();
    console.log("Reset task to REQUESTED / unverified:", task.id);
  }

  console.log("Setup complete! Customer email: customer@zelevos.com / CustomerPass123!, Booking: ZL260920001");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
