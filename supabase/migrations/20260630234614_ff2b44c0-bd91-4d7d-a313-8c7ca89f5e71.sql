
-- ============================================================
-- Multi-tenant model: Agencies + Sub-accounts + Memberships
-- ============================================================

-- 1. Enums
create type public.agency_role as enum ('owner','admin');
create type public.sub_account_role as enum ('member','client');

-- 2. Agencies
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  plan text not null default 'free',
  owner_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agencies to authenticated;
grant all on public.agencies to service_role;
alter table public.agencies enable row level security;
create trigger trg_agencies_updated before update on public.agencies
  for each row execute function public.tg_set_updated_at();

-- 3. Sub-accounts (client businesses inside an agency)
create table public.sub_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  slug text,
  industry text,
  timezone text not null default 'UTC',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sub_accounts to authenticated;
grant all on public.sub_accounts to service_role;
alter table public.sub_accounts enable row level security;
create trigger trg_sub_accounts_updated before update on public.sub_accounts
  for each row execute function public.tg_set_updated_at();
create index idx_sub_accounts_agency on public.sub_accounts(agency_id);

-- 4. Agency memberships (owner / admin)
create table public.agency_memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null,
  role public.agency_role not null,
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);
grant select, insert, update, delete on public.agency_memberships to authenticated;
grant all on public.agency_memberships to service_role;
alter table public.agency_memberships enable row level security;
create index idx_agency_memberships_user on public.agency_memberships(user_id);

-- 5. Sub-account memberships (member / client)
create table public.sub_account_memberships (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  user_id uuid not null,
  role public.sub_account_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (sub_account_id, user_id)
);
grant select, insert, update, delete on public.sub_account_memberships to authenticated;
grant all on public.sub_account_memberships to service_role;
alter table public.sub_account_memberships enable row level security;
create index idx_sub_acct_memberships_user on public.sub_account_memberships(user_id);

-- 6. Invitations
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  sub_account_id uuid references public.sub_accounts(id) on delete cascade,
  role text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  invited_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
create index idx_invitations_email on public.invitations(lower(email));

-- 7. Security-definer helpers (avoid RLS recursion)
create or replace function public.has_agency_access(_user uuid, _agency uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agency_memberships where user_id = _user and agency_id = _agency)
$$;

create or replace function public.has_agency_role(_user uuid, _agency uuid, _role public.agency_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agency_memberships where user_id = _user and agency_id = _agency and role = _role)
$$;

create or replace function public.has_subaccount_access(_user uuid, _sub uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.sub_account_memberships where user_id = _user and sub_account_id = _sub)
    or exists (
      select 1 from public.sub_accounts sa
      join public.agency_memberships am on am.agency_id = sa.agency_id
      where sa.id = _sub and am.user_id = _user
    )
$$;

-- 8. Policies — agencies
create policy "agencies: read if member" on public.agencies for select to authenticated
  using (public.has_agency_access(auth.uid(), id));
create policy "agencies: insert as self-owner" on public.agencies for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "agencies: update by owner" on public.agencies for update to authenticated
  using (public.has_agency_role(auth.uid(), id, 'owner'))
  with check (public.has_agency_role(auth.uid(), id, 'owner'));
create policy "agencies: delete by owner" on public.agencies for delete to authenticated
  using (public.has_agency_role(auth.uid(), id, 'owner'));

-- 9. Policies — sub_accounts
create policy "sub_accounts: read by access" on public.sub_accounts for select to authenticated
  using (public.has_subaccount_access(auth.uid(), id));
create policy "sub_accounts: managed by agency staff" on public.sub_accounts for all to authenticated
  using (public.has_agency_access(auth.uid(), agency_id))
  with check (public.has_agency_access(auth.uid(), agency_id));

-- 10. Policies — agency_memberships
create policy "agency_memberships: read self or co-members" on public.agency_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_agency_access(auth.uid(), agency_id));
-- Bootstrap: when a user creates a new agency, allow inserting their own owner membership
create policy "agency_memberships: bootstrap self" on public.agency_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.agencies a where a.id = agency_id and a.owner_user_id = auth.uid())
  );
create policy "agency_memberships: owner manages" on public.agency_memberships for all to authenticated
  using (public.has_agency_role(auth.uid(), agency_id, 'owner'))
  with check (public.has_agency_role(auth.uid(), agency_id, 'owner'));

-- 11. Policies — sub_account_memberships
create policy "sub_acct_memberships: read self or agency staff" on public.sub_account_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sub_accounts sa
      where sa.id = sub_account_id and public.has_agency_access(auth.uid(), sa.agency_id)
    )
  );
create policy "sub_acct_memberships: managed by agency staff" on public.sub_account_memberships for all to authenticated
  using (exists (
    select 1 from public.sub_accounts sa
    where sa.id = sub_account_id and public.has_agency_access(auth.uid(), sa.agency_id)
  ))
  with check (exists (
    select 1 from public.sub_accounts sa
    where sa.id = sub_account_id and public.has_agency_access(auth.uid(), sa.agency_id)
  ));

-- 12. Policies — invitations
create policy "invitations: read by agency staff" on public.invitations for select to authenticated
  using (public.has_agency_access(auth.uid(), agency_id));
create policy "invitations: managed by agency staff" on public.invitations for all to authenticated
  using (public.has_agency_access(auth.uid(), agency_id))
  with check (public.has_agency_access(auth.uid(), agency_id));

-- ============================================================
-- 13. Add sub_account_id to existing CRM tables (nullable for backfill)
-- ============================================================
alter table public.pipelines       add column sub_account_id uuid references public.sub_accounts(id) on delete cascade;
alter table public.pipeline_stages add column sub_account_id uuid references public.sub_accounts(id) on delete cascade;
alter table public.contacts        add column sub_account_id uuid references public.sub_accounts(id) on delete cascade;
alter table public.deals           add column sub_account_id uuid references public.sub_accounts(id) on delete cascade;

-- 14. Backfill: every existing owner gets a personal agency + default sub-account
do $$
declare u uuid; aid uuid; sid uuid;
begin
  for u in
    select distinct owner_id from (
      select owner_id from public.pipelines
      union select owner_id from public.pipeline_stages
      union select owner_id from public.contacts
      union select owner_id from public.deals
    ) x where owner_id is not null
  loop
    insert into public.agencies (name, owner_user_id) values ('My Agency', u) returning id into aid;
    insert into public.agency_memberships (agency_id, user_id, role) values (aid, u, 'owner');
    insert into public.sub_accounts (agency_id, name) values (aid, 'Default Workspace') returning id into sid;

    update public.pipelines       set sub_account_id = sid where owner_id = u and sub_account_id is null;
    update public.pipeline_stages set sub_account_id = sid where owner_id = u and sub_account_id is null;
    update public.contacts        set sub_account_id = sid where owner_id = u and sub_account_id is null;
    update public.deals           set sub_account_id = sid where owner_id = u and sub_account_id is null;
  end loop;
end $$;

-- 15. Enforce NOT NULL
alter table public.pipelines       alter column sub_account_id set not null;
alter table public.pipeline_stages alter column sub_account_id set not null;
alter table public.contacts        alter column sub_account_id set not null;
alter table public.deals           alter column sub_account_id set not null;

-- 16. Replace owner-based RLS with sub-account-based RLS
drop policy if exists "Pipelines own all" on public.pipelines;
drop policy if exists "Stages own all"    on public.pipeline_stages;
drop policy if exists "Contacts own all"  on public.contacts;
drop policy if exists "Deals own all"     on public.deals;

create policy "pipelines: tenant access" on public.pipelines for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "pipeline_stages: tenant access" on public.pipeline_stages for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "contacts: tenant access" on public.contacts for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "deals: tenant access" on public.deals for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

-- ============================================================
-- 17. Auto-provision agency + default sub-account on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare aid uuid; sid uuid; display text;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  display := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,'user'), '@', 1));
  insert into public.agencies (name, owner_user_id)
  values (display || '''s Agency', new.id)
  returning id into aid;

  insert into public.agency_memberships (agency_id, user_id, role) values (aid, new.id, 'owner');
  insert into public.sub_accounts (agency_id, name) values (aid, 'Default Workspace') returning id into sid;

  return new;
end $$;
