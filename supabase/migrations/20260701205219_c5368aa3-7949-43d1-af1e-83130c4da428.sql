-- Phase 3: Scheduled sends + quiet hours

-- 1) Add scheduled_at + status flag to outbound_messages
ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_after_quiet_hours boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS outbound_messages_scheduled_at_idx
  ON public.outbound_messages (scheduled_at)
  WHERE sent_at IS NULL;

-- 2) Quiet-hours config on sub_accounts (per-workspace default)
ALTER TABLE public.sub_accounts
  ADD COLUMN IF NOT EXISTS quiet_hours_start smallint NOT NULL DEFAULT 21, -- 9 PM
  ADD COLUMN IF NOT EXISTS quiet_hours_end   smallint NOT NULL DEFAULT 8,  -- 8 AM
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false;

-- 3) Per-workflow delay/schedule config already lives in action jsonb (delay_minutes)
--    Update run_workflows to honor delay + schedule + quiet hours for send_email / send_sms

CREATE OR REPLACE FUNCTION public.in_quiet_hours(_sub uuid, _at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sa public.sub_accounts%rowtype;
  local_hour int;
BEGIN
  SELECT * INTO sa FROM public.sub_accounts WHERE id = _sub;
  IF NOT FOUND OR sa.quiet_hours_enabled IS NOT TRUE THEN
    RETURN false;
  END IF;
  local_hour := EXTRACT(HOUR FROM (_at AT TIME ZONE COALESCE(sa.quiet_hours_timezone, 'UTC')))::int;
  IF sa.quiet_hours_start = sa.quiet_hours_end THEN
    RETURN false;
  ELSIF sa.quiet_hours_start < sa.quiet_hours_end THEN
    RETURN local_hour >= sa.quiet_hours_start AND local_hour < sa.quiet_hours_end;
  ELSE
    -- wraps midnight, e.g. 21 -> 8
    RETURN local_hour >= sa.quiet_hours_start OR local_hour < sa.quiet_hours_end;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.next_send_time(_sub uuid, _at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sa public.sub_accounts%rowtype;
  candidate timestamptz := _at;
  local_ts timestamptz;
  local_hour int;
  end_hour int;
BEGIN
  SELECT * INTO sa FROM public.sub_accounts WHERE id = _sub;
  IF NOT FOUND OR sa.quiet_hours_enabled IS NOT TRUE THEN
    RETURN _at;
  END IF;
  IF NOT public.in_quiet_hours(_sub, _at) THEN
    RETURN _at;
  END IF;
  local_ts := _at AT TIME ZONE COALESCE(sa.quiet_hours_timezone, 'UTC');
  local_hour := EXTRACT(HOUR FROM local_ts)::int;
  end_hour := sa.quiet_hours_end;
  -- Advance local_ts to next occurrence of end_hour:00
  IF local_hour < end_hour THEN
    local_ts := date_trunc('day', local_ts) + make_interval(hours => end_hour);
  ELSE
    local_ts := date_trunc('day', local_ts) + make_interval(days => 1, hours => end_hour);
  END IF;
  RETURN local_ts AT TIME ZONE COALESCE(sa.quiet_hours_timezone, 'UTC');
END $$;

-- 4) Extend run_workflows: honor per-action delay_minutes and quiet hours for messages
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
      elsif _trigger = 'deal.stage_changed' or _trigger = 'deal.created' then
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
              case when _trigger = 'deal.stage_changed' or _trigger = 'deal.created' then _row_id else null end,
              public.render_merge_tags(coalesce(act->>'title', 'Follow up'), ctx),
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
