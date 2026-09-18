CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_workspace_access" ON public.clients;
CREATE POLICY "clients_workspace_access" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

DROP TRIGGER IF EXISTS clients_touch ON public.clients;
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS clients_sub_idx ON public.clients(sub_account_id);

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS signed_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_deals_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    perform public.run_workflows(
      'deal.created'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'deal_id', new.id,
        'owner_id', new.owner_id,
        'stage_id', new.stage_id,
        'contact_id', new.contact_id
      )
    );
  elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
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

  if tg_op = 'UPDATE' and old.signed_at is null and new.signed_at is not null then
    perform public.run_workflows(
      'deal.signed'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'deal_id', new.id,
        'owner_id', new.owner_id,
        'stage_id', new.stage_id,
        'contact_id', new.contact_id
      )
    );
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.run_workflows(_trigger workflow_trigger, _sub uuid, _row_id uuid, _payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  wf record;
  act jsonb;
  new_task_id uuid;
  owner uuid;
  contact_row public.contacts%rowtype;
  deal_row public.deals%rowtype;
  recipient text;
  ctx jsonb;
  cid uuid;
  did uuid;
  send_at timestamptz;
  delay_min int;
  respect_quiet boolean;
  existing_client uuid;
  new_client uuid;
  client_label text;
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

      cid := null;
      did := null;
      if _trigger like 'contact.%' then
        cid := _row_id;
      elsif _trigger in ('deal.stage_changed', 'deal.created', 'deal.signed') then
        did := _row_id;
        cid := (_payload->>'contact_id')::uuid;
      elsif _payload ? 'contact_id' then
        cid := (_payload->>'contact_id')::uuid;
      end if;

      contact_row := null;
      deal_row := null;
      if cid is not null then
        select * into contact_row from public.contacts where id = cid;
      end if;
      if did is not null then
        select * into deal_row from public.deals where id = did;
      end if;

      ctx := jsonb_build_object(
        'workflow', jsonb_build_object('name', wf.name),
        'contact', case when contact_row.id is not null then jsonb_build_object(
          'first_name', contact_row.first_name,
          'last_name', contact_row.last_name,
          'full_name', trim(both ' ' from concat_ws(' ', contact_row.first_name, contact_row.last_name)),
          'email', contact_row.email,
          'phone', contact_row.phone,
          'company', contact_row.company
        ) else '{}'::jsonb end,
        'deal', case when deal_row.id is not null then jsonb_build_object(
          'name', deal_row.name,
          'amount', deal_row.amount
        ) else '{}'::jsonb end
      );

      for act in select * from jsonb_array_elements(wf.actions) loop
        delay_min := coalesce((act->>'delay_minutes')::int, 0);
        respect_quiet := coalesce((act->>'respect_quiet_hours')::boolean, true);
        send_at := now() + make_interval(mins => delay_min);
        if respect_quiet then
          send_at := public.next_send_time(_sub, send_at);
        end if;

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
              case when _trigger in ('deal.stage_changed', 'deal.created', 'deal.signed') then _row_id else null end,
              public.render_merge_tags(coalesce(act->>'title', 'Follow up'), ctx),
              coalesce((act->>'priority')::public.task_priority, 'medium'),
              case when (act->>'due_in_days') is not null
                   then now() + ((act->>'due_in_days')::int || ' days')::interval
                   else null end
            ) returning id into new_task_id;

          when 'create_client' then
            if deal_row.id is not null then
              client_label := nullif(trim(both ' ' from coalesce(
                contact_row.company,
                concat_ws(' ', contact_row.first_name, contact_row.last_name)
              )), '');
              client_label := coalesce(client_label, deal_row.name, 'New client');

              existing_client := null;
              if contact_row.id is not null then
                select id into existing_client from public.clients
                 where sub_account_id = _sub and contact_id = contact_row.id
                 limit 1;
              end if;
              if existing_client is null then
                select id into existing_client from public.clients
                 where sub_account_id = _sub and lower(name) = lower(client_label)
                 limit 1;
              end if;

              if existing_client is null then
                insert into public.clients (
                  sub_account_id, contact_id, name, company, email, phone, created_by
                ) values (
                  _sub, contact_row.id, client_label, contact_row.company,
                  contact_row.email, contact_row.phone, wf.created_by
                ) returning id into new_client;
                existing_client := new_client;
              end if;

              update public.deals set client_id = existing_client
               where id = deal_row.id and client_id is distinct from existing_client;
            end if;

          when 'set_contact_stage' then
            if _trigger like 'contact.%' then
              update public.contacts
                 set lifecycle_stage = (act->>'stage')::public.contact_lifecycle_stage
               where id = _row_id;
            end if;

          when 'add_contact_tag' then
            if _trigger like 'contact.%' then
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
              public.render_merge_tags(coalesce(act->>'title', wf.name), ctx),
              public.render_merge_tags(act->>'body', ctx),
              act->>'link'
            );

          when 'send_email' then
            recipient := act->>'to';
            if recipient is null and contact_row.email is not null then
              recipient := contact_row.email;
            end if;
            if recipient is not null and recipient <> '' then
              insert into public.outbound_messages (
                sub_account_id, channel, to_address, subject, body_html, body_text,
                contact_id, workflow_id, created_by, scheduled_at, send_after_quiet_hours
              ) values (
                _sub, 'email', recipient,
                public.render_merge_tags(coalesce(act->>'subject', wf.name), ctx),
                public.render_merge_tags(act->>'body_html', ctx),
                public.render_merge_tags(act->>'body_text', ctx),
                case when contact_row.id is not null then contact_row.id else null end,
                wf.id, wf.created_by,
                send_at, respect_quiet
              );
            end if;

          when 'send_sms' then
            recipient := act->>'to';
            if recipient is null and contact_row.phone is not null then
              recipient := contact_row.phone;
            end if;
            if recipient is not null and recipient <> '' then
              insert into public.outbound_messages (
                sub_account_id, channel, to_address, body_text,
                contact_id, workflow_id, created_by, scheduled_at, send_after_quiet_hours
              ) values (
                _sub, 'sms', recipient,
                public.render_merge_tags(coalesce(act->>'body', wf.name), ctx),
                case when contact_row.id is not null then contact_row.id else null end,
                wf.id, wf.created_by,
                send_at, respect_quiet
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