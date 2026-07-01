-- booking_pages: public read for enabled pages
DROP POLICY IF EXISTS "booking_pages: public read enabled" ON public.booking_pages;
CREATE POLICY "booking_pages: public read enabled"
  ON public.booking_pages FOR SELECT
  TO anon, authenticated
  USING (enabled = true);
GRANT SELECT ON public.booking_pages TO anon;

-- deal_files: DELETE must also require sub-account access
DROP POLICY IF EXISTS "Uploader can delete their deal files" ON public.deal_files;
CREATE POLICY "Uploader can delete their deal files"
  ON public.deal_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() AND public.has_subaccount_access(auth.uid(), sub_account_id));

-- trigger_link_clicks: allow public + workspace inserts for valid links
DROP POLICY IF EXISTS "trigger_link_clicks: anon insert valid" ON public.trigger_link_clicks;
CREATE POLICY "trigger_link_clicks: anon insert valid"
  ON public.trigger_link_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.trigger_links tl WHERE tl.id = link_id));
GRANT INSERT ON public.trigger_link_clicks TO anon;