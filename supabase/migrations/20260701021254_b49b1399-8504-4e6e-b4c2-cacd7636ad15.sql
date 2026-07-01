-- ============ sub_account_integrations ============
create table public.sub_account_integrations (
  sub_account_id uuid primary key references public.sub_accounts(id) on delete cascade,
  email_provider text check (email_provider in ('smtp','resend','sendgrid')),
  email_config jsonb not null default '{}'::jsonb,
  email_from_address text,
  email_from_name text,
  email_verified_at timestamptz,
  sms_provider text check (sms_provider in ('twilio')),
  sms_config jsonb not null default '{}'::jsonb,
  sms_from_number text,
  sms_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

grant select, insert, update, delete on public.sub_account_integrations to authenticated;
grant all on public.sub_account_integrations to service_role;

alter table public.sub_account_integrations enable row level security;

-- Only owner/admin of the containing agency can read/write
create policy "integrations readable by agency admins"
on public.sub_account_integrations for select to authenticated
using (
  exists (
    select 1 from public.sub_accounts sa
    join public.agency_memberships am on am.agency_id = sa.agency_id
    where sa.id = sub_account_integrations.sub_account_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin')
  )
);

create policy "integrations writable by agency admins"
on public.sub_account_integrations for all to authenticated
using (
  exists (
    select 1 from public.sub_accounts sa
    join public.agency_memberships am on am.agency_id = sa.agency_id
    where sa.id = sub_account_integrations.sub_account_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.sub_accounts sa
    join public.agency_memberships am on am.agency_id = sa.agency_id
    where sa.id = sub_account_integrations.sub_account_id
      and am.user_id = auth.uid()
      and am.role in ('owner','admin')
  )
);

create trigger tg_integrations_updated_at
before update on public.sub_account_integrations
for each row execute function public.tg_set_updated_at();

-- ============ outbound_messages queue ============
create type public.outbound_channel as enum ('email','sms');
create type public.outbound_status as enum ('queued','sending','sent','failed');

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  channel public.outbound_channel not null,
  status public.outbound_status not null default 'queued',
  to_address text not null,
  subject text,
  body_text text,
  body_html text,
  contact_id uuid references public.contacts(id) on delete set null,
  workflow_id uuid references public.workflows(id) on delete set null,
  provider text,
  provider_message_id text,
  error text,
  attempts int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now()
);

create index outbound_messages_queue_idx on public.outbound_messages (status, next_attempt_at);
create index outbound_messages_sub_idx on public.outbound_messages (sub_account_id, created_at desc);

grant select, insert, update, delete on public.outbound_messages to authenticated;
grant all on public.outbound_messages to service_role;

alter table public.outbound_messages enable row level security;

create policy "outbound readable by sub-account access"
on public.outbound_messages for select to authenticated
using (public.has_subaccount_access(auth.uid(), sub_account_id));

create policy "outbound insertable by sub-account access"
on public.outbound_messages for insert to authenticated
with check (public.has_subaccount_access(auth.uid(), sub_account_id));

-- ============ extend run_workflows() for send_email / send_sms ============
create or replace function public.run_workflows(_trigger public.workflow_trigger, _sub uuid, _row_id uuid, _payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wf record;
  act jsonb;
  new_task_id uuid;
  owner uuid;
  contact_row public.contacts%rowtype;
  recipient text;
begin
  for wf in
    select * from public.workflows
     where sub_account_id = _sub
       and trigger_type = _trigger
       and enabled = true
  loop
    begin
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

      for act in select * from jsonb_array_elements(wf.actions) loop
        case act->>'type'
          when 'create_task' then
            owner := coalesce((_payload->>'owner_id')::uuid, wf.created_by);
            insert into public.tasks (
              sub_account_id, created_by, assigned_to, contact_id, deal_id,
              title, priority, due_at
            ) values (
              _sub, wf.created_by, owner,
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

          when 'send_email' then
            -- resolve recipient: explicit act.to, or contact email lookup
            recipient := act->>'to';
            if recipient is null and (_payload ? 'contact_id') then
              select email into recipient from public.contacts where id = (_payload->>'contact_id')::uuid;
            end if;
            if recipient is not null and recipient <> '' then
              insert into public.outbound_messages (
                sub_account_id, channel, to_address, subject, body_html, body_text,
                contact_id, workflow_id, created_by
              ) values (
                _sub, 'email', recipient,
                coalesce(act->>'subject', wf.name),
                act->>'body_html',
                act->>'body_text',
                case when _payload ? 'contact_id' then (_payload->>'contact_id')::uuid else null end,
                wf.id, wf.created_by
              );
            end if;

          when 'send_sms' then
            recipient := act->>'to';
            if recipient is null and (_payload ? 'contact_id') then
              select phone into recipient from public.contacts where id = (_payload->>'contact_id')::uuid;
            end if;
            if recipient is not null and recipient <> '' then
              insert into public.outbound_messages (
                sub_account_id, channel, to_address, body_text,
                contact_id, workflow_id, created_by
              ) values (
                _sub, 'sms', recipient,
                coalesce(act->>'body', wf.name),
                case when _payload ? 'contact_id' then (_payload->>'contact_id')::uuid else null end,
                wf.id, wf.created_by
              );
            end if;

          else
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
end $function$;