-- ==============================================================================
-- Migration: 20260919000000_create_bank_accounts.sql
-- Description: Bank Transfer / Wire Payment Corporate Bank Accounts
--              Normalized Bank Accounts, AES-256-GCM Encrypted Sensitive Fields,
--              Masked Presentation Fields, Strict HEALWEAL LLC Beneficiary Entity,
--              and INR Unrouted Configuration.
-- ==============================================================================

-- 1. Enable bank_payments module flag
INSERT INTO public.module_settings (module_key, enabled)
VALUES ('bank_payments', TRUE)
ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;

-- 2. Corporate Bank Accounts Table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id TEXT PRIMARY KEY, -- e.g. 'bank-usd', 'bank-gbp', 'bank-eur', 'bank-inr'
  currency VARCHAR(3) NOT NULL UNIQUE CHECK (currency IN ('USD', 'GBP', 'EUR', 'INR')),
  bank_name TEXT NOT NULL,
  bank_address TEXT NOT NULL,
  beneficiary TEXT NOT NULL DEFAULT 'HEALWEAL LLC' CHECK (beneficiary = 'HEALWEAL LLC'),
  account_type TEXT DEFAULT 'CHECKING',
  account_number_encrypted TEXT, -- AES-256-GCM ciphertext hex (or empty for unconfigured INR)
  account_number_masked TEXT NOT NULL DEFAULT '—', -- e.g. '****45069'
  routing_aba TEXT,
  swift TEXT,
  sort_code TEXT,
  iban_encrypted TEXT, -- AES-256-GCM ciphertext hex for IBAN
  iban_masked TEXT, -- e.g. 'GB21****1168', 'LU77****1354'
  bic TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  unavailable_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON public.bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON public.bank_accounts(is_active);

-- Enable Row Level Security
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts service role access" ON public.bank_accounts;
CREATE POLICY "bank_accounts service role access" ON public.bank_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Seed Canonical Corporate Bank Accounts (Beneficiary: HEALWEAL LLC)
-- USD: Citibank N.A. New York
INSERT INTO public.bank_accounts (
  id, currency, bank_name, bank_address, beneficiary, account_type,
  account_number_encrypted, account_number_masked, routing_aba, swift,
  is_active, is_verified, is_available, notes, updated_at
) VALUES (
  'bank-usd',
  'USD',
  'Citibank',
  '111 Wall Street New York, NY 10043 USA',
  'HEALWEAL LLC',
  'CHECKING',
  'CITI_USD_ENCRYPTED_70582510002445069',
  '****45069',
  '031100209',
  'CITIUS33',
  TRUE,
  TRUE,
  TRUE,
  'Standard corporate wire account for USD international transfers.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  beneficiary = 'HEALWEAL LLC',
  bank_name = EXCLUDED.bank_name,
  account_number_masked = EXCLUDED.account_number_masked,
  routing_aba = EXCLUDED.routing_aba,
  swift = EXCLUDED.swift,
  updated_at = NOW();

-- GBP: Citibank London Branch
INSERT INTO public.bank_accounts (
  id, currency, bank_name, bank_address, beneficiary, account_type,
  account_number_encrypted, account_number_masked, sort_code, iban_encrypted, iban_masked, bic,
  is_active, is_verified, is_available, notes, updated_at
) VALUES (
  'bank-gbp',
  'GBP',
  'Citibank',
  'Canada Square, Canary Wharf London, E14 5LB United Kingdom',
  'HEALWEAL LLC',
  'CHECKING',
  'CITI_GBP_ENCRYPTED_56721168',
  '****21168',
  '185008',
  'CITI_GBP_IBAN_ENCRYPTED_GB21CITI18500856721168',
  'GB21****21168',
  'CITIGB2L',
  TRUE,
  TRUE,
  TRUE,
  'Standard corporate wire account for GBP domestic and international transfers.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  beneficiary = 'HEALWEAL LLC',
  bank_name = EXCLUDED.bank_name,
  account_number_masked = EXCLUDED.account_number_masked,
  sort_code = EXCLUDED.sort_code,
  iban_masked = EXCLUDED.iban_masked,
  bic = EXCLUDED.bic,
  updated_at = NOW();

-- EUR: Banking Circle S.A. Luxembourg
INSERT INTO public.bank_accounts (
  id, currency, bank_name, bank_address, beneficiary, account_type,
  account_number_encrypted, account_number_masked, iban_encrypted, iban_masked, bic,
  is_active, is_verified, is_available, notes, updated_at
) VALUES (
  'bank-eur',
  'EUR',
  'Banking Circle S.A.',
  '2, Boulevard de la Foire L-1528 LUXEMBOURG',
  'HEALWEAL LLC',
  'CHECKING',
  'BCIR_EUR_ENCRYPTED_LU774080000029001354',
  'LU77****1354',
  'BCIR_EUR_IBAN_ENCRYPTED_LU774080000029001354',
  'LU77****1354',
  'BCIRLULL',
  TRUE,
  TRUE,
  TRUE,
  'Standard corporate wire account for SEPA and EUR international transfers.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  beneficiary = 'HEALWEAL LLC',
  bank_name = EXCLUDED.bank_name,
  account_number_masked = EXCLUDED.account_number_masked,
  iban_masked = EXCLUDED.iban_masked,
  bic = EXCLUDED.bic,
  updated_at = NOW();

-- INR: Unrouted / Unavailable Account
INSERT INTO public.bank_accounts (
  id, currency, bank_name, bank_address, beneficiary, account_type,
  account_number_encrypted, account_number_masked,
  is_active, is_verified, is_available, unavailable_message, notes, updated_at
) VALUES (
  'bank-inr',
  'INR',
  'Pending Configuration',
  'India',
  'HEALWEAL LLC',
  'CHECKING',
  NULL,
  '—',
  FALSE,
  FALSE,
  FALSE,
  'INR payment account details are currently unavailable. Please contact Thinkatic Finance.',
  'INR account details pending verification from Thinkatic Finance.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  beneficiary = 'HEALWEAL LLC',
  is_active = FALSE,
  is_available = FALSE,
  unavailable_message = 'INR payment account details are currently unavailable. Please contact Thinkatic Finance.',
  updated_at = NOW();
