
CREATE TABLE public.ad_platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('google','meta')),
  external_customer_id text,
  account_name text,
  refresh_token text NOT NULL,
  accessible_customers jsonb NOT NULL DEFAULT '[]'::jsonb,
  connected_by uuid NOT NULL,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_platform_connections TO authenticated;
GRANT ALL ON public.ad_platform_connections TO service_role;

ALTER TABLE public.ad_platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad conns readable by agency admins"
  ON public.ad_platform_connections FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sub_accounts sa
    JOIN public.agency_memberships am ON am.agency_id = sa.agency_id
    WHERE sa.id = ad_platform_connections.sub_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner'::agency_role,'admin'::agency_role)
  ));

CREATE POLICY "ad conns writable by agency admins"
  ON public.ad_platform_connections FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sub_accounts sa
    JOIN public.agency_memberships am ON am.agency_id = sa.agency_id
    WHERE sa.id = ad_platform_connections.sub_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner'::agency_role,'admin'::agency_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sub_accounts sa
    JOIN public.agency_memberships am ON am.agency_id = sa.agency_id
    WHERE sa.id = ad_platform_connections.sub_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner'::agency_role,'admin'::agency_role)
  ));

CREATE TRIGGER ad_conns_updated_at BEFORE UPDATE ON public.ad_platform_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX ad_conns_sub_idx ON public.ad_platform_connections(sub_account_id);
