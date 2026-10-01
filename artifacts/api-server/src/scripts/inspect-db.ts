import { db, bookingsTable, bookingServicesTable, vendorsTable } from "@workspace/db";

async function main() {
  const bookings = await db.select().from(bookingsTable);
  console.log("Bookings count:", bookings.length);
  bookings.forEach((b: any) => console.log("Booking:", b.id, b.bookingId, b.status));

  const vendors = await db.select().from(vendorsTable);
  console.log("Vendors count:", vendors.length);
  vendors.forEach((v: any) => console.log("Vendor:", v.id, v.vendorId, v.businessName, v.approvalStatus));

  const tasks = await db.select().from(bookingServicesTable);
  console.log("Tasks count:", tasks.length);
  tasks.forEach((t: any) => console.log("Task:", t.id, t.bookingId, t.assignedVendorId, t.status, t.supplierConfirmationRef));
}

main().then(() => process.exit(0)).catch((e: any) => { console.error(e); process.exit(1); });
