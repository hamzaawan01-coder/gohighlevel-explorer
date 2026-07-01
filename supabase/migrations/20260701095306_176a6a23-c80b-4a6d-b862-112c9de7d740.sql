-- Revoke direct execute from client roles on internal SECURITY DEFINER functions.
-- Triggers still fire (they run as table owner) and RLS policies still call these
-- helpers internally — only direct RPC / PostgREST invocation is blocked.

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.tg_set_updated_at()',
    'public.tg_bump_conversation()',
    'public.tg_contacts_workflow()',
    'public.tg_deals_workflow()',
    'public.tg_tasks_workflow()',
    'public.tg_form_submissions_workflow()',
    'public.handle_new_user()',
    'public.run_workflows(public.workflow_trigger, uuid, uuid, jsonb)',
    'public.scan_time_workflows()',
    'public.list_agency_members(uuid)',
    'public.has_role(uuid, public.app_role)',
    'public.has_agency_role(uuid, uuid, public.agency_role)',
    'public.has_agency_access(uuid, uuid)',
    'public.has_subaccount_access(uuid, uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- Keep RPC-callable invitation helpers reachable by signed-in users.
GRANT EXECUTE ON FUNCTION public.preview_invitation(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text)  TO authenticated;