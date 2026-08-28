CREATE TABLE public.invoice_template_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  template_name text,
  template_version integer,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_template_audit TO authenticated;
GRANT ALL ON public.invoice_template_audit TO service_role;

ALTER TABLE public.invoice_template_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read template audit"
  ON public.invoice_template_audit FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Members write template audit"
  ON public.invoice_template_audit FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id) AND changed_by = auth.uid());

CREATE INDEX invoice_template_audit_sub_created_idx
  ON public.invoice_template_audit (sub_account_id, created_at DESC);