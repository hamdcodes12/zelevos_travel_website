import pg from "../node_modules/.pnpm/pg@8.23.0/node_modules/pg/lib/index.js";
import { randomBytes, scryptSync } from "node:crypto";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const DATABASE_URL = "postgresql://postgres.hvsvqwrrkxjgrxiozjgz:e5nQzAKmnMQHRRoH@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function resetAdmin() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const check = await pool.query("SELECT id, admin_id, role, totp_enabled FROM admin_users");
    console.log("Current admin_users in DB:", check.rows);

    const hash = hashPassword("ZT002121");
    const updated = await pool.query(
      "UPDATE admin_users SET password_hash = $1, totp_enabled = false, totp_secret = NULL WHERE LOWER(admin_id) = 'zelevos-travelai00' RETURNING id, admin_id",
      [hash]
    );
    console.log("Updated zelevos-travelai00 rows:", updated.rowCount);

    // Also ensure 'admin' has 'admin123'
    const adminHash = hashPassword("admin123");
    await pool.query(
      "UPDATE admin_users SET password_hash = $1, totp_enabled = false, totp_secret = NULL WHERE LOWER(admin_id) = 'admin'",
      [adminHash]
    );
    console.log("Successfully ensured admin passwords!");
  } finally {
    await pool.end();
  }
}

resetAdmin().catch(console.error);
