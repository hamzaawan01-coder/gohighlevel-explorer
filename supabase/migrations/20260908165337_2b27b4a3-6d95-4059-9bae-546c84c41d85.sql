GRANT EXECUTE ON FUNCTION public.has_agency_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, public.agency_role) TO authenticated;