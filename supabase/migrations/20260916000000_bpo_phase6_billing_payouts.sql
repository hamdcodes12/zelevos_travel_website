-- ==============================================================================
-- Migration: 20260916000000_bpo_phase6_billing_payouts.sql
-- Description: Phase 6 - Enterprise Billing, Invoices, Centre Payouts,
--              Financial Adjustments, and Dispute Management Schema
-- ==============================================================================

-- 1. Sequential Number Generators for Standard Formats
-- Produces:
--   Invoice:     THK-INV-00001
--   Payout:      THK-PAY-00001
--   Adjustment:  THK-ADJ-00001
--   Dispute:     THK-DSP-00001

CREATE SEQUENCE IF NOT EXISTS public.thk_invoice_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_thk_invoice_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('public.thk_invoice_code_seq');
    RETURN 'THK-INV-' || lpad(seq_val::TEXT, 5, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.thk_payout_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_thk_payout_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('public.thk_payout_code_seq');
    RETURN 'THK-PAY-' || lpad(seq_val::TEXT, 5, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.thk_adjustment_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_thk_adjustment_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('public.thk_adjustment_code_seq');
    RETURN 'THK-ADJ-' || lpad(seq_val::TEXT, 5, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.thk_dispute_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_thk_dispute_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('public.thk_dispute_code_seq');
    RETURN 'THK-DSP-' || lpad(seq_val::TEXT, 5, '0');
END;
$$;

-- 2. Enhance Invoices Table for BPO Client Association & Locking
ALTER TABLE IF EXISTS public.invoices
    ADD COLUMN IF NOT EXISTS invoice_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS bpo_client_id UUID REFERENCES public.bpo_clients(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS billing_period_start DATE,
    ADD COLUMN IF NOT EXISTS billing_period_end DATE,
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS adjustments_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'operational_attendance', 'operational_production', 'hybrid'));

-- Populate invoice_code on existing rows if null
UPDATE public.invoices 
SET invoice_code = 'THK-INV-' || lpad(id::TEXT, 5, '0')
WHERE invoice_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_code ON public.invoices(invoice_code);
CREATE INDEX IF NOT EXISTS idx_invoices_bpo_client ON public.invoices(bpo_client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(billing_period_start, billing_period_end);

-- 3. Enhance Invoice Items for Project & Operational Referencing
ALTER TABLE IF EXISTS public.invoice_items
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS billing_unit TEXT NOT NULL DEFAULT 'hour' 
        CHECK (billing_unit IN ('hour', 'unit', 'seat', 'fixed', 'item')),
    ADD COLUMN IF NOT EXISTS period_start DATE,
    ADD COLUMN IF NOT EXISTS period_end DATE,
    ADD COLUMN IF NOT EXISTS source_reference TEXT,
    ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoice_items_project ON public.invoice_items(project_id);

-- 4. Enhance BPO Payout Statements for Standard Payout Codes & Auditable Breakdown
ALTER TABLE IF EXISTS public.bpo_payout_statements
    ADD COLUMN IF NOT EXISTS payout_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS centre_id BIGINT REFERENCES public.bpo_centres(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS billable_units NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (billable_units >= 0),
    ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'hour' CHECK (unit_type IN ('hour', 'unit', 'seat', 'fixed')),
    ADD COLUMN IF NOT EXISTS unit_rate NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
    ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
    ADD COLUMN IF NOT EXISTS adjustments_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deductions_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deductions_amount >= 0),
    ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS source_records_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Populate payout_code on existing rows if null
UPDATE public.bpo_payout_statements 
SET payout_code = 'THK-PAY-' || lpad(id::TEXT, 5, '0')
WHERE payout_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_bpo_payout_code ON public.bpo_payout_statements(payout_code);
CREATE INDEX IF NOT EXISTS idx_bpo_payout_centre ON public.bpo_payout_statements(centre_id);
CREATE INDEX IF NOT EXISTS idx_bpo_payout_project ON public.bpo_payout_statements(project_id);

-- 5. Financial Adjustments Table (Controlled Credit / Debit Modifiers)
CREATE TABLE IF NOT EXISTS public.financial_adjustments (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    adjustment_code TEXT NOT NULL UNIQUE DEFAULT public.next_thk_adjustment_code(),
    target_type TEXT NOT NULL CHECK (target_type IN ('invoice', 'payout')),
    target_id BIGINT NOT NULL,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('credit', 'debit')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_by_user_id TEXT,
    created_by_admin_id BIGINT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    approved_by_admin_id BIGINT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adj_target ON public.financial_adjustments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_adj_status ON public.financial_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_adj_code ON public.financial_adjustments(adjustment_code);

ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_adjustments service role access" ON public.financial_adjustments;
CREATE POLICY "financial_adjustments service role access" ON public.financial_adjustments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Financial Disputes Table (Client Invoice & Centre Payout Disputes)
CREATE TABLE IF NOT EXISTS public.financial_disputes (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    dispute_code TEXT NOT NULL UNIQUE DEFAULT public.next_thk_dispute_code(),
    dispute_type TEXT NOT NULL CHECK (dispute_type IN ('invoice', 'payout')),
    target_id BIGINT NOT NULL,
    project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.bpo_clients(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.bpo_partners(id) ON DELETE SET NULL,
    centre_id BIGINT REFERENCES public.bpo_centres(id) ON DELETE SET NULL,
    disputed_amount NUMERIC(14,2) NOT NULL CHECK (disputed_amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
    evidence_text TEXT,
    evidence_url TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
    created_by_user_id TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    reviewed_by_admin_id BIGINT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_code ON public.financial_disputes(dispute_code);
CREATE INDEX IF NOT EXISTS idx_dispute_type_target ON public.financial_disputes(dispute_type, target_id);
CREATE INDEX IF NOT EXISTS idx_dispute_client ON public.financial_disputes(client_id);
CREATE INDEX IF NOT EXISTS idx_dispute_partner ON public.financial_disputes(partner_id);
CREATE INDEX IF NOT EXISTS idx_dispute_centre ON public.financial_disputes(centre_id);
CREATE INDEX IF NOT EXISTS idx_dispute_status ON public.financial_disputes(status);

ALTER TABLE public.financial_disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_disputes service role access" ON public.financial_disputes;
CREATE POLICY "financial_disputes service role access" ON public.financial_disputes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Enable billing module feature flag
INSERT INTO public.module_settings (module_key, enabled)
VALUES ('bpo_phase6_billing', TRUE)
ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;
