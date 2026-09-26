import { db, adminUsersTable, type AdminUser } from "@workspace/db";
import { hashPassword } from "../lib/auth.js";
import { sql } from "drizzle-orm";

async function main() {
  const users: AdminUser[] = await db.select().from(adminUsersTable);
  console.log("Current admin users in DB:", users.map((u: AdminUser) => ({ id: u.id, adminId: u.adminId, role: u.role, totpEnabled: u.totpEnabled })));

  // Ensure 'admin' with 'admin123' exists
  const existingAdmin = users.find((u: AdminUser) => u.adminId.toLowerCase() === "admin");
  if (!existingAdmin) {
    const [created] = await db.insert(adminUsersTable).values({
      adminId: "admin",
      passwordHash: hashPassword("admin123"),
      role: "admin",
    }).returning();
    console.log("SUCCESS: Created admin user 'admin' with password 'admin123' (id: " + created.id + ")");
  } else {
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword("admin123"),
      totpEnabled: false,
      totpSecret: null,
    }).where(sql`lower(admin_id) = 'admin'`);
    console.log("SUCCESS: Reset password for 'admin' to 'admin123'");
  }

  // Also ensure 'zelevos-travelai00' with 'ZT002121' exists
  const existingZelevos = users.find((u: AdminUser) => u.adminId.toLowerCase() === "zelevos-travelai00");
  if (!existingZelevos) {
    const [created] = await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("ZT002121"),
      role: "admin",
    }).returning();
    console.log("SUCCESS: Created admin user 'zelevos-travelai00' with password 'ZT002121' (id: " + created.id + ")");
  } else {
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword("ZT002121"),
      totpEnabled: false,
      totpSecret: null,
    }).where(sql`lower(admin_id) = 'zelevos-travelai00'`);
    console.log("SUCCESS: Reset password for 'zelevos-travelai00' to 'ZT002121'");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error seeding admin:", err);
  process.exit(1);
});