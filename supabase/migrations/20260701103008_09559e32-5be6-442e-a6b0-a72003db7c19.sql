
CREATE TABLE public.wordpress_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  secret text,
  field_map jsonb NOT NULL DEFAULT '{
    "first_name": ["first_name","firstname","fname","your-name","name"],
    "last_name":  ["last_name","lastname","lname"],
    "email":      ["email","your-email","email-address","email_address"],
    "phone":      ["phone","telephone","your-phone","phone_number"],
    "company":    ["company","organization","your-company"],
    "notes":      ["message","your-message","comments","notes"]
  }'::jsonb,
  default_tags text[] NOT NULL DEFAULT ARRAY['wordpress']::text[],
  lead_source text NOT NULL DEFAULT 'WordPress',
  enabled boolean NOT NULL DEFAULT true,
  total_received integer NOT NULL DEFAULT 0,
  last_received_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wordpress_webhooks TO authenticated;
GRANT ALL ON public.wordpress_webhooks TO service_role;

ALTER TABLE public.wordpress_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wordpress_webhooks: read by workspace"
  ON public.wordpress_webhooks FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "wordpress_webhooks: insert by workspace"
  ON public.wordpress_webhooks FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id) AND created_by = auth.uid());

CREATE POLICY "wordpress_webhooks: update by workspace"
  ON public.wordpress_webhooks FOR UPDATE TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "wordpress_webhooks: delete by workspace"
  ON public.wordpress_webhooks FOR DELETE TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE TRIGGER wordpress_webhooks_updated_at
  BEFORE UPDATE ON public.wordpress_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX wordpress_webhooks_sub_account_idx ON public.wordpress_webhooks(sub_account_id);
CREATE INDEX wordpress_webhooks_form_idx ON public.wordpress_webhooks(form_id);
