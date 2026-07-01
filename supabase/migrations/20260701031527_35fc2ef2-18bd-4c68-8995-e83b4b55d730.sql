
-- 1) Restrict anon column access on lead_forms so public form-render endpoints
--    only expose fields needed for rendering. Row filter (enabled=true) is
--    already enforced by RLS policy.
REVOKE SELECT ON public.lead_forms FROM anon;
GRANT SELECT (id, slug, name, description, fields, success_message, redirect_url, enabled)
  ON public.lead_forms TO anon;

-- 2) Revoke public EXECUTE on the form-submissions trigger function. It is only
--    invoked internally by the trigger, never by API callers.
REVOKE EXECUTE ON FUNCTION public.tg_form_submissions_workflow() FROM anon, public;
