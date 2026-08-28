CREATE TABLE public.sub_account_subscription_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  old_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  new_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status text,
  modules text[] NOT NULL DEFAULT '{}'::text[],
  changed_by uuid,
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_sub_audit_sub_account ON public.sub_account_subscription_audit(sub_account_id, created_at DESC);

GRANT SELECT ON public.sub_account_subscription_audit TO authenticated;
GRANT ALL ON public.sub_account_subscription_audit TO service_role;

ALTER TABLE public.sub_account_subscription_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace subscription history"
  ON public.sub_account_subscription_audit FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE OR REPLACE FUNCTION public.tg_log_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mods text[] := '{}'::text[];
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_id IS NOT NULL THEN
    SELECT p.modules INTO mods FROM public.subscription_plans p WHERE p.id = NEW.plan_id;
  END IF;

  INSERT INTO public.sub_account_subscription_audit (
    sub_account_id, old_plan_id, new_plan_id, status, modules, changed_by, source
  ) VALUES (
    NEW.sub_account_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.plan_id ELSE NULL END,
    NEW.plan_id,
    NEW.status,
    COALESCE(mods, '{}'::text[]),
    auth.uid(),
    CASE WHEN auth.uid() IS NULL THEN 'billing' ELSE 'manual' END
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_subscription_change
AFTER INSERT OR UPDATE ON public.sub_account_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_log_subscription_change();