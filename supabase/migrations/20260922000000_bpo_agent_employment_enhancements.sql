-- ==============================================================================
-- Migration: 20260922000000_bpo_agent_employment_enhancements.sql
-- Description: Agent Roster & Onboarding enhancements - employment details,
--              work configuration, supervisor assignment, and audit lifecycle
-- ==============================================================================

ALTER TABLE public.bpo_agents
  ADD COLUMN IF NOT EXISTS supervisor TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-Time',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS process_type TEXT DEFAULT 'voice',
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS idx_bpo_agents_supervisor ON public.bpo_agents(supervisor);
CREATE INDEX IF NOT EXISTS idx_bpo_agents_is_draft ON public.bpo_agents(is_draft);
