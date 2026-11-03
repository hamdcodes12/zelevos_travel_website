-- Persisted platform feature controls and client-visible plan state.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.platform_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by BIGINT REFERENCES public.admin_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.module_settings (module_key, enabled)
VALUES
    ('client_updates', TRUE),
    ('attendance', TRUE),
    ('kyc', TRUE),
    ('affiliate', TRUE),
    ('wallet', TRUE),
    ('bpo_withdrawals', TRUE)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES
    ('ticket_categories', '{"client":["Technical Issue","Billing Issue","Project Issue","Feature Request","General Support"],"partner":["Process Issue","Technical Issue","Payment Issue","Project Issue","Employee Issue","Training","General Support"]}'::jsonb),
    ('ticket_priorities', '["low","medium","high","urgent"]'::jsonb),
    ('ticket_statuses', '["open","assigned","in_progress","waiting_for_requester","resolved","closed"]'::jsonb),
    ('client_messages', '{"support_disabled":"Support tickets are temporarily disabled."}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform settings service role access" ON public.platform_settings;
CREATE POLICY "Platform settings service role access" ON public.platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
