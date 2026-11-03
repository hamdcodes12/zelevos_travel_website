-- Migration: 20260923000002_fix_bpo_agent_attendance_consistency.sql
-- Description: Enforces attendance checkout >= checkin constraint and cleans up inconsistent records.

-- 1. Clean up any invalid rows where check_out_time is earlier than check_in_time
UPDATE public.bpo_agent_attendance
SET check_out_time = NULL
WHERE remarks = 'checked_in' OR remarks LIKE 'on_break%';

UPDATE public.bpo_agent_attendance
SET check_out_time = check_in_time + interval '1 minute'
WHERE check_out_time IS NOT NULL AND check_out_time < check_in_time;

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

-- 3. Ensure unique constraint on (agent_id, attendance_date) for deterministic shift resolution
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_bpo_agent_attendance_agent_date'
  ) THEN
    -- Check if unique index or constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE tablename = 'bpo_agent_attendance' AND indexname = 'idx_bpo_attendance_agent_date_uq'
    ) THEN
      CREATE UNIQUE INDEX idx_bpo_attendance_agent_date_uq ON public.bpo_agent_attendance(agent_id, attendance_date);
    END IF;
  END IF;
END $$;
