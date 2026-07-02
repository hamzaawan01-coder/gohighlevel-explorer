
-- 1) twilio_connections: drop broad members-read policy; admins-only remain (ALL policy covers select)
DROP POLICY IF EXISTS "members read twilio connections" ON public.twilio_connections;

-- 2) meta_connections: restrict all access to sub-account admins
DROP POLICY IF EXISTS meta_connections_sub_access ON public.meta_connections;
CREATE POLICY meta_connections_admin_access ON public.meta_connections
  FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

-- 3) meta_pages: restrict all access to sub-account admins
DROP POLICY IF EXISTS meta_pages_sub_access ON public.meta_pages;
CREATE POLICY meta_pages_admin_access ON public.meta_pages
  FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

-- 4) invitations: hide token column from authenticated reads via column-level grants
REVOKE SELECT ON public.invitations FROM authenticated;
GRANT SELECT (id, email, agency_id, sub_account_id, role, expires_at, accepted_at, invited_by, created_at)
  ON public.invitations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.invitations TO authenticated;

-- Helper to return the token only to the admin who created the invite
CREATE OR REPLACE FUNCTION public.get_invitation_token(_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token FROM public.invitations
   WHERE id = _id AND invited_by = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_invitation_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_token(uuid) TO authenticated;

-- 5) ad_platform_connections: hide refresh_token from authenticated reads
REVOKE SELECT ON public.ad_platform_connections FROM authenticated;
GRANT SELECT (id, sub_account_id, platform, external_customer_id, account_name, accessible_customers,
              connected_by, last_synced_at, last_sync_error, created_at, updated_at)
  ON public.ad_platform_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ad_platform_connections TO authenticated;

-- 6) SECURITY DEFINER functions that were executable by PUBLIC/anon
REVOKE EXECUTE ON FUNCTION public.in_quiet_hours(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_send_time(uuid, timestamptz) FROM PUBLIC, anon;
