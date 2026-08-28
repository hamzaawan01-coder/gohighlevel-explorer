-- 1. Audit log
CREATE TABLE public.sub_account_module_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sub_account_module_audit TO authenticated;
GRANT ALL ON public.sub_account_module_audit TO service_role;

ALTER TABLE public.sub_account_module_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view module history"
  ON public.sub_account_module_audit FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX idx_module_audit_sub_created ON public.sub_account_module_audit (sub_account_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_log_module_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.enabled IS NOT DISTINCT FROM OLD.enabled THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.sub_account_module_audit (sub_account_id, module_key, enabled, changed_by, source)
  VALUES (NEW.sub_account_id, NEW.module_key, NEW.enabled, auth.uid(),
          CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'manual' END);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_module_change
AFTER INSERT OR UPDATE ON public.sub_account_modules
FOR EACH ROW EXECUTE FUNCTION public.tg_log_module_change();

-- 2. Agency presets
CREATE TABLE public.agency_module_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_module_presets TO authenticated;
GRANT ALL ON public.agency_module_presets TO service_role;

ALTER TABLE public.agency_module_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view presets"
  ON public.agency_module_presets FOR SELECT TO authenticated
  USING (public.has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency admins manage presets"
  ON public.agency_module_presets FOR ALL TO authenticated
  USING (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::agency_role)
  )
  WITH CHECK (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::agency_role)
  );

CREATE TRIGGER trg_agency_module_presets_updated_at
BEFORE UPDATE ON public.agency_module_presets
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. New workspaces inherit presets
CREATE OR REPLACE FUNCTION public.tg_apply_module_presets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sub_account_modules (sub_account_id, module_key, enabled)
  SELECT NEW.id, p.module_key, p.enabled
  FROM public.agency_module_presets p
  WHERE p.agency_id = NEW.agency_id
  ON CONFLICT (sub_account_id, module_key) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_module_presets
AFTER INSERT ON public.sub_accounts
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_module_presets();

REVOKE ALL ON FUNCTION public.tg_log_module_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_apply_module_presets() FROM PUBLIC, anon, authenticated;
