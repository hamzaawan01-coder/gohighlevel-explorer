-- 1) Billing reconciliation state is platform-internal: only global admins may read it.
DROP POLICY IF EXISTS "members can view reconcile state" ON public.billing_reconcile_state;

CREATE POLICY "global admins can view reconcile state"
  ON public.billing_reconcile_state
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.billing_reconcile_state FROM anon;
GRANT SELECT ON public.billing_reconcile_state TO authenticated;
GRANT ALL ON public.billing_reconcile_state TO service_role;

-- 2) SECURITY DEFINER helper must not be callable by unauthenticated callers.
REVOKE EXECUTE ON FUNCTION public.subscription_modules(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_modules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_modules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_modules(uuid) TO service_role;