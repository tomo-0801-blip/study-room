-- 自分の勉強部屋：勉強会資料のPDFを置く場所（1回だけ実行）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

drop policy if exists materials_read   on storage.objects;
drop policy if exists materials_insert on storage.objects;
drop policy if exists materials_update on storage.objects;
drop policy if exists materials_delete on storage.objects;
create policy materials_read   on storage.objects for select to authenticated using (bucket_id = 'materials' and public.my_role() is not null);
create policy materials_insert on storage.objects for insert to authenticated with check (bucket_id = 'materials' and public.my_role() in ('editor','admin'));
create policy materials_update on storage.objects for update to authenticated using (bucket_id = 'materials' and public.my_role() in ('editor','admin')) with check (bucket_id = 'materials' and public.my_role() in ('editor','admin'));
create policy materials_delete on storage.objects for delete to authenticated using (bucket_id = 'materials' and public.my_role() in ('editor','admin'));
