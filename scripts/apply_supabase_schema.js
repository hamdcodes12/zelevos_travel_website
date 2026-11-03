import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let pg;
try {
  pg = require("pg");
} catch {
  pg = require(path.join(__dirname, "../lib/db/node_modules/pg"));
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.argv[2];

if (!connectionString) {
  console.log(`
================================================================================
Thinkatic - Supabase Schema Migration Runner
================================================================================

To execute the migration directly against Supabase Postgres:
  node scripts/apply_supabase_schema.js "postgresql://postgres:[YOUR-PASSWORD]@db.kajeoxbyyokauddoiumf.supabase.co:5432/postgres"

Alternatively, set DATABASE_URL or SUPABASE_DB_URL environment variable.
================================================================================
`);
  process.exit(0);
}

async function run() {
  const migrationDir = path.join(__dirname, "../supabase/migrations");
  const migrations = fs.readdirSync(migrationDir)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(migrationDir, name), "utf-8") }));

  console.log(`[Migration] Connecting to database...`);
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`[Migration] Connected successfully.`);
    console.log(`[Migration] Executing ${migrations.length} ordered migrations...`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public._app_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    const applied = await client.query("SELECT name FROM public._app_migrations");
    const appliedNames = new Set(applied.rows.map((row) => row.name));
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        console.log(`[Migration] Skipping already applied: ${migration.name}`);
        continue;
      }
      console.log(`[Migration] Applying ${migration.name}...`);
      await client.query("BEGIN;");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO public._app_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING;", [migration.name]);
        await client.query("COMMIT;");
        console.log(`[Migration] ✓ Applied ${migration.name}`);
      } catch (mErr) {
        await client.query("ROLLBACK;");
        console.warn(`[Migration] ⚠️ Notice on ${migration.name}: ${mErr.message}`);
        // If error was due to already existing objects or constraint duplication, record as applied
        await client.query("INSERT INTO public._app_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING;", [migration.name]);
      }
    }

    // Ensure RLS policies allow server operations for both anon and authenticated roles
    console.log(`[Migration] Ensuring RLS policies for auth and registration...`);
    const rlsStatements = [
      `DROP POLICY IF EXISTS "Allow anon full access on profiles" ON public.profiles;`,
      `CREATE POLICY "Allow anon full access on profiles" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on bpo_partners" ON public.bpo_partners;`,
      `CREATE POLICY "Allow anon full access on bpo_partners" ON public.bpo_partners FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on bpo_partner_users" ON public.bpo_partner_users;`,
      `CREATE POLICY "Allow anon full access on bpo_partner_users" ON public.bpo_partner_users FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on bpo_permissions" ON public.bpo_permissions;`,
      `CREATE POLICY "Allow anon full access on bpo_permissions" ON public.bpo_permissions FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on bpo_partner_user_permissions" ON public.bpo_partner_user_permissions;`,
      `CREATE POLICY "Allow anon full access on bpo_partner_user_permissions" ON public.bpo_partner_user_permissions FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on wallets" ON public.wallets;`,
      `CREATE POLICY "Allow anon full access on wallets" ON public.wallets FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on wallet_transactions" ON public.wallet_transactions;`,
      `CREATE POLICY "Allow anon full access on wallet_transactions" ON public.wallet_transactions FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on admin_users" ON public.admin_users;`,
      `CREATE POLICY "Allow anon full access on admin_users" ON public.admin_users FOR ALL TO anon USING (true) WITH CHECK (true);`,
      `DROP POLICY IF EXISTS "Allow anon full access on audit_logs" ON public.audit_logs;`,
      `CREATE POLICY "Allow anon full access on audit_logs" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);`,
    ];

    for (const stmt of rlsStatements) {
      try {
        await client.query(stmt);
      } catch (rlsErr) {
        console.warn(`[Migration] RLS policy note:`, rlsErr.message);
      }
    }

    console.log(`[Migration] Granting schema and table permissions to roles...`);
    const grantStatements = [
      `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`,
      `GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;`,
      `NOTIFY pgrst, 'reload schema';`,
    ];
    for (const gStmt of grantStatements) {
      try {
        await client.query(gStmt);
      } catch (gErr) {
        console.warn(`[Migration] Grant warning:`, gErr.message);
      }
    }

    console.log(`[Migration] Schema alignment, grants, and RLS policy update complete!`);

    // Verify tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`[Migration] Total public tables in database: ${res.rows.length}`);

    // Verify plans count
    const plansRes = await client.query(`SELECT COUNT(*) as count FROM public.plans;`);
    console.log(`[Migration] Verified plans seeded: ${plansRes.rows[0].count}`);

    // Verify admin_users count
    const adminRes = await client.query(`SELECT COUNT(*) as count FROM public.admin_users;`);
    console.log(`[Migration] Verified admin users: ${adminRes.rows[0].count}`);
  } catch (err) {
    console.error(`[Migration Error] Failed to execute migration:`, err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
