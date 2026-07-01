
-- 1) Lock down internal SECURITY DEFINER functions from authenticated callers.
-- These are invoked by triggers / cron / auth hooks only.
revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;
revoke execute on function public.tg_bump_conversation() from public, anon, authenticated;
revoke execute on function public.tg_tasks_workflow() from public, anon, authenticated;
revoke execute on function public.tg_contacts_workflow() from public, anon, authenticated;
revoke execute on function public.tg_deals_workflow() from public, anon, authenticated;
revoke execute on function public.tg_form_submissions_workflow() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.scan_time_workflows() from public, anon, authenticated;
revoke execute on function public.run_workflows(public.workflow_trigger, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- 2) Drop anon public read on lead_forms. Public form rendering will go through
-- /api/public/forms/$slug (GET) using the service-role server client, which
-- projects only the safe columns.
drop policy if exists "Public can view enabled forms" on public.lead_forms;
drop policy if exists "public_lead_forms_anon_safe_columns" on public.lead_forms;
drop policy if exists "Public can view enabled forms (safe columns)" on public.lead_forms;

revoke select on public.lead_forms from anon;
