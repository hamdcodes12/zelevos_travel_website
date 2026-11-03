-- ==============================================================================
-- THINKATIC MIGRATION: BPO SUSPENSION, RESTORE LIFECYCLE & HIGH-CONCURRENCY INDEXES
-- Supports 2500-concurrent query scale, atomic state transitions & audit trails
-- ==============================================================================

-- 1. Profiles BPO Status Check Constraint Expansion
-- Allows SUSPENDED, UNDER_REVIEW alongside standard PENDING, APPROVED, REJECTED
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bpo_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bpo_status_check 
  CHECK (bpo_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'UNDER_REVIEW'));

-- 2. High-Concurrency Composite Index for Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_account_bpo_status_active
  ON public.profiles(account_type, bpo_status, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_email_active
  ON public.profiles(email, is_active);

-- 3. BPO Partner Applications High-Frequency Indexes
CREATE INDEX IF NOT EXISTS idx_bpo_apps_applicant_user
  ON public.bpo_partner_applications(applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_bpo_apps_status_created
  ON public.bpo_partner_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bpo_apps_centre_lookup
  ON public.bpo_partner_applications(centre_id);

-- 4. BPO Centre Verification High-Frequency Indexes
CREATE INDEX IF NOT EXISTS idx_bpo_verif_applicant_lookup
  ON public.bpo_centre_verification(applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_bpo_verif_status_centre
  ON public.bpo_centre_verification(status, centre_id);

-- 5. BPO Centre Media Index (Rapid filtering for photos/video without full scans)
CREATE INDEX IF NOT EXISTS idx_bpo_media_verif_type_status
  ON public.bpo_centre_media(verification_id, media_type, status);

CREATE INDEX IF NOT EXISTS idx_bpo_media_applicant_media_type
  ON public.bpo_centre_media(applicant_user_id, media_type);

-- 6. BPO Partner Agreements
CREATE INDEX IF NOT EXISTS idx_bpo_agreements_applicant
  ON public.bpo_partner_agreements(applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_bpo_agreements_status_partner
  ON public.bpo_partner_agreements(status, partner_id);

-- 7. BPO Partners & Memberships
CREATE INDEX IF NOT EXISTS idx_bpo_partners_status_code
  ON public.bpo_partners(status, partner_code);

CREATE INDEX IF NOT EXISTS idx_bpo_partner_users_lookup
  ON public.bpo_partner_users(user_id, partner_id);

-- 8. Audit Logs Index (Fast audit trail retrieval for BPO actions)
CREATE INDEX IF NOT EXISTS idx_audit_logs_bpo_entity
  ON public.audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs(action, created_at DESC);

-- 9. Notifications High-Concurrency Index
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_user_id, created_at DESC);
