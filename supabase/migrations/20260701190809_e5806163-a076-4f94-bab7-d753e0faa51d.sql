
-- 1) lead_forms: limit anon SELECT to safe columns only
DROP POLICY IF EXISTS "Public can view enabled forms" ON public.lead_forms;

REVOKE SELECT ON public.lead_forms FROM anon;
GRANT SELECT (id, slug, name, description, fields, success_message, redirect_url, enabled)
  ON public.lead_forms TO anon;

CREATE POLICY "Public can view enabled forms"
  ON public.lead_forms
  FOR SELECT
  TO anon
  USING (enabled = true);

-- 2) trigger_link_clicks: require the trigger link to be enabled
DROP POLICY IF EXISTS "trigger_link_clicks: anon insert valid" ON public.trigger_link_clicks;

CREATE POLICY "trigger_link_clicks: anon insert valid"
  ON public.trigger_link_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trigger_links tl
      WHERE tl.id = trigger_link_clicks.link_id
        AND tl.sub_account_id = trigger_link_clicks.sub_account_id
        AND tl.enabled = true
    )
  );
