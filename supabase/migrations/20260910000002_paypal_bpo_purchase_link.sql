ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS bpo_id UUID REFERENCES public.bpo_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_bpo_id ON public.purchases(bpo_id);