
-- SECURITY DEFINER: bypasses RLS so an unaffiliated user can claim a valid invite
create or replace function public.accept_invitation(_token text)
returns table (agency_id uuid, sub_account_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select email into uemail from auth.users where id = uid;

  select * into inv from public.invitations where token = _token;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if inv.accepted_at is not null then
    raise exception 'Invitation already accepted' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'Invitation expired' using errcode = 'P0001';
  end if;
  if lower(inv.email) <> lower(uemail) then
    raise exception 'Invitation email mismatch' using errcode = 'P0001';
  end if;

  -- Agency-level role (owner/admin) → agency_memberships
  if inv.role in ('owner', 'admin') then
    insert into public.agency_memberships (agency_id, user_id, role)
    values (inv.agency_id, uid, inv.role::agency_role)
    on conflict (agency_id, user_id) do nothing;
  else
    -- Sub-account role (member/client) → sub_account_memberships
    if inv.sub_account_id is null then
      raise exception 'Sub-account required for this role' using errcode = 'P0001';
    end if;
    insert into public.sub_account_memberships (sub_account_id, user_id, role)
    values (inv.sub_account_id, uid, inv.role::sub_account_role)
    on conflict (sub_account_id, user_id) do nothing;
  end if;

  update public.invitations set accepted_at = now() where id = inv.id;

  return query select inv.agency_id, inv.sub_account_id, inv.role;
end $$;

grant execute on function public.accept_invitation(text) to authenticated;

-- Allow a signed-in user to look up an invite by token to preview it before accepting
create or replace function public.preview_invitation(_token text)
returns table (
  email text,
  agency_id uuid,
  agency_name text,
  sub_account_id uuid,
  sub_account_name text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.email, i.agency_id, a.name, i.sub_account_id, sa.name, i.role, i.expires_at, i.accepted_at
  from public.invitations i
  join public.agencies a on a.id = i.agency_id
  left join public.sub_accounts sa on sa.id = i.sub_account_id
  where i.token = _token
$$;

grant execute on function public.preview_invitation(text) to authenticated, anon;

-- Helper: list members of an agency (joins to profiles)
create or replace function public.list_agency_members(_agency uuid)
returns table (user_id uuid, full_name text, avatar_url text, role text, scope text, sub_account_id uuid, sub_account_name text)
language sql
stable security definer
set search_path = public
as $$
  select am.user_id, p.full_name, p.avatar_url, am.role::text, 'agency'::text, null::uuid, null::text
  from public.agency_memberships am
  left join public.profiles p on p.id = am.user_id
  where am.agency_id = _agency
    and has_agency_access(auth.uid(), _agency)
  union all
  select sm.user_id, p.full_name, p.avatar_url, sm.role::text, 'sub_account'::text, sa.id, sa.name
  from public.sub_account_memberships sm
  join public.sub_accounts sa on sa.id = sm.sub_account_id
  left join public.profiles p on p.id = sm.user_id
  where sa.agency_id = _agency
    and has_agency_access(auth.uid(), _agency)
$$;

grant execute on function public.list_agency_members(uuid) to authenticated;
