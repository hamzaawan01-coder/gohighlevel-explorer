
create policy "Members can read deal files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'deal-files'
    and public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

create policy "Members can upload deal files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deal-files'
    and public.has_subaccount_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

create policy "Uploader can delete deal files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'deal-files' and owner = auth.uid());
