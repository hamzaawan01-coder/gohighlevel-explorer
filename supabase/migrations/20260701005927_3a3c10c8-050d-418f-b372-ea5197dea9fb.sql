
-- 1. Table linking uploaded files to contacts
CREATE TABLE public.contact_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  size bigint NOT NULL DEFAULT 0,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_files_contact_idx ON public.contact_files(contact_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_files TO authenticated;
GRANT ALL ON public.contact_files TO service_role;

ALTER TABLE public.contact_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sub-account files"
  ON public.contact_files FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Members can add files"
  ON public.contact_files FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id) AND uploaded_by = auth.uid());

CREATE POLICY "Uploader can delete own file"
  ON public.contact_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND public.has_subaccount_access(auth.uid(), sub_account_id));

-- 2. Storage RLS on the contact-files bucket
-- Path convention: {sub_account_id}/{contact_id}/{uuid}-{filename}

CREATE POLICY "Members can read contact files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contact-files'
    AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "Members can upload contact files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contact-files'
    AND public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
    AND owner = auth.uid()
  );

CREATE POLICY "Owner can delete contact files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contact-files'
    AND owner = auth.uid()
  );
