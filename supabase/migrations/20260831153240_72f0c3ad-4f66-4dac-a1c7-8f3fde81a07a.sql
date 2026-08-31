ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS signature text;

ALTER TABLE public.sub_accounts
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS vat_number text;

DROP POLICY IF EXISTS "avatars own read" ON storage.objects;
CREATE POLICY "avatars own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars own insert" ON storage.objects;
CREATE POLICY "avatars own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars own update" ON storage.objects;
CREATE POLICY "avatars own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars own delete" ON storage.objects;
CREATE POLICY "avatars own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "branding workspace read" ON storage.objects;
CREATE POLICY "branding workspace read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'branding' AND public.has_subaccount_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "branding workspace insert" ON storage.objects;
CREATE POLICY "branding workspace insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_subaccount_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "branding workspace update" ON storage.objects;
CREATE POLICY "branding workspace update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.has_subaccount_access(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'branding' AND public.has_subaccount_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "branding workspace delete" ON storage.objects;
CREATE POLICY "branding workspace delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_subaccount_access(auth.uid(), ((storage.foldername(name))[1])::uuid));