-- Lifecycle stage enum for contacts
create type public.contact_lifecycle_stage as enum ('lead','mql','sql','customer','lost');

alter table public.contacts
  add column lifecycle_stage public.contact_lifecycle_stage not null default 'lead',
  add column lead_source text;

create index contacts_lifecycle_stage_idx on public.contacts (sub_account_id, lifecycle_stage);

-- Tasks
create type public.task_status as enum ('open','in_progress','done','cancelled');
create type public.task_priority as enum ('low','medium','high','urgent');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'open',
  priority public.task_priority not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_sub_account_idx on public.tasks (sub_account_id, status, due_at);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_contact_idx on public.tasks (contact_id);
create index tasks_deal_idx on public.tasks (deal_id);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;

create policy "tasks: sub-account members can select"
  on public.tasks for select to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "tasks: sub-account members can insert"
  on public.tasks for insert to authenticated
  with check (
    public.has_subaccount_access(auth.uid(), sub_account_id)
    and created_by = auth.uid()
  );

create policy "tasks: sub-account members can update"
  on public.tasks for update to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "tasks: sub-account members can delete"
  on public.tasks for delete to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.tg_set_updated_at();
