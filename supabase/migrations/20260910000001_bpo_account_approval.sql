-- BPO account approval workflow. Existing partner accounts remain active.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS bpo_status TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bpo_application_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check,
  DROP CONSTRAINT IF EXISTS profiles_bpo_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('USER', 'BPO')),
  ADD CONSTRAINT profiles_bpo_status_check CHECK (bpo_status IN ('PENDING', 'APPROVED', 'REJECTED'));

UPDATE public.profiles
SET account_type = 'BPO', bpo_status = 'APPROVED', is_active = TRUE
WHERE role IN ('partner', 'bpo_partner') AND account_type = 'USER';

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_bpo_status ON public.profiles(bpo_status);
