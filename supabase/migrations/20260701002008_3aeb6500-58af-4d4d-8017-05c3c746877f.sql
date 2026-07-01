-- =========================================================
-- Workflows + automation
-- =========================================================
create type public.workflow_trigger as enum (
  'contact.created',
  'contact.stage_changed',
  'deal.stage_changed',
  'task.completed'
);

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  trigger_type public.workflow_trigger not null,
  trigger_config jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflows_sub_trigger_idx on public.workflows (sub_account_id, trigger_type, enabled);

grant select, insert, update, delete on public.workflows to authenticated;
grant all on public.workflows to service_role;
alter table public.workflows enable row level security;

create policy "workflows: sub-account members select"
  on public.workflows for select to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));
create policy "workflows: sub-account members insert"
  on public.workflows for insert to authenticated
  with check (public.has_subaccount_access(auth.uid(), sub_account_id) and created_by = auth.uid());
create policy "workflows: sub-account members update"
  on public.workflows for update to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));
create policy "workflows: sub-account members delete"
  on public.workflows for delete to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger workflows_set_updated_at
  before update on public.workflows
  for each row execute function public.tg_set_updated_at();

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  trigger_row_id uuid,
  status text not null default 'ok',
  error text,
  payload jsonb,
  ran_at timestamptz not null default now()
);
create index workflow_runs_workflow_idx on public.workflow_runs (workflow_id, ran_at desc);
create index workflow_runs_sub_idx on public.workflow_runs (sub_account_id, ran_at desc);

grant select on public.workflow_runs to authenticated;
grant all on public.workflow_runs to service_role;
alter table public.workflow_runs enable row level security;
create policy "workflow_runs: sub-account members select"
  on public.workflow_runs for select to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));

-- =========================================================
-- Notifications (personal, per-user)
-- =========================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sub_account_id uuid references public.sub_accounts(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create policy "notifications: recipient select"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: recipient update"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- =========================================================
-- Conversations + messages (internal notes)
-- =========================================================
create type public.message_kind as enum ('note','email_log','sms_log');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id)
);
create index conversations_sub_idx on public.conversations (sub_account_id, last_message_at desc nulls last);

grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "conversations: sub-account members all"
  on public.conversations for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.tg_set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  author_user_id uuid references auth.users(id),
  kind public.message_kind not null default 'note',
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

grant select, insert, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create policy "messages: sub-account members select"
  on public.messages for select to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));
create policy "messages: sub-account members insert"
  on public.messages for insert to authenticated
  with check (
    public.has_subaccount_access(auth.uid(), sub_account_id)
    and (author_user_id is null or author_user_id = auth.uid())
  );
create policy "messages: authors delete own"
  on public.messages for delete to authenticated
  using (author_user_id = auth.uid());

-- Bump conversation.last_message_at when a message is inserted
create or replace function public.tg_bump_conversation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.tg_bump_conversation();

-- =========================================================
-- Calendar events
-- =========================================================
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_sub_start_idx on public.calendar_events (sub_account_id, starts_at);

grant select, insert, update, delete on public.calendar_events to authenticated;
grant all on public.calendar_events to service_role;
alter table public.calendar_events enable row level security;
create policy "calendar_events: sub-account members all"
  on public.calendar_events for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- Workflow dispatcher + row triggers
-- =========================================================
create or replace function public.run_workflows(
  _trigger public.workflow_trigger,
  _sub uuid,
  _row_id uuid,
  _payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  wf record;
  act jsonb;
  new_task_id uuid;
  owner uuid;
  contact_row public.contacts%rowtype;
begin
  for wf in
    select * from public.workflows
     where sub_account_id = _sub
       and trigger_type = _trigger
       and enabled = true
  loop
    begin
      -- Trigger-level condition filtering
      if _trigger = 'contact.stage_changed' then
        if wf.trigger_config ? 'to_stage'
           and (_payload->>'new_stage') is distinct from (wf.trigger_config->>'to_stage') then
          continue;
        end if;
      elsif _trigger = 'deal.stage_changed' then
        if wf.trigger_config ? 'stage_id'
           and (_payload->>'new_stage_id') is distinct from (wf.trigger_config->>'stage_id') then
          continue;
        end if;
      end if;

      -- Execute actions in order
      for act in select * from jsonb_array_elements(wf.actions) loop
        case act->>'type'
          when 'create_task' then
            owner := coalesce((_payload->>'owner_id')::uuid, wf.created_by);
            insert into public.tasks (
              sub_account_id, created_by, assigned_to, contact_id, deal_id,
              title, priority, due_at
            ) values (
              _sub,
              wf.created_by,
              owner,
              case when _trigger like 'contact.%' then _row_id
                   when _trigger = 'task.completed' then (_payload->>'contact_id')::uuid
                   else null end,
              case when _trigger = 'deal.stage_changed' then _row_id else null end,
              coalesce(act->>'title', 'Follow up'),
              coalesce((act->>'priority')::public.task_priority, 'medium'),
              case when (act->>'due_in_days') is not null
                   then now() + ((act->>'due_in_days')::int || ' days')::interval
                   else null end
            ) returning id into new_task_id;

          when 'set_contact_stage' then
            if _trigger like 'contact.%' then
              update public.contacts
                 set lifecycle_stage = (act->>'stage')::public.contact_lifecycle_stage
               where id = _row_id;
            end if;

          when 'add_contact_tag' then
            if _trigger like 'contact.%' then
              select * into contact_row from public.contacts where id = _row_id;
              if contact_row.id is not null and not (contact_row.tags @> array[act->>'tag']) then
                update public.contacts
                   set tags = array_append(coalesce(tags, '{}'::text[]), act->>'tag')
                 where id = _row_id;
              end if;
            end if;

          when 'create_notification' then
            insert into public.notifications (user_id, sub_account_id, title, body, link)
            values (
              coalesce((act->>'user_id')::uuid, wf.created_by),
              _sub,
              coalesce(act->>'title', wf.name),
              act->>'body',
              act->>'link'
            );

          else
            -- unknown action, ignore
            null;
        end case;
      end loop;

      insert into public.workflow_runs (workflow_id, sub_account_id, trigger_row_id, status, payload)
      values (wf.id, _sub, _row_id, 'ok', _payload);
    exception when others then
      insert into public.workflow_runs (workflow_id, sub_account_id, trigger_row_id, status, error, payload)
      values (wf.id, _sub, _row_id, 'error', SQLERRM, _payload);
    end;
  end loop;
end $fn$;

revoke all on function public.run_workflows(public.workflow_trigger, uuid, uuid, jsonb) from public, anon, authenticated;

-- Row triggers
create or replace function public.tg_contacts_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.run_workflows(
      'contact.created'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object('contact_id', new.id, 'owner_id', new.owner_id)
    );
  elsif tg_op = 'UPDATE' and new.lifecycle_stage is distinct from old.lifecycle_stage then
    perform public.run_workflows(
      'contact.stage_changed'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'contact_id', new.id,
        'owner_id', new.owner_id,
        'old_stage', old.lifecycle_stage,
        'new_stage', new.lifecycle_stage
      )
    );
  end if;
  return new;
end $$;

create trigger contacts_workflow
  after insert or update on public.contacts
  for each row execute function public.tg_contacts_workflow();

create or replace function public.tg_deals_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    perform public.run_workflows(
      'deal.stage_changed'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'deal_id', new.id,
        'owner_id', new.owner_id,
        'old_stage_id', old.stage_id,
        'new_stage_id', new.stage_id,
        'contact_id', new.contact_id
      )
    );
  end if;
  return new;
end $$;

create trigger deals_workflow
  after update on public.deals
  for each row execute function public.tg_deals_workflow();

create or replace function public.tg_tasks_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'done'
     and old.status is distinct from 'done' then
    perform public.run_workflows(
      'task.completed'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'task_id', new.id,
        'contact_id', new.contact_id,
        'deal_id', new.deal_id,
        'owner_id', new.assigned_to
      )
    );
  end if;
  return new;
end $$;

create trigger tasks_workflow
  after update on public.tasks
  for each row execute function public.tg_tasks_workflow();
