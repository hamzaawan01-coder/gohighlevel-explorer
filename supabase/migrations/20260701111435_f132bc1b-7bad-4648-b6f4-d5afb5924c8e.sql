DROP VIEW IF EXISTS public.lead_forms_public;

-- Restore a narrow anon SELECT policy on the base table.
DROP POLICY IF EXISTS "Public can view enabled forms" ON public.lead_forms;
CREATE POLICY "Public can view enabled forms"
  ON public.lead_forms
  FOR SELECT
  TO anon
  USING (enabled = true);

-- Column-level grant: anon can only select safe columns.
-- Authenticated role keeps the workspace-scoped ALL policy already in place.
REVOKE SELECT ON public.lead_forms FROM anon;
GRANT SELECT (id, slug, name, description, fields, success_message, redirect_url, enabled)
  ON public.lead_forms TO anon;