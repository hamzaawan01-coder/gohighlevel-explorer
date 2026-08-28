DROP POLICY IF EXISTS "meta_ad_accounts_sub_access" ON public.meta_ad_accounts;
CREATE POLICY "meta_ad_accounts_sub_access"
  ON public.meta_ad_accounts FOR ALL TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

DROP POLICY IF EXISTS "meta_oauth_states_owner" ON public.meta_oauth_states;
CREATE POLICY "meta_oauth_states_owner"
  ON public.meta_oauth_states FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);