import { db, adminUsersTable, type AdminUser } from "../lib/db/src/index.js";
import { hashPassword } from "../artifacts/api-server/src/lib/auth.js";
import { sql } from "drizzle-orm";

const adminId = (process.env.ADMIN_ID || "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "";

async function main() {
  if (!adminId || adminPassword.length < 12) {
    console.error("Set ADMIN_ID and ADMIN_PASSWORD (at least 12 characters) in the environment before running this script.");
    process.exit(1);
  }

  const users: AdminUser[] = await db.select().from(adminUsersTable);
  const existing = users.find((u: AdminUser) => u.adminId.toLowerCase() === adminId);

  if (!existing) {
    const [created] = await db.insert(adminUsersTable).values({
      adminId,
      passwordHash: hashPassword(adminPassword),
      role: "admin",
    }).returning();
    console.log(`Created admin user '${adminId}' (id: ${created.id}).`);
  } else {
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword(adminPassword),
      totpEnabled: false,
      totpSecret: null,
    }).where(sql`lower(admin_id) = ${adminId}`);
    console.log(`Reset the password of admin user '${adminId}' and disabled its 2FA. Enrol 2FA again after signing in.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding admin:", err instanceof Error ? err.message : err);
  process.exit(1);
});
