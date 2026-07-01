
-- Meta (Facebook / Instagram / Ads) integration tables

CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  meta_user_id text NOT NULL,
  meta_user_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, meta_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_connections TO authenticated;
GRANT ALL ON public.meta_connections TO service_role;
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_connections_sub_access" ON public.meta_connections FOR ALL
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE TRIGGER meta_connections_updated BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.meta_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  page_name text NOT NULL,
  page_access_token text NOT NULL,
  category text,
  instagram_business_account_id text,
  webhook_subscribed boolean NOT NULL DEFAULT false,
  route_messenger_to_inbox boolean NOT NULL DEFAULT true,
  route_instagram_to_inbox boolean NOT NULL DEFAULT true,
  sync_lead_ads boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, page_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_pages TO authenticated;
GRANT ALL ON public.meta_pages TO service_role;
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_pages_sub_access" ON public.meta_pages FOR ALL
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE TRIGGER meta_pages_updated BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL, -- act_XXX
  name text,
  currency text,
  timezone_name text,
  use_for_reports boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, ad_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_ad_accounts_sub_access" ON public.meta_ad_accounts FOR ALL
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE TRIGGER meta_ad_accounts_updated BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Signed OAuth state store (short-lived) so the callback can trust which sub-account initiated the flow.
CREATE TABLE public.meta_oauth_states (
  state text PRIMARY KEY,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_after text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);
GRANT SELECT, INSERT, DELETE ON public.meta_oauth_states TO authenticated;
GRANT ALL ON public.meta_oauth_states TO service_role;
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_oauth_states_owner" ON public.meta_oauth_states FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Track lead ads dedup on contacts and add messenger/instagram channels
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_lead_id text;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_sub_meta_lead_uidx
  ON public.contacts (sub_account_id, meta_lead_id) WHERE meta_lead_id IS NOT NULL;
