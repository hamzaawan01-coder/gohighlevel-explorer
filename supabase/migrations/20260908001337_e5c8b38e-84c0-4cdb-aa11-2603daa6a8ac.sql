-- 1. Avatars: restrict reads to the owner's own folder
DROP POLICY IF EXISTS "avatars own read" ON storage.objects;
CREATE POLICY "avatars own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- 2. Fix helper argument order (_user, _sub) on attribution tables
DROP POLICY IF EXISTS "Members read touches" ON public.contact_touches;
CREATE POLICY "Members read touches" ON public.contact_touches
  FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

DROP POLICY IF EXISTS "Members record touches" ON public.contact_touches;
CREATE POLICY "Members record touches" ON public.contact_touches
  FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

DROP POLICY IF EXISTS "Members read ad spend" ON public.ad_spend_daily;
CREATE POLICY "Members read ad spend" ON public.ad_spend_daily
  FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

DROP POLICY IF EXISTS "Members add ad spend" ON public.ad_spend_daily;
CREATE POLICY "Members add ad spend" ON public.ad_spend_daily
  FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Owner or admin edits ad spend" ON public.ad_spend_daily;
CREATE POLICY "Owner or admin edits ad spend" ON public.ad_spend_daily
  FOR UPDATE TO authenticated
  USING (
    public.has_subaccount_access(auth.uid(), sub_account_id)
    AND (created_by = auth.uid() OR public.is_subaccount_admin(auth.uid(), sub_account_id))
  )
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

DROP POLICY IF EXISTS "Owner or admin deletes ad spend" ON public.ad_spend_daily;
CREATE POLICY "Owner or admin deletes ad spend" ON public.ad_spend_daily
  FOR DELETE TO authenticated
  USING (
    public.has_subaccount_access(auth.uid(), sub_account_id)
    AND (created_by = auth.uid() OR public.is_subaccount_admin(auth.uid(), sub_account_id))
  );

-- 3. Unused SECURITY DEFINER helper: no direct execution by clients
REVOKE ALL ON FUNCTION public.subscription_modules(uuid) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_modules(uuid) TO service_role;