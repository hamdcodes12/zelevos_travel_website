-- Migration: 20260923000000_bpo_agent_portal_foundation.sql
-- Description: Adds schema extensions for Agent Portal, Agent Login/Activation, Break Tracking, and Manual Call/Work Logs.

-- 1. Extend bpo_agents for login, activation, and account status
ALTER TABLE public.bpo_agents
  ADD COLUMN IF NOT EXISTS invitation_token TEXT,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'pending_activation',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bpo_agents_invitation_token ON public.bpo_agents(invitation_token);
CREATE INDEX IF NOT EXISTS idx_bpo_agents_account_status ON public.bpo_agents(account_status);
CREATE INDEX IF NOT EXISTS idx_bpo_agents_email ON public.bpo_agents(email);

-- 2. Extend bpo_agent_attendance for real-time break tracking and current shift state
ALTER TABLE public.bpo_agent_attendance
  ADD COLUMN IF NOT EXISTS current_state TEXT NOT NULL DEFAULT 'checked_out',
  ADD COLUMN IF NOT EXISTS break_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_break_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bpo_attendance_current_state ON public.bpo_agent_attendance(current_state);

-- 3. Extend bpo_call_activities for manual work/call logging (MVP without telephony integration requirement)
ALTER TABLE public.bpo_call_activities
  ALTER COLUMN integration_id DROP NOT NULL;

ALTER TABLE public.bpo_call_activities
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS next_followup_date DATE,
  ADD COLUMN IF NOT EXISTS customer_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_bpo_calls_source ON public.bpo_call_activities(source);
CREATE INDEX IF NOT EXISTS idx_bpo_calls_outcome ON public.bpo_call_activities(outcome);
