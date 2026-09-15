import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import * as schema from "./schema";

const { Pool } = pg;

const isDummyTestUrl = process.env.DATABASE_URL?.includes("127.0.0.1:5432/test");

const hasExternalPostgres =
  Boolean(process.env.DATABASE_URL) &&
  !isDummyTestUrl &&
  !process.env.DATABASE_URL?.startsWith("memory://") &&
  !process.env.DATABASE_URL?.startsWith("pglite://");

let poolInstance: any = null;
let dbInstance: any = null;

function hashSeedPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const DDL_MIGRATIONS = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    phone TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    provider_account_id TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_account_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS users_customer_id_idx ON users(customer_id);
  CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
  CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);

  CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS admin_users_admin_id_idx ON admin_users(admin_id);

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS admin_sessions_token_hash_idx ON admin_sessions(token_hash);
  CREATE INDEX IF NOT EXISTS admin_sessions_admin_id_idx ON admin_sessions(admin_id);

  CREATE TABLE IF NOT EXISTS generated_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    destination TEXT NOT NULL,
    dates TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    travellers INTEGER NOT NULL,
    budget TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '[]',
    itinerary JSONB NOT NULL DEFAULT '[]',
    estimated_costs JSONB NOT NULL DEFAULT '{}',
    transport_info JSONB,
    hotel_info JSONB,
    reasoning TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS traveller_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Wayora traveller',
    home_city TEXT NOT NULL DEFAULT 'Pune',
    avatar_initials TEXT NOT NULL DEFAULT 'WT',
    budget_style TEXT NOT NULL DEFAULT 'Value-conscious',
    hotel_style TEXT NOT NULL DEFAULT 'Boutique stays',
    travel_style TEXT NOT NULL DEFAULT 'Slow and curious',
    food_preferences JSONB NOT NULL DEFAULT '[]',
    activity_preferences JSONB NOT NULL DEFAULT '[]',
    saved_destinations JSONB NOT NULL DEFAULT '[]',
    crowd_tolerance TEXT NOT NULL DEFAULT 'Prefer quieter places',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SEARCHED',
    provider_mode TEXT NOT NULL DEFAULT 'DEMO',
    provider_reference TEXT NOT NULL,
    booking_reference TEXT NOT NULL,
    pnr TEXT,
    ticket_number TEXT,
    flight_offer_id TEXT,
    amount INTEGER NOT NULL,
    fare_snapshot JSONB,
    passengers JSONB,
    contact JSONB,
    segments JSONB,
    addons JSONB,
    payment_id TEXT,
    payment_order_id TEXT,
    payment_status TEXT,
    idempotency_key TEXT,
    cancellation_details JSONB,
    refund_amount INTEGER,
    email_status TEXT NOT NULL DEFAULT 'NOT_SENT',
    email_sent_at TIMESTAMPTZ,
    email_error TEXT,
    client_email TEXT,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'NOT_SENT';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_error TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_email TEXT;

  CREATE INDEX IF NOT EXISTS bookings_owner_id_idx ON bookings(owner_id);
  CREATE INDEX IF NOT EXISTS bookings_pnr_idx ON bookings(pnr);
  CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings(created_at);

  CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    provider_order_id TEXT,
    provider_payment_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    requested_amount INTEGER NOT NULL,
    captured_amount INTEGER,
    status TEXT NOT NULL DEFAULT 'CREATED',
    refund_status TEXT NOT NULL DEFAULT 'NONE',
    refund_amount INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    webhook_event_id TEXT,
    webhook_event_type TEXT,
    idempotency_key TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    ip_address TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Backfill existing users missing customer_id
  UPDATE users
  SET customer_id = 'CUST-' || upper(substr(md5(random()::text || id::text), 1, 8))
  WHERE customer_id IS NULL;
`;

async function seedAdminUser(execSql: (sql: string, params?: any[]) => Promise<any>) {
  const configuredAdminId = process.env.ADMIN_ID?.trim();
  const rawAdminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!configuredAdminId || !rawAdminPassword) return;
  const adminId = configuredAdminId.toLowerCase();

  const existing = await execSql(
    "SELECT id FROM admin_users WHERE lower(admin_id) = $1 LIMIT 1",
    [adminId]
  );

  const rows = existing?.rows || existing || [];
  if (rows.length === 0) {
    const hashed = hashSeedPassword(rawAdminPassword);
    await execSql(
      "INSERT INTO admin_users (admin_id, password_hash) VALUES ($1, $2)",
      [adminId, hashed]
    );
  }
}

if (hasExternalPostgres) {
  poolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  dbInstance = drizzleNodePg(poolInstance, { schema });
  try {
    await poolInstance.query(DDL_MIGRATIONS);
    await seedAdminUser(async (sql, params) => poolInstance.query(sql, params));
  } catch (err) {
    console.error("Failed to run DDL migrations on external postgres:", err);
  }
} else {
  // Use embedded PGlite for local development and offline test execution
  const pglite = new PGlite();
  dbInstance = drizzlePglite(pglite, { schema });
  await pglite.exec(DDL_MIGRATIONS);
  await seedAdminUser(async (sql, params) => pglite.query(sql, params));
}

export const pool = poolInstance;
export const db = dbInstance;
export * from "./schema";

