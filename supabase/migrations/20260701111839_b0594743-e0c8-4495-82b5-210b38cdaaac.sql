
-- Helper: is caller an agency owner/admin for the sub-account?
CREATE OR REPLACE FUNCTION public.is_subaccount_admin(_user uuid, _sub uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sub_accounts sa
    JOIN public.agency_memberships am ON am.agency_id = sa.agency_id
    WHERE sa.id = _sub
      AND am.user_id = _user
      AND am.role IN ('owner'::agency_role, 'admin'::agency_role)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_subaccount_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_subaccount_admin(uuid, uuid) TO authenticated;

-- Replace wordpress_webhooks policies: admin-only management
DROP POLICY IF EXISTS "wordpress_webhooks: read by workspace" ON public.wordpress_webhooks;
DROP POLICY IF EXISTS "wordpress_webhooks: insert by workspace" ON public.wordpress_webhooks;
DROP POLICY IF EXISTS "wordpress_webhooks: update by workspace" ON public.wordpress_webhooks;
DROP POLICY IF EXISTS "wordpress_webhooks: delete by workspace" ON public.wordpress_webhooks;

CREATE POLICY "wordpress_webhooks: admins read"
  ON public.wordpress_webhooks FOR SELECT TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE POLICY "wordpress_webhooks: admins insert"
  ON public.wordpress_webhooks FOR INSERT TO authenticated
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE POLICY "wordpress_webhooks: admins update"
  ON public.wordpress_webhooks FOR UPDATE TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE POLICY "wordpress_webhooks: admins delete"
  ON public.wordpress_webhooks FOR DELETE TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id));
