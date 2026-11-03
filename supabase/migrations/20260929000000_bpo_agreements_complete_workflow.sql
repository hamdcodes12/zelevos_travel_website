-- ==============================================================================
-- Migration: 20260929000000_bpo_agreements_complete_workflow.sql
-- Description: Complete Thinkatic BPO Agreement Workflow Schema Enhancements
--              Ensures full column coverage for metadata, historical submissions,
--              Supabase Storage references, and strict auditability.
-- ==============================================================================

-- 1. Ensure columns on bpo_partner_agreements
ALTER TABLE public.bpo_partner_agreements
  ADD COLUMN IF NOT EXISTS master_document_reference TEXT DEFAULT 'Agreement/BPO Agreement.pdf',
  ADD COLUMN IF NOT EXISTS signed_document_reference TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'thinkatic-agreements',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- 2. Ensure columns on bpo_agreement_submissions
ALTER TABLE public.bpo_agreement_submissions
  ADD COLUMN IF NOT EXISTS partner_id UUID,
  ADD COLUMN IF NOT EXISTS centre_id TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'thinkatic-agreements',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS master_document_reference TEXT DEFAULT 'Agreement/BPO Agreement.pdf',
  ADD COLUMN IF NOT EXISTS signed_document_reference TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 3. Indexes for high performance lookups
CREATE INDEX IF NOT EXISTS idx_bpo_partner_agreements_partner_app ON public.bpo_partner_agreements(application_id);
CREATE INDEX IF NOT EXISTS idx_bpo_agreement_submissions_status ON public.bpo_agreement_submissions(status);
