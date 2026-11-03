-- =============================================================================
-- Thinkatic Billing Enhancements (Additive)
-- - Project linkage for payments
-- - Invoice/receipt document linkage (Documents module)
-- - Billing configuration seed (platform_settings)
-- - Overdue helper returning updated invoice rows (for notifications)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Billing settings (configurable; used for invoice/receipt rendering)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES (
  'billing_settings',
  jsonb_build_object(
    'company', jsonb_build_object(
      'name', 'Thinkatic',
      'legalName', 'Thinkatic',
      'email', 'billing@thinkatic.com',
      'phone', '',
      'website', 'https://thinkatic.com',
      'addressLines', jsonb_build_array(''),
      'taxId', ''
    ),
    'invoice', jsonb_build_object(
      'allowPartialPayments', true,
      'defaultNotes', 'Thank you for your business.',
      'defaultTerms', 'Payment is due by the due date shown on the invoice.'
    )
  )
)
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Payments: link to projects (for reporting + integrity)
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_project ON public.invoice_payments(project_id, created_at DESC);

-- Keep invoice_payments.project_id in sync with invoices.project_id
CREATE OR REPLACE FUNCTION public.set_invoice_payment_project_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    SELECT project_id INTO NEW.project_id
    FROM public.invoices
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_payments_project_id ON public.invoice_payments;
CREATE TRIGGER trg_invoice_payments_project_id
BEFORE INSERT ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_payment_project_id();

-- ---------------------------------------------------------------------------
-- Documents integration (secure, signed URL downloads)
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_document_id BIGINT REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE public.invoice_receipts
  ADD COLUMN IF NOT EXISTS document_id BIGINT REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_document ON public.invoices(invoice_document_id);
CREATE INDEX IF NOT EXISTS idx_invoice_receipts_document ON public.invoice_receipts(document_id);

-- ---------------------------------------------------------------------------
-- Overdue helper that returns the rows updated to overdue
-- (avoids duplicate notifications by returning only newly-overdue invoices)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices_detailed()
RETURNS TABLE (
  id BIGINT,
  client_id UUID,
  invoice_number TEXT,
  balance_due NUMERIC(14,2),
  due_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    UPDATE public.invoices
    SET status = 'overdue',
        updated_at = NOW()
    WHERE status IN ('sent', 'pending_payment', 'partially_paid')
      AND due_date < CURRENT_DATE
      AND balance_due > 0
    RETURNING public.invoices.id,
              public.invoices.client_id,
              public.invoices.invoice_number,
              public.invoices.balance_due,
              public.invoices.due_date
  )
  SELECT * FROM updated;
END;
$$;

