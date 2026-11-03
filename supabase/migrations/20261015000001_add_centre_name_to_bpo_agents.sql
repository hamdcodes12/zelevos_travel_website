-- Migration: Add centre_name to bpo_agents
-- Allows direct storage of manual centre name entered by BPO Partner

ALTER TABLE public.bpo_agents
  ADD COLUMN IF NOT EXISTS centre_name TEXT;

COMMENT ON COLUMN public.bpo_agents.centre_name IS 'Delivery centre name entered manually by BPO Partner during agent onboarding';
