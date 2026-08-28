CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  billing_interval text NOT NULL DEFAULT 'month',
  modules text[] NOT NULL DEFAULT '{}'::text[],
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (public.has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency admins can insert plans"
  ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::agency_role)
  );

CREATE POLICY "Agency admins can update plans"
  ON public.subscription_plans FOR UPDATE TO authenticated
  USING (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::agency_role)
  )
  WITH CHECK (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::agency_role)
  );

CREATE POLICY "Agency admins can delete plans"
  ON public.subscription_plans FOR DELETE TO authenticated
  USING (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::agency_role)
  );

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.sub_account_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL UNIQUE REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_account_subscriptions TO authenticated;
GRANT ALL ON public.sub_account_subscriptions TO service_role;
ALTER TABLE public.sub_account_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view their subscription"
  ON public.sub_account_subscriptions FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Workspace admins can insert subscription"
  ON public.sub_account_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE POLICY "Workspace admins can update subscription"
  ON public.sub_account_subscriptions FOR UPDATE TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE POLICY "Workspace admins can delete subscription"
  ON public.sub_account_subscriptions FOR DELETE TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE TRIGGER trg_sub_account_subscriptions_updated_at
  BEFORE UPDATE ON public.sub_account_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.subscription_modules(_sub uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.modules
  FROM public.sub_account_subscriptions s
  JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.sub_account_id = _sub
    AND s.status IN ('active', 'trialing', 'past_due')
    AND public.has_subaccount_access(auth.uid(), _sub)
$$;