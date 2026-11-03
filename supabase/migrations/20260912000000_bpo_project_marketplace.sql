-- ============================================================================
-- Thinkatic BPO Global Delivery Platform — Phase 2: Project Marketplace Schema
-- ============================================================================

-- 1. Ensure projects table accommodates BPO campaigns and flexible statuses
ALTER TABLE IF EXISTS public.projects
  ALTER COLUMN client_id DROP NOT NULL;

-- Expand projects status check constraint if it exists to allow BPO statuses
DO $$
BEGIN
  -- Drop existing status check if it restricts BPO statuses
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
  ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
    CHECK (status IN (
      'draft', 'open', 'allocated', 'active', 'closed',
      'planning', 'design', 'development', 'ai_training', 
      'integration', 'testing', 'uat', 'deployment', 'completed', 
      'on_hold', 'cancelled'
    ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Add BPO campaign attributes to projects table
ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS vertical TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'Inbound Customer Support',
  ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'US Shift (EST)',
  ADD COLUMN IF NOT EXISTS target_geography TEXT DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS required_seats INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS payout_rate TEXT DEFAULT '$14.00 - $18.00 / hour',
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'Bi-weekly Net 15',
  ADD COLUMN IF NOT EXISTS min_experience_years INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS requires_us_experience BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_uk_experience BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS min_centre_capacity INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS sla_details JSONB DEFAULT '{"target_csat": "90%", "target_qa": "88%", "target_aht": "360s", "target_attendance": "95%"}'::jsonb,
  ADD COLUMN IF NOT EXISTS allocated_partner_id UUID REFERENCES public.bpo_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocated_centre_id BIGINT REFERENCES public.bpo_centres(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 3. Enhance bpo_project_applications table if already present
ALTER TABLE IF EXISTS public.bpo_project_applications
  ADD COLUMN IF NOT EXISTS centre_id BIGINT REFERENCES public.bpo_centres(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_notes TEXT,
  ADD COLUMN IF NOT EXISTS more_info_requested TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 4. Enable bpo_project_marketplace feature flag
INSERT INTO public.module_settings (module_key, enabled)
VALUES ('bpo_project_marketplace', TRUE)
ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;

-- 5. Indexes for performant marketplace querying
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_vertical ON public.projects(vertical);
CREATE INDEX IF NOT EXISTS idx_projects_allocated_partner ON public.projects(allocated_partner_id);
CREATE INDEX IF NOT EXISTS idx_bpo_project_apps_status ON public.bpo_project_applications(status);
CREATE INDEX IF NOT EXISTS idx_bpo_project_apps_partner ON public.bpo_project_applications(partner_id);
