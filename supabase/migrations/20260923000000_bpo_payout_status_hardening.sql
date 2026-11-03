-- ==============================================================================
-- Migration: 20260923000000_bpo_payout_status_hardening.sql
-- Description: Hardens BPO Payout Statements and Financial Disputes schema:
--              1. Expands status check constraint to support all enterprise payout states:
--                 'pending', 'approved', 'processing', 'paid', 'failed', 'on_hold', 'disputed', 'rejected', 'cancelled'
--              2. Ensures composite index for high-performance partner queries
--              3. Establishes RLS policies for bpo_payout_statements, financial_disputes, financial_adjustments
-- ==============================================================================

-- 1. Relax / update status check constraint on bpo_payout_statements
DO $$
BEGIN
  -- Drop existing status check constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = 'public.bpo_payout_statements'::regclass 
      AND contype = 'c' 
      AND conname LIKE '%status%'
  ) THEN
    ALTER TABLE public.bpo_payout_statements DROP CONSTRAINT IF EXISTS bpo_payout_statements_status_check;
  END IF;

  -- Add authoritative expanded check constraint
  ALTER TABLE public.bpo_payout_statements 
    ADD CONSTRAINT bpo_payout_statements_status_check 
    CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'failed', 'on_hold', 'disputed', 'rejected', 'cancelled'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update handled or already up to date: %', SQLERRM;
END $$;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_bpo_payout_partner_status 
  ON public.bpo_payout_statements(partner_id, status);

CREATE INDEX IF NOT EXISTS idx_bpo_payout_period 
  ON public.bpo_payout_statements(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_financial_disputes_partner_status 
  ON public.financial_disputes(partner_id, status);

CREATE INDEX IF NOT EXISTS idx_financial_adjustments_target 
  ON public.financial_adjustments(target_type, target_id);

-- 3. Ensure Row-Level Security is active and configured
ALTER TABLE IF EXISTS public.bpo_payout_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_adjustments ENABLE ROW LEVEL SECURITY;

-- Service Role Policy (Unrestricted for server-side trusted operations)
DROP POLICY IF EXISTS "bpo_payout_statements service role access" ON public.bpo_payout_statements;
CREATE POLICY "bpo_payout_statements service role access" ON public.bpo_payout_statements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "financial_disputes service role access" ON public.financial_disputes;
CREATE POLICY "financial_disputes service role access" ON public.financial_disputes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "financial_adjustments service role access" ON public.financial_adjustments;
CREATE POLICY "financial_adjustments service role access" ON public.financial_adjustments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Users Read Policy (Strict Tenant Match via bpo_partner_users)
DROP POLICY IF EXISTS "bpo_payout_statements partner read" ON public.bpo_payout_statements;
CREATE POLICY "bpo_payout_statements partner read" ON public.bpo_payout_statements
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id 
      FROM public.bpo_partner_users 
      WHERE user_id = auth.uid()::text AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "financial_disputes partner read" ON public.financial_disputes;
CREATE POLICY "financial_disputes partner read" ON public.financial_disputes
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id 
      FROM public.bpo_partner_users 
      WHERE user_id = auth.uid()::text AND status = 'active'
    )
  );
