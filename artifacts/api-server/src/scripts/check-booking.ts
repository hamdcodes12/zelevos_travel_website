import { db, bookingsTable, bookingServicesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function check() {
  const allBookings = await db.select().from(bookingsTable);
  console.log("=== ALL BOOKINGS (" + allBookings.length + ") ===");
  allBookings.forEach((b: any) => console.log(b.bookingId, b.status, b.ownerId, b.contactEmail));
}

check().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
