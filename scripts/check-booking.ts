import { db, bookingsTable, bookingServicesTable, usersTable } from "../artifacts/api-server/src/index.js";
import { eq } from "drizzle-orm";

async function check() {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingId, "ZL260920001")).limit(1);
  console.log("=== BOOKING ZL260920001 ===");
  if (!booking) {
    console.log("Not found!");
    return;
  }
  console.log("Status:", booking.status, "ownerId:", booking.ownerId);
  if (booking.ownerId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, booking.ownerId)).limit(1);
    console.log("User:", user?.email, user?.fullName);
  }
  const tasks = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.bookingId, booking.id));
  console.log("=== TASKS (" + tasks.length + ") ===");
  tasks.forEach((t: any) => console.log(t.id, t.serviceType, t.status, t.vendorId));
}

check().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
