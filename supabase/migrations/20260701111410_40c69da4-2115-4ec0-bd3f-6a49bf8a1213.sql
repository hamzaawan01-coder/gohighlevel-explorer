-- 1. booking_pages: drop the anon SELECT policy entirely.
--    The public booking endpoint (/api/public/booking/$slug) runs server-side with
--    the service role, so anon no longer needs any direct read on this table.
DROP POLICY IF EXISTS "booking_pages: public read enabled" ON public.booking_pages;

-- 2. lead_forms: replace the wide anon SELECT with a column-safe view.
DROP POLICY IF EXISTS "Public can view enabled forms" ON public.lead_forms;

CREATE OR REPLACE VIEW public.lead_forms_public AS
  SELECT id, slug, name, description, fields, success_message, redirect_url, enabled
  FROM public.lead_forms
  WHERE enabled = true;

-- View runs with definer rights so it bypasses base-table RLS for anon,
-- but only the columns above are ever reachable. The base table still has
-- no anon SELECT policy, so direct access is denied.
GRANT SELECT ON public.lead_forms_public TO anon, authenticated;

-- 3. deal_files storage policies: require owner = auth.uid() on INSERT and
--    add a matching UPDATE policy so users can only replace their own files.
DROP POLICY IF EXISTS "Members can upload deal files" ON storage.objects;
CREATE POLICY "Members can upload deal files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'deal-files'
    AND owner = auth.uid()
    AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "Uploader can update deal files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'deal-files'
    AND owner = auth.uid()
    AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'deal-files'
    AND owner = auth.uid()
    AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );