-- Admin RPCs must not be callable by unauthenticated callers.
REVOKE EXECUTE ON FUNCTION public.list_subscription_signups() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_subscription_signups() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_subscription_signups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_subscription_signups() TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_subscription_approval(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_subscription_approval(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_subscription_approval(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_approval(uuid, text, text) TO service_role;