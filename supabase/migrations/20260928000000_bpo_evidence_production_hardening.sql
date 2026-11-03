-- ==============================================================================
-- Migration: 20260928000000_bpo_evidence_production_hardening.sql
-- Description: Production hardening for BPO Centre Media Evidence & Accreditation.
--              Adds explicit storage_bucket, storage_path, reviewer tracking,
--              rejection reason fields, and expands status constraints for media.
-- ==============================================================================

-- 1. Enhance bpo_centre_media columns
ALTER TABLE public.bpo_centre_media 
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'thinkatic-centre-verification',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Expand status constraint to allow granular admin reviews
ALTER TABLE public.bpo_centre_media DROP CONSTRAINT IF EXISTS bpo_centre_media_status_check;
ALTER TABLE public.bpo_centre_media 
  ADD CONSTRAINT bpo_centre_media_status_check 
  CHECK (status IN ('active', 'archived', 'superseded', 'approved', 'rejected', 'resubmission_required'));

-- 3. Indexes for fast retrieval by status and verification
CREATE INDEX IF NOT EXISTS idx_bpo_centre_media_status ON public.bpo_centre_media(status);
CREATE INDEX IF NOT EXISTS idx_bpo_centre_media_verif_cat ON public.bpo_centre_media(verification_id, category);
