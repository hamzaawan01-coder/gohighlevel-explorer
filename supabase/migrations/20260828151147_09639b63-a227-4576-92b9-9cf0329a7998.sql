CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'void');

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  number text NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'GBP',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, number)
);

CREATE INDEX invoices_sub_account_idx ON public.invoices (sub_account_id, created_at DESC);
CREATE INDEX invoices_contact_idx ON public.invoices (contact_id);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_items_invoice_idx ON public.invoice_items (invoice_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage invoices"
ON public.invoices FOR ALL TO authenticated
USING (public.has_subaccount_access(auth.uid(), sub_account_id))
WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Workspace members manage invoice items"
ON public.invoice_items FOR ALL TO authenticated
USING (public.has_subaccount_access(auth.uid(), sub_account_id))
WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER invoice_items_set_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_invoice_assign_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '\D', '', 'g'), '')::integer), 0) + 1
      INTO next_num
      FROM public.invoices
     WHERE sub_account_id = NEW.sub_account_id;
    NEW.number := 'INV-' || lpad(next_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_assign_number
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_assign_number();

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(_invoice uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub numeric(12,2);
  rate numeric(6,3);
BEGIN
  SELECT COALESCE(SUM(ROUND(quantity * unit_price, 2)), 0) INTO sub
    FROM public.invoice_items WHERE invoice_id = _invoice;
  SELECT tax_rate INTO rate FROM public.invoices WHERE id = _invoice;
  IF rate IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.invoices
     SET subtotal = sub,
         tax_amount = ROUND(sub * rate / 100, 2),
         total = sub + ROUND(sub * rate / 100, 2)
   WHERE id = _invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_invoice_items_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER invoice_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_recalc();

CREATE OR REPLACE FUNCTION public.tg_invoice_tax_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tax_rate IS DISTINCT FROM OLD.tax_rate THEN
    PERFORM public.recalc_invoice_totals(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER invoices_tax_recalc
AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_tax_recalc();