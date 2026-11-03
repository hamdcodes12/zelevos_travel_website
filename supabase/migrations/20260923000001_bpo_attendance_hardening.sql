-- Migration: 20260923000001_bpo_attendance_hardening.sql
-- Description: Hardens bpo_agent_attendance with state consistency and validation constraints.

-- 1. Ensure current_state column exists with valid enum/text default
ALTER TABLE public.bpo_agent_attendance
  ADD COLUMN IF NOT EXISTS current_state TEXT NOT NULL DEFAULT 'checked_out',
  ADD COLUMN IF NOT EXISTS break_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_break_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Add validation constraint to guarantee check_out_time cannot be earlier than check_in_time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bpo_attendance_checkout_after_checkin'
  ) THEN
    ALTER TABLE public.bpo_agent_attendance
      ADD CONSTRAINT chk_bpo_attendance_checkout_after_checkin
      CHECK (check_out_time IS NULL OR check_out_time >= check_in_time);
  END IF;
END $$;

-- 3. Indexes for fast operational lookups
CREATE INDEX IF NOT EXISTS idx_bpo_attendance_agent_date ON public.bpo_agent_attendance(agent_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_bpo_attendance_current_state ON public.bpo_agent_attendance(current_state);
