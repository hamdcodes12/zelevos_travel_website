-- ==============================================================================
-- THINKATIC MIGRATION: BPO MEETINGS SYSTEM ENHANCEMENTS
-- Adds direct partner_id & centre_id references to public.meetings and
-- expands meeting types for administrative BPO operations.
-- ==============================================================================

-- 1. Ensure columns exist on public.meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS bpo_partner_id UUID REFERENCES public.bpo_partners(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS centre_id BIGINT REFERENCES public.bpo_centres(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_category TEXT NOT NULL DEFAULT 'OPERATIONAL';

-- 2. Expand meeting_type CHECK constraint to support all enterprise BPO meeting types
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_meeting_type_check CHECK (
  meeting_type IN (
    'project_review',
    'operational_review',
    'payment_discussion',
    'training',
    'compliance',
    'general',
    'other',
    'project_meeting',
    'client_meeting',
    'bpo_partner_meeting',
    'operations_meeting',
    'review',
    'general_meeting',
    'requirement_discussion',
    'demo',
    'uat',
    'planning',
    'support'
  )
);

-- 3. Indexes for high-speed lookups
CREATE INDEX IF NOT EXISTS idx_meetings_bpo_partner ON public.meetings(bpo_partner_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_bpo_centre ON public.meetings(centre_id);
CREATE INDEX IF NOT EXISTS idx_notifications_meeting_entity ON public.notifications(recipient_user_id, entity_type, entity_id);

-- 4. Ensure RLS policies are permissive for service_role and authenticated users have proper read access
DO $$ BEGIN
  DROP POLICY IF EXISTS "meetings bpo partner read access" ON public.meetings;
  CREATE POLICY "meetings bpo partner read access" ON public.meetings
    FOR SELECT TO authenticated
    USING (
      bpo_partner_id IS NOT NULL OR audience_type IN ('bpo_partner', 'all_bpo_partners', 'everyone')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
