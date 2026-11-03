-- ==============================================================================
-- THINKATIC MIGRATION: APPLICATION PERFORMANCE & QUERY INDEX OPTIMIZATIONS
-- Target high-frequency queries, batch relations, and unread notification lookups
-- ==============================================================================

-- 1. Notifications: Partial index for lightning-fast unread count checks
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_user_id, read_at)
  WHERE read_at IS NULL;

-- 2. Meetings: High-speed chronological and status filtering
CREATE INDEX IF NOT EXISTS idx_meetings_starts_at_status
  ON public.meetings(starts_at ASC, status)
  WHERE status != 'archived';

-- 3. BPO Partner Meetings relation mapping
CREATE INDEX IF NOT EXISTS idx_bpo_partner_meetings_lookup
  ON public.bpo_partner_meetings(meeting_id, partner_id);

-- 4. BPO Partner Meeting Users (RSVP fast lookups)
CREATE INDEX IF NOT EXISTS idx_bpo_partner_meeting_users_rsvp
  ON public.bpo_partner_meeting_users(meeting_id, user_id);

-- 5. Meeting Sub-resources for batched O(1) enrichment
CREATE INDEX IF NOT EXISTS idx_meeting_participants_batch
  ON public.meeting_participants(meeting_id, user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_batch
  ON public.meeting_notes(meeting_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_batch
  ON public.meeting_action_items(meeting_id, due_date ASC);

-- 6. Contact submissions / CRM leads filtering
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created
  ON public.contact_submissions(status, created_at DESC);
