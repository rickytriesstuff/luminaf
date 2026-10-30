-- Private meal photo storage and atomic AI usage limits.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meal-photos','meal-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

create policy "users upload own meal photos" on storage.objects
for insert to authenticated with check (bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users read own meal photos" on storage.objects
for select to authenticated using (bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users delete own meal photos" on storage.objects
for delete to authenticated using (bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);

create table if not exists public.ai_usage_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,
 created_at timestamptz not null default now()
);
alter table public.ai_usage_events enable row level security;
create index if not exists ai_usage_user_endpoint_time on public.ai_usage_events(user_id,endpoint,created_at desc);
create or replace function public.consume_ai_request(p_endpoint text,p_hourly_limit integer default 10)
returns boolean language plpgsql security definer set search_path=public
as $$
declare current_user_id uuid:=auth.uid(); request_count integer;
begin
 if current_user_id is null then raise exception 'Authentication required'; end if;
 if p_hourly_limit<1 or p_hourly_limit>30 then raise exception 'Invalid limit'; end if;
 perform pg_advisory_xact_lock(hashtextextended(current_user_id::text||':'||p_endpoint,0));
 select count(*) into request_count from public.ai_usage_events
  where user_id=current_user_id and endpoint=p_endpoint and created_at>now()-interval '1 hour';
 if request_count>=p_hourly_limit then return false; end if;
 insert into public.ai_usage_events(user_id,endpoint) values(current_user_id,p_endpoint);
 return true;
end $$;
revoke all on function public.consume_ai_request(text,integer) from public;
grant execute on function public.consume_ai_request(text,integer) to authenticated;
