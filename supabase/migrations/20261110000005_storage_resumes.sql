-- ============================================================================
-- CareerIQ — 0005 private storage for resumes
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists resumes_select_own on storage.objects;
create policy resumes_select_own on storage.objects for select
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_insert_own on storage.objects;
create policy resumes_insert_own on storage.objects for insert
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_update_own on storage.objects;
create policy resumes_update_own on storage.objects for update
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_delete_own on storage.objects;
create policy resumes_delete_own on storage.objects for delete
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
