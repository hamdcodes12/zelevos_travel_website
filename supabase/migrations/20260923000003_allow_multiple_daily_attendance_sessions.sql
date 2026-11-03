-- Migration: 20260923000003_allow_multiple_daily_attendance_sessions.sql
-- Description: Drops the daily unique constraint to allow multiple shifts per day per agent,
-- while enforcing a partial unique index guaranteeing AT MOST ONE active session per agent at any time.

-- 1. Drop the legacy unique constraint on (agent_id, attendance_date) if exists
ALTER TABLE public.bpo_agent_attendance
  DROP CONSTRAINT IF EXISTS bpo_agent_attendance_agent_id_attendance_date_key;

-- 2. Drop unique index on (agent_id, attendance_date) if exists
DROP INDEX IF EXISTS public.idx_bpo_attendance_agent_date_uq;

-- 3. Create conditional unique index: at most ONE active session per agent at any moment (check_out_time IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bpo_attendance_single_active_session_uq
  ON public.bpo_agent_attendance(agent_id)
  WHERE check_out_time IS NULL;

-- 4. Create standard non-unique index for fast historical lookups by agent and date
CREATE INDEX IF NOT EXISTS idx_bpo_attendance_agent_date_history
  ON public.bpo_agent_attendance(agent_id, attendance_date DESC, check_in_time DESC);
