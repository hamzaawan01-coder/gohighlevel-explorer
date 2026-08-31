-- 1. deal_files: allow the uploader to edit their own file metadata (workspace-scoped).
DROP POLICY IF EXISTS "Uploader can update their deal files" ON public.deal_files;
CREATE POLICY "Uploader can update their deal files"
  ON public.deal_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid() AND public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (uploaded_by = auth.uid() AND public.has_subaccount_access(auth.uid(), sub_account_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_files TO authenticated;
GRANT ALL ON public.deal_files TO service_role;
REVOKE ALL ON public.deal_files FROM anon;

-- 2. workflow_runs: read-only for app users, written only by internal automation.
REVOKE ALL ON public.workflow_runs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.workflow_runs FROM authenticated;
GRANT SELECT ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;

-- 3. twilio_connections: admin-only, no anonymous access at all.
REVOKE ALL ON public.twilio_connections FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twilio_connections TO authenticated;
GRANT ALL ON public.twilio_connections TO service_role;
