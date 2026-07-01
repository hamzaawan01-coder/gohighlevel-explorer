-- 1) invitations: restrict SELECT to owners/admins only
DROP POLICY IF EXISTS "invitations: read by agency staff" ON public.invitations;
DROP POLICY IF EXISTS "invitations: staff can select"    ON public.invitations;
CREATE POLICY "invitations: owners/admins can select"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::public.agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::public.agency_role)
  );

-- Also tighten UPDATE/DELETE to admins/owners for consistency
DROP POLICY IF EXISTS "invitations: staff can update" ON public.invitations;
CREATE POLICY "invitations: owners/admins can update"
  ON public.invitations FOR UPDATE
  TO authenticated
  USING (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::public.agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::public.agency_role)
  );

DROP POLICY IF EXISTS "invitations: staff can delete" ON public.invitations;
CREATE POLICY "invitations: owners/admins can delete"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (
    public.has_agency_role(auth.uid(), agency_id, 'owner'::public.agency_role)
    OR public.has_agency_role(auth.uid(), agency_id, 'admin'::public.agency_role)
  );

-- 2) ad_platform_connections: hide refresh_token column from clients
REVOKE SELECT (refresh_token) ON public.ad_platform_connections FROM anon, authenticated;
-- service_role retains full access via GRANT ALL

-- 3) storage.objects: deal-files DELETE requires sub-account access
DROP POLICY IF EXISTS "Uploader can delete deal files" ON storage.objects;
CREATE POLICY "Uploader can delete deal files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'deal-files'
    AND owner = auth.uid()
    AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- 4) form_submissions: allow anonymous submissions to enabled forms
DROP POLICY IF EXISTS "form_submissions: public insert enabled" ON public.form_submissions;
CREATE POLICY "form_submissions: public insert enabled"
  ON public.form_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lead_forms lf
      WHERE lf.id = form_submissions.form_id
        AND lf.enabled = true
        AND lf.sub_account_id = form_submissions.sub_account_id
    )
  );
GRANT INSERT ON public.form_submissions TO anon;

-- 5) preview_invitation: revoke anon EXECUTE (require sign-in to preview)
REVOKE EXECUTE ON FUNCTION public.preview_invitation(text) FROM anon, PUBLIC;
-- authenticated retains EXECUTE from the previous migration