import { db, bookingServicesTable, vendorsTable, bookingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.vendorId, "VND-HIMALAYAN")).limit(1);
  console.log("Himalayan vendor:", vendor?.id, vendor?.businessName);

  if (!vendor) {
    console.error("Vendor VND-HIMALAYAN not found");
    return;
  }

  // Find or create a booking with a task in REQUESTED state assigned to this vendor
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingId, "ZL260920001")).limit(1);
  if (!booking) {
    console.error("Booking ZL260920001 not found");
    return;
  }

  // Create or update a task for this booking assigned to VND-HIMALAYAN
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
    console.log("Created task:", task.id);
  } else {
    [task] = await db.update(bookingServicesTable).set({
      assignedVendorId: vendor.id,
      status: "REQUESTED",
      customerFacingVerified: false,
      supplierConfirmationRef: null,
      voucherUrl: null,
    }).where(eq(bookingServicesTable.id, task.id)).returning();
    console.log("Assigned task to Himalayan vendor:", task.id);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
