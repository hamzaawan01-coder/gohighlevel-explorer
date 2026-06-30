
revoke execute on function public.has_agency_access(uuid, uuid) from public, anon;
revoke execute on function public.has_agency_role(uuid, uuid, public.agency_role) from public, anon;
revoke execute on function public.has_subaccount_access(uuid, uuid) from public, anon;
grant execute on function public.has_agency_access(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_agency_role(uuid, uuid, public.agency_role) to authenticated, service_role;
grant execute on function public.has_subaccount_access(uuid, uuid) to authenticated, service_role;
