CREATE TABLE public.meta_lead_ad_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  page_id text,
  form_id text,
  form_name text,
  leadgen_id text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  routing_source text NOT NULL DEFAULT 'default',
  status text NOT NULL DEFAULT 'ok',
  error text,
  is_test boolean NOT NULL DEFAULT false,
  lead_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX meta_lead_ad_events_sub_form_idx
  ON public.meta_lead_ad_events (sub_account_id, form_id, created_at DESC);

GRANT SELECT ON public.meta_lead_ad_events TO authenticated;
GRANT ALL ON public.meta_lead_ad_events TO service_role;

ALTER TABLE public.meta_lead_ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view Lead Ad audit events"
  ON public.meta_lead_ad_events FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));