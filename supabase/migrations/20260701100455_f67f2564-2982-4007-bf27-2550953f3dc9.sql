-- The prior column-level REVOKE was ineffective because a whole-table
-- GRANT SELECT was in place. Revoke the table-level SELECT first, then
-- re-grant SELECT on every non-sensitive column explicitly.

REVOKE SELECT ON public.ad_platform_connections FROM anon, authenticated;

GRANT SELECT (
  id,
  sub_account_id,
  platform,
  external_customer_id,
  account_name,
  accessible_customers,
  connected_by,
  last_synced_at,
  last_sync_error,
  created_at,
  updated_at
) ON public.ad_platform_connections TO authenticated;

-- service_role keeps ALL via existing GRANT ALL.