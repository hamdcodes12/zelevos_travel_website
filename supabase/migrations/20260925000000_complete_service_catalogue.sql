-- 20260925000000_complete_service_catalogue.sql
-- Thinkatic Complete Service & Pricing Catalogue Master Data Migration

DO $$
BEGIN
  -- Extended columns on plans table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'service_name') THEN
    ALTER TABLE public.plans ADD COLUMN service_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'package_slug') THEN
    ALTER TABLE public.plans ADD COLUMN package_slug TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'target_customer') THEN
    ALTER TABLE public.plans ADD COLUMN target_customer TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'billing_interval') THEN
    ALTER TABLE public.plans ADD COLUMN billing_interval TEXT DEFAULT 'one_time';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'currency') THEN
    ALTER TABLE public.plans ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'delivery_timeline') THEN
    ALTER TABLE public.plans ADD COLUMN delivery_timeline TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'support_duration') THEN
    ALTER TABLE public.plans ADD COLUMN support_duration TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'included_units') THEN
    ALTER TABLE public.plans ADD COLUMN included_units TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'price_display') THEN
    ALTER TABLE public.plans ADD COLUMN price_display TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'price_max') THEN
    ALTER TABLE public.plans ADD COLUMN price_max NUMERIC(14,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'public_visible') THEN
    ALTER TABLE public.plans ADD COLUMN public_visible BOOLEAN DEFAULT TRUE;
  END IF;

  -- Add invoice_id column to purchases if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'invoice_id') THEN
    ALTER TABLE public.purchases ADD COLUMN invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Disable legacy AI plans from Client Portal & checkout self-activation
UPDATE public.plans
SET enabled = FALSE, client_visible = FALSE, updated_at = NOW()
WHERE service_id IN ('ai-launch', 'ai-transformation', 'enterprise-ai')
   OR category = 'AI & Automation';

-- Ensure index on plans
CREATE INDEX IF NOT EXISTS idx_plans_service_id ON public.plans(service_id);
CREATE INDEX IF NOT EXISTS idx_plans_category ON public.plans(category);
CREATE INDEX IF NOT EXISTS idx_plans_client_visible ON public.plans(client_visible) WHERE client_visible = TRUE;
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_id ON public.purchases(invoice_id);
