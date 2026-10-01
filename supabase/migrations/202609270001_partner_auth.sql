-- Supabase production migration: partner authentication & sessions
-- Add password_hash column to partners and create partner_sessions table.

ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS public.partner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_sessions_token_hash_idx ON public.partner_sessions(token_hash);
CREATE INDEX IF NOT EXISTS partner_sessions_partner_id_idx ON public.partner_sessions(partner_id);
