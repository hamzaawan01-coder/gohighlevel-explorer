GRANT EXECUTE ON FUNCTION public.has_subaccount_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_agency_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;