
-- Fix contact-files storage DELETE policy to require workspace access
DROP POLICY IF EXISTS "Owner can delete contact files" ON storage.objects;
CREATE POLICY "Owner can delete contact files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contact-files'
  AND owner = auth.uid()
  AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
);

-- Fix trigger_link_clicks anon INSERT to enforce sub_account_id match
DROP POLICY IF EXISTS "trigger_link_clicks: anon insert valid" ON public.trigger_link_clicks;
CREATE POLICY "trigger_link_clicks: anon insert valid"
ON public.trigger_link_clicks FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trigger_links tl
    WHERE tl.id = trigger_link_clicks.link_id
      AND tl.sub_account_id = trigger_link_clicks.sub_account_id
  )
);
