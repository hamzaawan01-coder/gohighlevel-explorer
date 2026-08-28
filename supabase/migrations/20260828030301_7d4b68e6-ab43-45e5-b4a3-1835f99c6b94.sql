CREATE TABLE public.sub_account_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, module_key)
);

CREATE INDEX idx_sub_account_modules_sub ON public.sub_account_modules(sub_account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_account_modules TO authenticated;
GRANT ALL ON public.sub_account_modules TO service_role;

ALTER TABLE public.sub_account_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read modules"
  ON public.sub_account_modules FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "admins manage modules"
  ON public.sub_account_modules FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE TRIGGER trg_sub_account_modules_updated_at
  BEFORE UPDATE ON public.sub_account_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();