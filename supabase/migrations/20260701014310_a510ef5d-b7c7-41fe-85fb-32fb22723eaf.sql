
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Scanner: iterates enabled time-based workflows and fires run_workflows once per matching row per window
CREATE OR REPLACE FUNCTION public.scan_time_workflows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wf record;
  r  record;
  hrs int;
  dys int;
BEGIN
  -- task.due_soon: tasks with due_at within N hours (default 24), not done
  FOR wf IN
    SELECT * FROM public.workflows
    WHERE enabled = true AND trigger_type = 'task.due_soon'
  LOOP
    hrs := COALESCE((wf.trigger_config->>'hours')::int, 24);
    FOR r IN
      SELECT t.* FROM public.tasks t
      WHERE t.sub_account_id = wf.sub_account_id
        AND t.status <> 'done'
        AND t.due_at IS NOT NULL
        AND t.due_at <= now() + make_interval(hours => hrs)
        AND t.due_at >  now() - make_interval(hours => hrs)
        AND NOT EXISTS (
          SELECT 1 FROM public.workflow_runs wr
          WHERE wr.workflow_id = wf.id
            AND wr.trigger_row_id = t.id
            AND wr.ran_at > now() - make_interval(hours => hrs)
        )
    LOOP
      PERFORM public.run_workflows(
        'task.due_soon'::public.workflow_trigger,
        wf.sub_account_id,
        r.id,
        jsonb_build_object(
          'task_id', r.id,
          'contact_id', r.contact_id,
          'deal_id', r.deal_id,
          'owner_id', r.assigned_to,
          'due_at', r.due_at
        )
      );
    END LOOP;
  END LOOP;

  -- contact.stale: contacts with no updated_at activity in N days (default 30)
  FOR wf IN
    SELECT * FROM public.workflows
    WHERE enabled = true AND trigger_type = 'contact.stale'
  LOOP
    dys := COALESCE((wf.trigger_config->>'days')::int, 30);
    FOR r IN
      SELECT c.* FROM public.contacts c
      WHERE c.sub_account_id = wf.sub_account_id
        AND c.updated_at < now() - make_interval(days => dys)
        AND NOT EXISTS (
          SELECT 1 FROM public.workflow_runs wr
          WHERE wr.workflow_id = wf.id
            AND wr.trigger_row_id = c.id
            AND wr.ran_at > now() - make_interval(days => dys)
        )
    LOOP
      PERFORM public.run_workflows(
        'contact.stale'::public.workflow_trigger,
        wf.sub_account_id,
        r.id,
        jsonb_build_object(
          'contact_id', r.id,
          'owner_id', r.owner_id,
          'stale_since', r.updated_at
        )
      );
    END LOOP;
  END LOOP;
END $$;

-- Lock down: only cron/service_role runs this
REVOKE ALL ON FUNCTION public.scan_time_workflows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_time_workflows() TO service_role, postgres;

-- Schedule every 15 minutes (unschedule prior if exists)
DO $$
BEGIN
  PERFORM cron.unschedule('scan-time-workflows');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'scan-time-workflows',
  '*/15 * * * *',
  $$ SELECT public.scan_time_workflows(); $$
);
