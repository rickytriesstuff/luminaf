insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('social-media','social-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
create policy "users upload own social photos" on storage.objects for insert to authenticated with check(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users read social photos" on storage.objects for select to authenticated using(bucket_id='social-media');
create policy "users delete own social photos" on storage.objects for delete to authenticated using(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function public.get_social_profiles(p_ids uuid[])
returns table(id uuid,display_name text)
language sql stable security definer set search_path=public
as $$ select p.id,p.display_name from public.profiles p where p.id=any(p_ids); $$;
revoke all on function public.get_social_profiles(uuid[]) from public;
grant execute on function public.get_social_profiles(uuid[]) to authenticated;
