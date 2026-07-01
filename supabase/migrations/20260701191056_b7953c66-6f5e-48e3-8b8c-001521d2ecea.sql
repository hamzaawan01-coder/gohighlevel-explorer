CREATE POLICY "Owner can update contact files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contact-files'
    AND owner = auth.uid()
    AND has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'contact-files'
    AND owner = auth.uid()
    AND has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );