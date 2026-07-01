
CREATE TABLE public.contact_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_views_owner_idx ON public.contact_views(owner_id, sub_account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_views TO authenticated;
GRANT ALL ON public.contact_views TO service_role;

ALTER TABLE public.contact_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contact views"
  ON public.contact_views FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (owner_id = auth.uid() AND public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE TRIGGER tg_contact_views_updated_at
  BEFORE UPDATE ON public.contact_views
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
