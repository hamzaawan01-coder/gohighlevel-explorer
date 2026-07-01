-- Lead capture forms + submissions

CREATE TABLE public.lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_message text NOT NULL DEFAULT 'Thanks! We''ll be in touch.',
  redirect_url text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_forms TO authenticated;
GRANT ALL ON public.lead_forms TO service_role;
ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

-- Anyone can read an enabled form (needed to render the public page)
CREATE POLICY "Public can view enabled forms"
  ON public.lead_forms FOR SELECT TO anon
  USING (enabled = true);
CREATE POLICY "Workspace can manage forms"
  ON public.lead_forms FOR ALL TO authenticated
  USING (has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (has_subaccount_access(auth.uid(), sub_account_id));

CREATE TRIGGER lead_forms_updated_at BEFORE UPDATE ON public.lead_forms
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can view submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "Workspace can delete submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX idx_form_submissions_form ON public.form_submissions(form_id, created_at DESC);
CREATE INDEX idx_form_submissions_sub ON public.form_submissions(sub_account_id, created_at DESC);

-- Add form.submitted trigger to workflow_trigger enum
ALTER TYPE public.workflow_trigger ADD VALUE IF NOT EXISTS 'form.submitted';

-- Dispatcher trigger for form submissions
CREATE OR REPLACE FUNCTION public.tg_form_submissions_workflow()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.run_workflows(
    'form.submitted'::public.workflow_trigger,
    new.sub_account_id,
    new.id,
    jsonb_build_object(
      'submission_id', new.id,
      'form_id', new.form_id,
      'contact_id', new.contact_id,
      'payload', new.payload
    )
  );
  RETURN new;
END $$;

CREATE TRIGGER form_submissions_workflow
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_form_submissions_workflow();