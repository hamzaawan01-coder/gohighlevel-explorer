-- Fix 1: Revoke anon access to preview_invitation (leaks PII)
REVOKE EXECUTE ON FUNCTION public.preview_invitation(text) FROM anon;

-- Fix 2: Prevent privilege escalation via owner-role invitations
-- Drop existing broad insert policy and replace with role-gated policies
DROP POLICY IF EXISTS "invitations: managed by agency staff" ON public.invitations;

-- Owners can insert any role
CREATE POLICY "invitations: owners can invite any role"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_agency_role(auth.uid(), agency_id, 'owner')
  );

-- Admins can invite non-owner roles only
CREATE POLICY "invitations: admins can invite non-owner"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_agency_role(auth.uid(), agency_id, 'admin')
    AND role <> 'owner'
  );

-- Agency staff (owner/admin) can read/update/delete invitations
CREATE POLICY "invitations: staff can select"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.has_agency_access(auth.uid(), agency_id));

CREATE POLICY "invitations: staff can update"
  ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_agency_access(auth.uid(), agency_id));

CREATE POLICY "invitations: staff can delete"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.has_agency_access(auth.uid(), agency_id));
