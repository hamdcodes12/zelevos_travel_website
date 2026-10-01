-- 202609280001_supplier_dossier_upgrade.sql
-- ZELEVOS — SUPPLIER ONBOARDING + COMPLETE SUPPLIER DOSSIER UPGRADE

-- 1. Vendors table upgrades: website availability, official URL, business type, approval date, change requests, onboarding progress
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS has_website BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'Private Limited';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS change_request_areas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS change_request_message TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;

-- 2. Vendor documents upgrades: document expiry date
ALTER TABLE vendor_documents ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;
