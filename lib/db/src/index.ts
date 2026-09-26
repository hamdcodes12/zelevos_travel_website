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

if (process.env.NODE_ENV === "production" && !hasExternalPostgres) {
  throw new Error("Production database configuration is missing or invalid. Set DATABASE_URL to the approved production PostgreSQL connection string.");
}

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
    role TEXT NOT NULL DEFAULT 'customer',
    auth_provider TEXT NOT NULL DEFAULT 'email',
    provider_account_id TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active',
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT FALSE,
    vendor_id UUID,
    partner_id UUID,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_account_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_id UUID;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id UUID;
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
    role TEXT NOT NULL DEFAULT 'admin',
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

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

  CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    preferences JSONB NOT NULL DEFAULT '{}',
    passport_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    service_categories JSONB NOT NULL DEFAULT '[]',
    operating_locations JSONB NOT NULL DEFAULT '[]',
    kyc_status TEXT NOT NULL DEFAULT 'pending',
    approval_status TEXT NOT NULL DEFAULT 'pending',
    net_rate_terms TEXT,
    blackout_dates JSONB NOT NULL DEFAULT '[]',
    acceptance_rate NUMERIC NOT NULL DEFAULT 100,
    avg_response_minutes NUMERIC NOT NULL DEFAULT 30,
    cancellation_rate NUMERIC NOT NULL DEFAULT 0,
    customer_issues_count INTEGER NOT NULL DEFAULT 0,
    total_bookings_completed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registration_number TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING_APPROVAL';
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS temporary_password TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS suspension_type TEXT DEFAULT 'NONE';
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS suspension_until TIMESTAMPTZ;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS misbehavior_strikes INTEGER DEFAULT 0;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS disciplinary_notes TEXT;

  CREATE TABLE IF NOT EXISTS vendor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type TEXT DEFAULT 'application/pdf',
    status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vendor_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    rate INTEGER NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL DEFAULT 1,
    availability TEXT NOT NULL DEFAULT 'Available',
    description TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vendor_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    booking_id UUID,
    booking_service_id UUID,
    invoice_number TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'submitted',
    document_url TEXT,
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agency_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    commission_rate_percent NUMERIC NOT NULL DEFAULT 5.0,
    status TEXT NOT NULL DEFAULT 'pending',
    bank_details JSONB NOT NULL DEFAULT '{}',
    total_bookings_count INTEGER NOT NULL DEFAULT 0,
    total_commission_earned INTEGER NOT NULL DEFAULT 0,
    total_commission_paid INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL,
    booking_amount INTEGER NOT NULL,
    commission_percent NUMERIC NOT NULL,
    commission_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'India',
    state TEXT NOT NULL,
    city TEXT,
    overview TEXT NOT NULL,
    best_travel_period TEXT NOT NULL,
    hero_image TEXT NOT NULL,
    gallery JSONB NOT NULL DEFAULT '[]',
    highlights JSONB NOT NULL DEFAULT '[]',
    faqs JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    locations JSONB NOT NULL DEFAULT '[]',
    duration_days INTEGER NOT NULL,
    duration_nights INTEGER NOT NULL,
    theme TEXT NOT NULL,
    traveller_suitability TEXT DEFAULT 'Suitable for families, couples and small groups',
    base_cost INTEGER NOT NULL,
    selling_price INTEGER NOT NULL,
    markup_type TEXT NOT NULL DEFAULT 'fixed',
    markup_value NUMERIC NOT NULL DEFAULT 0,
    service_fee INTEGER NOT NULL DEFAULT 0,
    inventory INTEGER NOT NULL DEFAULT 10,
    inclusions JSONB NOT NULL DEFAULT '[]',
    exclusions JSONB NOT NULL DEFAULT '[]',
    policies JSONB NOT NULL DEFAULT '{}',
    media JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    assigned_vendor_ids JSONB NOT NULL DEFAULT '[]',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_members_only BOOLEAN NOT NULL DEFAULT FALSE,
    offer_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_members_only BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE packages ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS package_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timings TEXT,
    activities_description TEXT,
    meals_included TEXT DEFAULT 'Breakfast',
    hotel_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    base_cost INTEGER NOT NULL DEFAULT 0,
    selling_price INTEGER NOT NULL DEFAULT 0,
    vendor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    star_rating NUMERIC NOT NULL DEFAULT 4.0,
    room_type TEXT NOT NULL DEFAULT 'Deluxe Room',
    meal_plan TEXT NOT NULL DEFAULT 'CP (Breakfast Included)',
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    checkin_time TEXT DEFAULT '14:00',
    checkout_time TEXT DEFAULT '11:00',
    amenities JSONB NOT NULL DEFAULT '[]',
    base_cost_per_night INTEGER NOT NULL DEFAULT 0,
    selling_price_per_night INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    transfer_type TEXT NOT NULL DEFAULT 'private',
    vehicle_type TEXT NOT NULL DEFAULT 'Sedan',
    pickup_location TEXT NOT NULL,
    drop_location TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    luggage_capacity TEXT DEFAULT '2 Large Bags',
    inclusions JSONB NOT NULL DEFAULT '[]',
    base_cost INTEGER NOT NULL DEFAULT 0,
    selling_price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_hours NUMERIC NOT NULL DEFAULT 2.0,
    difficulty_level TEXT DEFAULT 'Easy',
    age_suitability TEXT DEFAULT 'All ages',
    meeting_point TEXT NOT NULL,
    inclusions JSONB NOT NULL DEFAULT '[]',
    exclusions JSONB NOT NULL DEFAULT '[]',
    schedule_notes TEXT,
    base_cost INTEGER NOT NULL DEFAULT 0,
    selling_price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT UNIQUE,
    customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    partner_id UUID,
    status TEXT NOT NULL DEFAULT 'PAYMENT_PENDING',
    travel_date TEXT NOT NULL DEFAULT '',
    adults_count INTEGER NOT NULL DEFAULT 1,
    children_count INTEGER NOT NULL DEFAULT 0,
    infants_count INTEGER NOT NULL DEFAULT 0,
    rooms_count INTEGER NOT NULL DEFAULT 1,
    room_configuration JSONB NOT NULL DEFAULT '[]',
    selected_addons JSONB NOT NULL DEFAULT '[]',
    special_requests TEXT,
    flight_required BOOLEAN NOT NULL DEFAULT FALSE,
    flight_requirement_details JSONB,
    flight_pnr TEXT,
    flight_ticket_url TEXT,
    flight_status TEXT NOT NULL DEFAULT 'NONE',
    total_price INTEGER NOT NULL DEFAULT 0,
    total_base_cost INTEGER NOT NULL DEFAULT 0,
    total_markup INTEGER NOT NULL DEFAULT 0,
    service_fee INTEGER NOT NULL DEFAULT 0,
    actual_supplier_cost INTEGER,
    actual_gross_margin INTEGER,
    payment_id TEXT,
    payment_order_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    timeline JSONB NOT NULL DEFAULT '[]',
    cancellation_reason TEXT,
    cancellation_requested_at TIMESTAMPTZ,
    refund_amount INTEGER,
    itinerary_url TEXT,
    customer_contact JSONB,
    -- legacy fields preserved for backwards compatibility
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'PACKAGE',
    provider_mode TEXT NOT NULL DEFAULT 'DEMO',
    provider_reference TEXT DEFAULT '',
    booking_reference TEXT DEFAULT '',
    pnr TEXT,
    ticket_number TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_id TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id UUID;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_id UUID;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS partner_id UUID;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_date TEXT DEFAULT '';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adults_count INTEGER DEFAULT 1;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS infants_count INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rooms_count INTEGER DEFAULT 1;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_configuration JSONB DEFAULT '[]';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS special_requests TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_required BOOLEAN DEFAULT FALSE;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_requirement_details JSONB;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_pnr TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_ticket_url TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_status TEXT DEFAULT 'NONE';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_base_cost INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_markup INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_fee INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_supplier_cost INTEGER;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_gross_margin INTEGER;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_contact JSONB;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS itinerary_url TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_id UUID;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'PACKAGE';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_mode TEXT DEFAULT 'DEMO';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_reference TEXT DEFAULT '';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference TEXT DEFAULT '';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pnr TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_number TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offer_id TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_offer_id TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'PENDING';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_email TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_error TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passengers JSONB DEFAULT '[]';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact JSONB DEFAULT '{}';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fare_snapshot JSONB DEFAULT '{}';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS segments JSONB DEFAULT '[]';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '{}';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_details JSONB;

  CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_id_idx ON bookings(booking_id);

  CREATE TABLE IF NOT EXISTS booking_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    title TEXT NOT NULL,
    service_id UUID,
    hotel_id UUID,
    transfer_id UUID,
    activity_id UUID,
    assigned_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    assigned_owner TEXT DEFAULT 'Operations Team',
    status TEXT NOT NULL DEFAULT 'PENDING',
    deadline TIMESTAMPTZ,
    supplier_net_cost INTEGER NOT NULL DEFAULT 0,
    retail_price INTEGER NOT NULL DEFAULT 0,
    supplier_confirmation_ref TEXT,
    voucher_url TEXT,
    invoice_url TEXT,
    customer_facing_verified BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    rejection_reason TEXT,
    requested_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS travellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    is_lead BOOLEAN NOT NULL DEFAULT FALSE,
    contact_phone TEXT,
    contact_email TEXT,
    passport_number TEXT,
    special_requests TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    booking_service_id UUID REFERENCES booking_services(id) ON DELETE CASCADE,
    voucher_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    service_type TEXT NOT NULL,
    vendor_name TEXT,
    document_url TEXT,
    valid_from TEXT,
    valid_until TEXT,
    status TEXT NOT NULL DEFAULT 'ISSUED',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'razorpay',
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'INITIATED',
    verification_status TEXT NOT NULL DEFAULT 'PENDING',
    receipt_number TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'PENDING';
  CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_idx ON payments(provider, razorpay_order_id);
  CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_idx ON payments(provider, razorpay_payment_id);

  CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    approved_by_admin_id UUID,
    approved_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    gateway_refund_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'OPEN',
    assigned_to TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS custom_trip_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_number TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    destinations JSONB NOT NULL DEFAULT '[]',
    dates_flexible BOOLEAN NOT NULL DEFAULT FALSE,
    start_date TEXT,
    end_date TEXT,
    duration_days INTEGER,
    travellers_count INTEGER NOT NULL DEFAULT 2,
    budget_per_person INTEGER,
    total_budget INTEGER,
    hotel_preference TEXT DEFAULT '4 Star / Boutique',
    transport_preference TEXT DEFAULT 'Private Cab',
    activities_interests JSONB NOT NULL DEFAULT '[]',
    special_requests TEXT,
    proposal_package_id UUID,
    proposal_title TEXT,
    proposal_amount INTEGER,
    proposal_payment_link TEXT,
    proposal_itinerary JSONB NOT NULL DEFAULT '[]',
    proposal_notes TEXT,
    customer_accepted_at TIMESTAMPTZ,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    assigned_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE custom_trip_requests ADD COLUMN IF NOT EXISTS proposal_itinerary JSONB NOT NULL DEFAULT '[]';
  ALTER TABLE custom_trip_requests ADD COLUMN IF NOT EXISTS proposal_notes TEXT;
  ALTER TABLE custom_trip_requests ADD COLUMN IF NOT EXISTS customer_accepted_at TIMESTAMPTZ;
  ALTER TABLE custom_trip_requests ADD COLUMN IF NOT EXISTS booking_id UUID;

  CREATE TABLE IF NOT EXISTS sla_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    operating_hours_only BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

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

  CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_user_idempotency_idx ON payment_transactions(user_id, idempotency_key);
  CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_order_idx ON payment_transactions(provider, provider_order_id);
  CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_webhook_event_idx ON payment_transactions(webhook_event_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_email TEXT,
    type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    status TEXT NOT NULL DEFAULT 'SENT',
    booking_id UUID,
    broadcast_id UUID,
    image_url TEXT,
    action_button TEXT,
    action_url TEXT,
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_email TEXT;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'SENT';
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS booking_id UUID;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'ANNOUNCEMENT';
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS broadcast_id UUID;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_button TEXT;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
    image_url TEXT,
    action_button TEXT,
    action_url TEXT,
    target_audience TEXT NOT NULL DEFAULT 'ALL_CUSTOMERS',
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'SENT',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    read_count INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'DELIVERED',
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS broadcasts_status_idx ON broadcasts(status);
  CREATE INDEX IF NOT EXISTS broadcasts_created_at_idx ON broadcasts(created_at);
  CREATE INDEX IF NOT EXISTS broadcast_recipients_broadcast_id_idx ON broadcast_recipients(broadcast_id);
  CREATE INDEX IF NOT EXISTS broadcast_recipients_user_id_idx ON broadcast_recipients(user_id);
  CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS notifications_category_idx ON notifications(category);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_name TEXT,
    actor_role TEXT NOT NULL DEFAULT 'customer',
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    previous_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT 'customer';
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_value JSONB;
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

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
    display_name TEXT NOT NULL DEFAULT 'Zelevos traveller',
    home_city TEXT NOT NULL DEFAULT 'Pune',
    avatar_initials TEXT NOT NULL DEFAULT 'ZT',
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

  -- Backfill existing users missing or non-standard customer_id to ZLV-CUS-XXXXXX
  DO $$
  DECLARE
    r RECORD;
    counter INT := 1;
  BEGIN
    FOR r IN SELECT id FROM users WHERE customer_id IS NULL OR customer_id NOT LIKE 'ZLV-CUS-%' ORDER BY created_at ASC LOOP
      WHILE EXISTS (SELECT 1 FROM users WHERE customer_id = 'ZLV-CUS-' || LPAD(counter::text, 6, '0')) LOOP
        counter := counter + 1;
      END LOOP;
      UPDATE users SET customer_id = 'ZLV-CUS-' || LPAD(counter::text, 6, '0') WHERE id = r.id;
      counter := counter + 1;
    END LOOP;
  END $$;
`;

async function seedPlatformDefaults(execSql: (sql: string, params?: any[]) => Promise<any>) {
  // 1. Seed Admin User
  const configuredAdminId = process.env.ADMIN_ID?.trim() || "zelevos-travelai00";
  const rawAdminPassword = process.env.ADMIN_PASSWORD?.trim() || "ZT002121";
  const adminId = configuredAdminId.toLowerCase();

  const existingAdmin = await execSql(
    "SELECT id FROM admin_users WHERE lower(admin_id) = $1 LIMIT 1",
    [adminId]
  );
  const adminRows = existingAdmin?.rows || existingAdmin || [];
  if (adminRows.length === 0) {
    const hashed = hashSeedPassword(rawAdminPassword);
    await execSql(
      "INSERT INTO admin_users (admin_id, password_hash, role) VALUES ($1, $2, 'admin')",
      [adminId, hashed]
    );
  }

  // 2. Seed Default SLAs (Section 22)
  const defaultSlas = [
    { key: "booking_acknowledgement", name: "Booking Acknowledgement", mins: 0, desc: "Immediate/automated acknowledgement" },
    { key: "initial_supplier_request", name: "Initial Supplier Request", mins: 15, desc: "Sent within 15 minutes during operating hours" },
    { key: "standard_supplier_response", name: "Standard Supplier Response", mins: 120, desc: "Supplier must respond within 2 hours" },
    { key: "final_confirmation", name: "Final Trip Confirmation", mins: 1440, desc: "Issued within 24 hours of payment" },
    { key: "support_first_response", name: "Support First Response", mins: 15, desc: "Customer support response within 15 minutes" },
  ];

  for (const sla of defaultSlas) {
    const existing = await execSql("SELECT id FROM sla_settings WHERE setting_key = $1 LIMIT 1", [sla.key]);
    const rows = existing?.rows || existing || [];
    if (rows.length === 0) {
      await execSql(
        "INSERT INTO sla_settings (setting_key, display_name, duration_minutes, description) VALUES ($1, $2, $3, $4)",
        [sla.key, sla.name, sla.mins, sla.desc]
      );
    }
  }

  // 3. Seed Vendors with Performance Metrics (Section 9)
  const sampleVendors = [
    { id: "VND-HIMALAYAN", name: "Himalayan Stays & Luxury Resorts", contact: "Tariq Ahmad", email: "vendor.himalayan@zelevos.partner", phone: "+91 98765 43210", cats: '["hotel"]', locs: '["Kashmir"]', acc: 98, resp: 25, canc: 1 },
    { id: "VND-VALLEYCABS", name: "Valley Fleet & Transfers", contact: "Farooq Dar", email: "vendor.valleycabs@zelevos.partner", phone: "+91 98765 43211", cats: '["transfer"]', locs: '["Kashmir"]', acc: 95, resp: 35, canc: 2 },
    { id: "VND-SHIKARA", name: "Dal Lake Heritage Guild", contact: "Bilal Lone", email: "vendor.shikara@zelevos.partner", phone: "+91 98765 43212", cats: '["activity"]', locs: '["Kashmir"]', acc: 99, resp: 15, canc: 0 },
    { id: "VND-LADAKHEXP", name: "High Passes Expedition Co.", contact: "Tenzin Norbu", email: "vendor.ladakh@zelevos.partner", phone: "+91 98765 43213", cats: '["hotel","activity","transfer"]', locs: '["Ladakh"]', acc: 92, resp: 45, canc: 3 },
    { id: "VND-RAJASTHAN", name: "Royal Rajputana Tours & Desert Safaris", contact: "Rathore Singh", email: "vendor.rajasthan@zelevos.partner", phone: "+91 98765 43214", cats: '["hotel","activity","transfer"]', locs: '["Rajasthan"]', acc: 96, resp: 35, canc: 1 },
  ];

  for (const v of sampleVendors) {
    const existing = await execSql("SELECT id FROM vendors WHERE vendor_id = $1 LIMIT 1", [v.id]);
    const rows = existing?.rows || existing || [];
    if (rows.length === 0) {
      await execSql(
        `INSERT INTO vendors (vendor_id, business_name, contact_name, email, phone, service_categories, operating_locations, approval_status, kyc_status, acceptance_rate, avg_response_minutes, cancellation_rate)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'approved', 'verified', $8, $9, $10)`,
        [v.id, v.name, v.contact, v.email, v.phone, v.cats, v.locs, v.acc, v.resp, v.canc]
      );
    }
  }

  // 4. Seed Curated Destinations (Section 7.2)
  const sampleDestinations = [
    {
      slug: "kashmir",
      name: "Kashmir",
      state: "Jammu & Kashmir",
      city: "Srinagar",
      overview: "Experience alpine meadows, shikara rides on tranquil Dal Lake, snow-clad peaks of Gulmarg, and pine-scented valleys of Pahalgam.",
      bestTravelPeriod: "April to October (Spring/Autumn) & Dec to Feb (Snow)",
      heroImage: "/kashmir-dawn.jpg",
      gallery: '["/kashmir-dawn.jpg", "/ladakh-road.jpg"]',
      highlights: '["Private Shikara ride at sunrise", "Gondola ride to Apharwat peak", "Aru Valley pine trail walk", "Authentic Wazwan dinner"]',
      faqs: '[{"question": "Is Kashmir safe for families?", "answer": "Yes, our curated Kashmir routes have 24/7 dedicated local ground support and private chauffeur transfers."}, {"question": "What is the best time for snow in Gulmarg?", "answer": "Mid-December through early March offers prime skiing and pristine snow coverage."}]'
    },
    {
      slug: "ladakh",
      name: "Ladakh",
      state: "Ladakh",
      city: "Leh",
      overview: "Traverse high mountain passes, emerald lakes at 14,000 feet, and ancient monasteries perched on jagged Himalayan cliffs.",
      bestTravelPeriod: "May to September",
      heroImage: "/ladakh-road.jpg",
      gallery: '["/ladakh-road.jpg", "/kashmir-dawn.jpg"]',
      highlights: '["Pangong Tso camping", "Khardung La pass at 17,582 ft", "Nubra Valley double-humped camel safari", "Hemis Monastery sunrise chanting"]',
      faqs: '[{"question": "How do we acclimatize?", "answer": "All Zelevos Ladakh packages include 48 hours of rest and gradual acclimatization in Leh before ascending higher passes."}]'
    },
    {
      slug: "kerala",
      name: "Kerala",
      state: "Kerala",
      city: "Kochi",
      overview: "Serene backwaters, emerald tea gardens of Munnar, ayurvedic wellness retreats, and coastal spice ports.",
      bestTravelPeriod: "September to March",
      heroImage: "/kashmir-dawn.jpg",
      gallery: '["/kashmir-dawn.jpg"]',
      highlights: '["Private houseboat overnight in Alleppey", "Munnar tea plantation trail", "Periyar wildlife bamboo rafting"]',
      faqs: '[{"question": "Are private houseboats air-conditioned?", "answer": "Yes, all Zelevos contracted houseboats provide full-time air conditioning and private onboard chefs."}]'
    },
    {
      slug: "rajasthan",
      name: "Rajasthan",
      state: "Rajasthan",
      city: "Jaipur & Jodhpur",
      overview: "Explore royal fortresses, golden desert dunes of Thar, ornate havelis, and vibrant regal heritage.",
      bestTravelPeriod: "October to March",
      heroImage: "/ladakh-road.jpg",
      gallery: '["/ladakh-road.jpg", "/kashmir-dawn.jpg"]',
      highlights: '["Amber Fort heritage walk", "Mehrangarh Fort ramparts sunset", "Sam Sand Dunes camel safari", "Chokhi Dhani cultural evening"]',
      faqs: '[{"question": "What is included in the desert camp?", "answer": "Luxury Swiss tents with attached bathrooms, traditional Rajasthani dinner, bonfire, and folk dance performances."}]'
    }
  ];

  for (const d of sampleDestinations) {
    const existing = await execSql("SELECT id FROM destinations WHERE slug = $1 LIMIT 1", [d.slug]);
    const rows = existing?.rows || existing || [];
    if (rows.length === 0) {
      await execSql(
        `INSERT INTO destinations (slug, name, state, city, overview, best_travel_period, hero_image, gallery, highlights, faqs, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, 'active')`,
        [d.slug, d.name, d.state, d.city, d.overview, d.bestTravelPeriod, d.heroImage, d.gallery, d.highlights, d.faqs]
      );
    }
  }

  // 5. Seed Curated Packages with All Section 8 fields
  const kashmirDest = await execSql("SELECT id FROM destinations WHERE slug = 'kashmir' LIMIT 1");
  const kashmirId = (kashmirDest?.rows || kashmirDest || [])[0]?.id;

  if (kashmirId) {
    const existingPkg = await execSql("SELECT id FROM packages WHERE package_id = 'ZL-KASH-001' LIMIT 1");
    const pkgRows = existingPkg?.rows || existingPkg || [];
    if (pkgRows.length === 0) {
      const pkgInsert = await execSql(
        `INSERT INTO packages (
          package_id, title, slug, destination_id, locations, duration_days, duration_nights,
          theme, base_cost, selling_price, markup_type, markup_value, inventory,
          inclusions, exclusions, media, status, assigned_vendor_ids, featured
        ) VALUES (
          'ZL-KASH-001', 'Kashmir Enchantment: Lakes, Pines & Peaks', 'kashmir-enchantment',
          $1, '["Srinagar", "Gulmarg", "Pahalgam"]'::jsonb, 6, 5,
          'family', 42000, 56000, 'fixed', 14000, 15,
          '["5 Nights Luxury Accommodations", "Daily Breakfast & Dinner", "Private Chauffeur Sedan throughout", "1 Hour Sunrise Shikara Ride on Dal Lake", "Gulmarg Phase 1 Gondola Tickets", "All Tolls, Parking & Driver Allowances"]'::jsonb,
          '["Airfare (available on request)", "Lunch & Personal Expenses", "Phase 2 Gondola Tickets", "Pony rides or camera fees"]'::jsonb,
          '{"heroImage": "/kashmir-dawn.jpg", "gallery": ["/kashmir-dawn.jpg", "/ladakh-road.jpg"]}'::jsonb,
          'active', '["VND-HIMALAYAN", "VND-VALLEYCABS", "VND-SHIKARA"]'::jsonb, TRUE
        ) RETURNING id`,
        [kashmirId]
      );
      const pkgId = (pkgInsert?.rows || pkgInsert || [])[0]?.id;

      if (pkgId) {
        // Insert day-by-day itinerary
        const days = [
          { num: 1, title: "Arrival in Srinagar & Dal Lake Sunset", desc: "Arrive at Srinagar Airport. Meet your private driver and transfer to your luxury lakefront property. Enjoy an evening private shikara ride on Dal Lake." },
          { num: 2, title: "Srinagar Heritage & Mughal Splendour", desc: "Morning visit to Nishat Bagh and Shalimar Bagh. Afternoon old city artisan walk and saffron tea experience." },
          { num: 3, title: "Gulmarg Alpine Meadows & Gondola", desc: "Scenic drive to Gulmarg. Ride the world's highest cable car to Kongdoori. Evening at leisure surrounded by pine forests." },
          { num: 4, title: "Pahalgam Valley of Shepherds", desc: "Drive along saffron fields to Pahalgam. Riverside walk along Lidder river and sunset view over Betaab valley." },
          { num: 5, title: "Aru Valley & River Walks", desc: "Morning excursion to pristine Aru Valley. Traditional Kashmiri Wazwan cooking dinner in the evening." },
          { num: 6, title: "Farewell Kashmir & Airport Drop", desc: "Breakfast with panoramic valley views. Private transfer to Srinagar Airport for your onward journey." },
        ];
        for (const day of days) {
          await execSql(
            `INSERT INTO package_days (package_id, day_number, title, description) VALUES ($1, $2, $3, $4)`,
            [pkgId, day.num, day.title, day.desc]
          );
        }

        // Insert separate Hotel, Transfer, Activity records per Gap 1
        const hotelService = await execSql(
          `INSERT INTO services (package_id, name, service_type, base_cost, selling_price) VALUES ($1, 'Kashmir Luxury Stays (5N)', 'hotel', 25000, 32000) RETURNING id`,
          [pkgId]
        );
        const hotelServiceId = (hotelService?.rows || hotelService || [])[0]?.id;
        if (hotelServiceId) {
          await execSql(
            `INSERT INTO hotels (service_id, package_id, name, star_rating, room_type, meal_plan, address, city, amenities, base_cost_per_night, selling_price_per_night)
             VALUES ($1, $2, 'The Khyber & Lake House Retreat', 4.8, 'Deluxe Mountain View', 'MAP (Breakfast & Dinner)', 'Gulmarg & Nigeen Lake', 'Srinagar & Gulmarg', '["Breakfast","Dinner","Mountain View","Heated Rooms","Wi-Fi"]'::jsonb, 5000, 6400)`,
            [hotelServiceId, pkgId]
          );
        }

        const transferService = await execSql(
          `INSERT INTO services (package_id, name, service_type, base_cost, selling_price) VALUES ($1, 'Private Dedicated Sedan Transfer', 'transfer', 10000, 14000) RETURNING id`,
          [pkgId]
        );
        const transferServiceId = (transferService?.rows || transferService || [])[0]?.id;
        if (transferServiceId) {
          await execSql(
            `INSERT INTO transfers (service_id, package_id, transfer_type, vehicle_type, pickup_location, drop_location, duration_minutes, luggage_capacity, inclusions, base_cost, selling_price)
             VALUES ($1, $2, 'private', 'Toyota Etios / Dzire', 'Srinagar Airport', 'Full Circuit (Srinagar-Gulmarg-Pahalgam)', 360, '3 Large Bags', '["Fuel","Driver Allowance","Tolls","Intercity Transfers"]'::jsonb, 10000, 14000)`,
            [transferServiceId, pkgId]
          );
        }

        const activityService = await execSql(
          `INSERT INTO services (package_id, name, service_type, base_cost, selling_price) VALUES ($1, 'Dal Lake Shikara & Gondola Experience', 'activity', 7000, 10000) RETURNING id`,
          [pkgId]
        );
        const actServiceId = (activityService?.rows || activityService || [])[0]?.id;
        if (actServiceId) {
          await execSql(
            `INSERT INTO activities (service_id, package_id, name, duration_hours, difficulty_level, meeting_point, inclusions, base_cost, selling_price)
             VALUES ($1, $2, 'Sunrise Shikara & Gulmarg Gondola Phase 1', 4.0, 'Easy', 'Ghat 7 & Gulmarg Base', '["1h Shikara Ride","Phase 1 Gondola Tickets","Local Guide"]'::jsonb, 7000, 10000)`,
            [actServiceId, pkgId]
          );
        }
      }
    }
  }

  // Seed ZL-RAJ-002 ("Royal Rajasthan Heritage & Desert Safari") with VND-RAJASTHAN
  const rajDest = await execSql("SELECT id FROM destinations WHERE slug = 'rajasthan' LIMIT 1");
  const rajId = (rajDest?.rows || rajDest || [])[0]?.id;

  if (rajId) {
    const existingRajPkg = await execSql("SELECT id FROM packages WHERE package_id = 'ZL-RAJ-002' LIMIT 1");
    const rajPkgRows = existingRajPkg?.rows || existingRajPkg || [];
    if (rajPkgRows.length === 0) {
      const pkgInsert = await execSql(
        `INSERT INTO packages (
          package_id, title, slug, destination_id, locations, duration_days, duration_nights,
          theme, base_cost, selling_price, markup_type, markup_value, inventory,
          inclusions, exclusions, media, status, assigned_vendor_ids, featured
        ) VALUES (
          'ZL-RAJ-002', 'Royal Rajasthan Heritage & Desert Safari', 'royal-rajasthan-heritage-desert-safari',
          $1, '["Jaipur", "Jodhpur", "Jaisalmer"]'::jsonb, 6, 5,
          'heritage', 45000, 58000, 'fixed', 13000, 10,
          '["5 Nights Heritage Haveli & Luxury Desert Camp", "Daily Royal Breakfast & Dinners", "Private Air-Conditioned SUV throughout", "Thar Desert Sunset Camel Safari", "Amber Fort & Mehrangarh Guided Excursions", "All State Tolls, Fuel & Chauffeur Allowances"]'::jsonb,
          '["Airfare (available on request)", "Lunches & Personal Shopping", "Camera & Monument Entry Fees"]'::jsonb,
          '{"heroImage": "/ladakh-road.jpg", "gallery": ["/ladakh-road.jpg", "/kashmir-dawn.jpg"]}'::jsonb,
          'active', '["VND-RAJASTHAN"]'::jsonb, TRUE
        ) RETURNING id`,
        [rajId]
      );
      const rajPkgId = (pkgInsert?.rows || pkgInsert || [])[0]?.id;

      if (rajPkgId) {
        const rajDays = [
          { num: 1, title: "Arrival in Pink City Jaipur", desc: "Arrive at Jaipur Airport/Station. Private SUV transfer to your heritage haveli hotel. Evening visit to Birla Temple and local bazaars." },
          { num: 2, title: "Amber Fort & Royal City Palace", desc: "Ascend the ramparts of Amber Fort. Afternoon guided tour of City Palace, Jantar Mantar observatory, and photo stop at Hawa Mahal." },
          { num: 3, title: "Sun City Jodhpur & Mehrangarh", desc: "Scenic drive through desert terrain to Jodhpur. Check into royal hotel and explore Mehrangarh Fort towering above the blue city." },
          { num: 4, title: "Golden City Jaisalmer & Sam Sand Dunes", desc: "Drive to Jaisalmer, the Golden City. Check in to luxury desert camp in Sam Sand Dunes. Enjoy sunset camel safari and Rajasthani cultural performance." },
          { num: 5, title: "Jaisalmer Living Fort & Patwon Ki Haveli", desc: "Explore the only living golden sandstone fort in India, Jain Temples, and intricately carved Patwon Ki Haveli." },
          { num: 6, title: "Farewell Rajasthan & Departure", desc: "Lavish royal breakfast. Private SUV transfer to Jodhpur or Jaisalmer Airport for onward journey." },
        ];
        for (const day of rajDays) {
          await execSql(
            `INSERT INTO package_days (package_id, day_number, title, description) VALUES ($1, $2, $3, $4)`,
            [rajPkgId, day.num, day.title, day.desc]
          );
        }

        const hotelService = await execSql(
          `INSERT INTO services (package_id, name, service_type, base_cost, selling_price) VALUES ($1, 'Royal Haveli & Luxury Desert Stays (5N)', 'hotel', 26000, 33000) RETURNING id`,
          [rajPkgId]
        );
        const hotelServiceId = (hotelService?.rows || hotelService || [])[0]?.id;
        if (hotelServiceId) {
          await execSql(
            `INSERT INTO hotels (service_id, package_id, name, star_rating, room_type, meal_plan, address, city, amenities, base_cost_per_night, selling_price_per_night)
             VALUES ($1, $2, 'Alsisar Haveli & Royal Desert Camp', 4.7, 'Heritage Royal Suite', 'MAP (Breakfast & Dinner)', 'Jaipur & Thar Desert', 'Jaipur & Jaisalmer', '["Breakfast","Dinner","Desert Camp","Swimming Pool","Wi-Fi"]'::jsonb, 5200, 6600)`,
            [hotelServiceId, rajPkgId]
          );
        }

        const transferService = await execSql(
          `INSERT INTO services (package_id, name, service_type, base_cost, selling_price) VALUES ($1, 'Dedicated Air-Conditioned SUV Transfer', 'transfer', 12000, 16000) RETURNING id`,
          [rajPkgId]
        );
        const transferServiceId = (transferService?.rows || transferService || [])[0]?.id;
        if (transferServiceId) {
          await execSql(
            `INSERT INTO transfers (service_id, package_id, transfer_type, vehicle_type, pickup_location, drop_location, duration_minutes, luggage_capacity, inclusions, base_cost, selling_price)
             VALUES ($1, $2, 'private', 'Toyota Innova Crysta', 'Jaipur Airport', 'Full Rajasthan Circuit (Jaipur-Jodhpur-Jaisalmer)', 480, '4 Large Bags', '["Fuel","Chauffeur Allowance","State Border Tolls","All Transfers"]'::jsonb, 12000, 16000)`,
            [transferServiceId, rajPkgId]
          );
        }

        const activityService = await execSql(
          `INSERT INTO services (package_id, name, service_type, base_cost, selling_price) VALUES ($1, 'Thar Desert Safari & Fort Excursions', 'activity', 7000, 9000) RETURNING id`,
          [rajPkgId]
        );
        const actServiceId = (activityService?.rows || activityService || [])[0]?.id;
        if (actServiceId) {
          await execSql(
            `INSERT INTO activities (service_id, package_id, name, duration_hours, difficulty_level, meeting_point, inclusions, base_cost, selling_price)
             VALUES ($1, $2, 'Sam Sand Dunes Camel Safari & Fort Guide', 5.0, 'Easy', 'Sam Sand Dunes & Amber Fort', '["Camel Ride","Cultural Dance","Local Guide"]'::jsonb, 7000, 9000)`,
            [actServiceId, rajPkgId]
          );
        }
      }
    }
  }

  // 6. Seed sample partner
  const existingPartner = await execSql("SELECT id FROM partners WHERE partner_id = 'PRT-DEMO-001' LIMIT 1");
  const partnerRows = existingPartner?.rows || existingPartner || [];
  if (partnerRows.length === 0) {
    await execSql(
      `INSERT INTO partners (partner_id, agency_name, contact_name, email, phone, referral_code, commission_rate_percent, status)
       VALUES ('PRT-DEMO-001', 'Voyage Holidays India', 'Rohit Mehra', 'partner.voyage@zelevos.travel', '+91 91234 56789', 'VOYAGE10', 6.0, 'approved')`
    );
  }
}

if (hasExternalPostgres) {
  poolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  poolInstance.on("error", (err: Error) => {
    console.error("Unexpected error on idle postgres pool client:", err.message);
  });
  dbInstance = drizzleNodePg(poolInstance, { schema });
  try {
    await poolInstance.query(DDL_MIGRATIONS);
    await seedPlatformDefaults(async (sql, params) => poolInstance.query(sql, params));
  } catch (err) {
    console.error("Failed to run DDL migrations on external postgres:", err);
    if (process.env.NODE_ENV === "production") {
      throw new Error("Production database connection or schema initialization failed.", { cause: err });
    }
  }
} else {
  // Use embedded PGlite for local development and offline test execution
  const pglite = new PGlite();
  dbInstance = drizzlePglite(pglite, { schema });
  await pglite.exec(DDL_MIGRATIONS);
  await seedPlatformDefaults(async (sql, params) => pglite.query(sql, params));
}

export const pool = poolInstance;
export const db = dbInstance;
export * from "./schema";
