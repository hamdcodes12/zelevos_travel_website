-- Additive Admin Control Centre persistence.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);
