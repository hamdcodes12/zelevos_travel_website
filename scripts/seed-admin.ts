import { db, adminUsersTable } from "../lib/db/src/index.js";
import { hashPassword } from "../artifacts/api-server/src/lib/auth.js";
import { sql } from "drizzle-orm";

async function main() {
  const users = await db.select().from(adminUsersTable);
  console.log("Current admin users in DB:", users.map(u => ({ id: u.id, adminId: u.adminId, role: u.role, totpEnabled: u.totpEnabled })));

  // Ensure 'admin' with 'admin123' exists
  const existingAdmin = users.find(u => u.adminId.toLowerCase() === "admin");
  if (!existingAdmin) {
    const [created] = await db.insert(adminUsersTable).values({
      adminId: "admin",
      passwordHash: hashPassword("admin123"),
      role: "admin",
    }).returning();
    console.log("Created admin user 'admin' with password 'admin123':", created.id);
  } else {
    // Reset password to 'admin123' to guarantee it works
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword("admin123"),
      totpEnabled: false,
      totpSecret: null,
    }).where(sql`lower(admin_id) = 'admin'`);
    console.log("Reset password for 'admin' to 'admin123'");
  }

  // Also ensure 'zelevos-travelai00' with 'ZT002121' exists
  const existingZelevos = users.find(u => u.adminId.toLowerCase() === "zelevos-travelai00");
  if (!existingZelevos) {
    const [created] = await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("ZT002121"),
      role: "admin",
    }).returning();
    console.log("Created admin user 'zelevos-travelai00' with password 'ZT002121':", created.id);
  } else {
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword("ZT002121"),
      totpEnabled: false,
      totpSecret: null,
    }).where(sql`lower(admin_id) = 'zelevos-travelai00'`);
    console.log("Reset password for 'zelevos-travelai00' to 'ZT002121'");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error seeding admin:", err);
  process.exit(1);
});
