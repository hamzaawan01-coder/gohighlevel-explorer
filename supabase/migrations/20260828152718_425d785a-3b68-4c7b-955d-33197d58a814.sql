-- 1. Template variants per workspace
CREATE TABLE public.invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  business_name text,
  logo_url text,
  accent_color text NOT NULL DEFAULT '#4f46e5',
  address text,
  payment_instructions text,
  terms text,
  footer_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_templates TO authenticated;
GRANT ALL ON public.invoice_templates TO service_role;

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members manage invoice templates"
  ON public.invoice_templates FOR ALL
  TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX idx_invoice_templates_sub ON public.invoice_templates(sub_account_id);
CREATE UNIQUE INDEX idx_invoice_templates_one_default
  ON public.invoice_templates(sub_account_id) WHERE is_default AND archived_at IS NULL;

CREATE TRIGGER invoice_templates_set_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Invoices point at the template variant they use
ALTER TABLE public.invoices
  ADD COLUMN template_id uuid REFERENCES public.invoice_templates(id) ON DELETE SET NULL;

-- 3. Seed one "Default" template per workspace from existing branding
INSERT INTO public.invoice_templates (
  sub_account_id, name, is_default, business_name, logo_url, accent_color,
  address, payment_instructions, terms, footer_note
)
SELECT b.sub_account_id, 'Default', true, b.business_name, b.logo_url,
       COALESCE(b.accent_color, '#4f46e5'), b.address, b.payment_instructions,
       b.terms, b.footer_note
FROM public.invoice_branding b;

INSERT INTO public.invoice_templates (sub_account_id, name, is_default)
SELECT sa.id, 'Default', true
FROM public.sub_accounts sa
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_templates t WHERE t.sub_account_id = sa.id
);

UPDATE public.invoices i
   SET template_id = t.id
  FROM public.invoice_templates t
 WHERE t.sub_account_id = i.sub_account_id
   AND t.is_default
   AND i.template_id IS NULL;

-- 4. Stored render snapshots (downloadable past documents)
CREATE TABLE public.invoice_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  template_name text,
  template_version integer,
  branding_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  invoice_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  html text NOT NULL,
  source text NOT NULL DEFAULT 'print',
  reminder_sequence integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_renders TO authenticated;
GRANT ALL ON public.invoice_renders TO service_role;

ALTER TABLE public.invoice_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view invoice renders"
  ON public.invoice_renders FOR SELECT
  TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Workspace members record invoice renders"
  ON public.invoice_renders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX idx_invoice_renders_invoice ON public.invoice_renders(invoice_id, created_at DESC);