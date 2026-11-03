-- ==============================================================================
-- Migration: 20261015000000_add_assigned_by_and_centre_id.sql
-- Description: Adds assigned_by and created_by to bpo_agents and canonical centre_id
--              to bpo_centres for authoritative agent-centre assignment and audit.
-- ==============================================================================

-- 1. Add assigned_by and created_by columns to bpo_agents
ALTER TABLE public.bpo_agents
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bpo_agents_assigned_by ON public.bpo_agents(assigned_by);
CREATE INDEX IF NOT EXISTS idx_bpo_agents_created_by ON public.bpo_agents(created_by);

-- 2. Add canonical centre_id column to bpo_centres
ALTER TABLE public.bpo_centres
  ADD COLUMN IF NOT EXISTS centre_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bpo_centres_centre_id ON public.bpo_centres(centre_id);

-- 3. Backfill canonical centre_id from bpo_partners.partner_code where available
UPDATE public.bpo_centres c
SET centre_id = p.partner_code
FROM public.bpo_partners p
WHERE c.partner_id = p.id
  AND (c.centre_id IS NULL OR c.centre_id = '')
  AND p.partner_code IS NOT NULL;
