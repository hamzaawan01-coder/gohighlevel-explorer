CREATE TABLE public.meta_lead_form_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  page_id text,
  form_id text NOT NULL,
  form_name text,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, form_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_lead_form_routes TO authenticated;
GRANT ALL ON public.meta_lead_form_routes TO service_role;

ALTER TABLE public.meta_lead_form_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lead form routes"
  ON public.meta_lead_form_routes FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Admins can manage lead form routes"
  ON public.meta_lead_form_routes FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE TRIGGER meta_lead_form_routes_updated_at
  BEFORE UPDATE ON public.meta_lead_form_routes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();