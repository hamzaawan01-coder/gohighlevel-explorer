-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon,
-- grant EXECUTE only to roles that actually need to call them.

-- Trigger-only functions: no direct callers needed
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: used inside policies; authenticated needs EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_subaccount_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_subaccount_access(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_agency_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_agency_access(uuid, uuid) TO authenticated;

-- RPC functions callable by signed-in users only
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.preview_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_agency_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_agency_members(uuid) TO authenticated;
