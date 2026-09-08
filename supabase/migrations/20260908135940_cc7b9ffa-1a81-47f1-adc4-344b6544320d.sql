REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_agency_access(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_agency_access(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) TO service_role;