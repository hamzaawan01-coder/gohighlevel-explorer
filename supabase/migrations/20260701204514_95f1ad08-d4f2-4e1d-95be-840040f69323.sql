
-- 1. Merge-tag renderer: replaces {{path.to.value}} with jsonb-lookup values.
CREATE OR REPLACE FUNCTION public.render_merge_tags(_tpl text, _ctx jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  out_text text := _tpl;
  m text;
  path_parts text[];
  cur jsonb;
  val text;
BEGIN
  IF _tpl IS NULL OR _ctx IS NULL THEN
    RETURN _tpl;
  END IF;
  FOR m IN
    SELECT DISTINCT (regexp_matches(_tpl, '\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}', 'g'))[1]
  LOOP
    path_parts := string_to_array(m, '.');
    cur := _ctx;
    val := NULL;
    FOR i IN 1..array_length(path_parts, 1) LOOP
      IF cur IS NULL OR jsonb_typeof(cur) <> 'object' THEN
        cur := NULL;
        EXIT;
      END IF;
      cur := cur -> path_parts[i];
    END LOOP;
    IF cur IS NOT NULL AND jsonb_typeof(cur) <> 'null' THEN
      IF jsonb_typeof(cur) = 'string' THEN
        val := cur #>> '{}';
      ELSE
        val := cur::text;
      END IF;
    END IF;
    out_text := replace(out_text, '{{' || m || '}}', COALESCE(val, ''));
    -- also handle spaced form
    out_text := regexp_replace(out_text, '\{\{\s*' || m || '\s*\}\}', COALESCE(val, ''), 'g');
  END LOOP;
  RETURN out_text;
END $$;

-- 2. Update the workflow runner to substitute tokens in message action fields.
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

      -- Resolve context for merge tags: contact (if any) + deal (if any) + workflow
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
                contact_id, workflow_id, created_by
              ) values (
                _sub, 'email', recipient,
                public.render_merge_tags(coalesce(act->>'subject', wf.name), ctx),
                public.render_merge_tags(act->>'body_html', ctx),
                public.render_merge_tags(act->>'body_text', ctx),
                case when contact_row.id is not null then contact_row.id else null end,
                wf.id, wf.created_by
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
                contact_id, workflow_id, created_by
              ) values (
                _sub, 'sms', recipient,
                public.render_merge_tags(coalesce(act->>'body', wf.name), ctx),
                case when contact_row.id is not null then contact_row.id else null end,
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
