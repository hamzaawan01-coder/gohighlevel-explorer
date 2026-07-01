
create table public.deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size bigint not null default 0,
  content_type text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.deal_files to authenticated;
grant all on public.deal_files to service_role;

alter table public.deal_files enable row level security;

create policy "Members can view deal files in their workspace"
  on public.deal_files for select to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "Members can upload deal files in their workspace"
  on public.deal_files for insert to authenticated
  with check (
    public.has_subaccount_access(auth.uid(), sub_account_id)
    and uploaded_by = auth.uid()
  );

create policy "Uploader can delete their deal files"
  on public.deal_files for delete to authenticated
  using (uploaded_by = auth.uid());

create index deal_files_deal_idx on public.deal_files(deal_id, created_at desc);
