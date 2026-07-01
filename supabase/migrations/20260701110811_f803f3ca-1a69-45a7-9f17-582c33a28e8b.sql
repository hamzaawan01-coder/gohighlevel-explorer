REVOKE EXECUTE ON FUNCTION public.has_subaccount_access(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_agency_access(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;