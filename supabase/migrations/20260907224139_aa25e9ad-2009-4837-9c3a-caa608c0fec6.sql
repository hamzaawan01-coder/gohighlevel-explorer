GRANT SELECT ON public.invitations TO authenticated;
REVOKE ALL ON public.invitations FROM anon;
GRANT EXECUTE ON FUNCTION public.list_agency_members(uuid) TO authenticated;