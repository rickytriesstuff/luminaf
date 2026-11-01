-- Project XP: social feed, friend discovery, direct messaging, and daily meal scan allowance.
create table if not exists public.social_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 caption text not null default '' check (char_length(caption)<=500),
 image_path text,
 post_type text not null default 'moment' check(post_type in ('gym','meal','moment')),
 created_at timestamptz not null default now()
);
create table if not exists public.social_likes (
 post_id uuid not null references public.social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.social_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 500),
 created_at timestamptz not null default now()
);
create table if not exists public.social_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 check(sender_id<>recipient_id)
);
create index if not exists social_posts_created_idx on public.social_posts(created_at desc);
create index if not exists social_messages_pair_idx on public.social_messages(sender_id,recipient_id,created_at);
create index if not exists social_comments_post_idx on public.social_comments(post_id,created_at);
alter table public.social_posts enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_messages enable row level security;
drop policy if exists "social posts visible to signed in" on public.social_posts;
create policy "social posts visible to signed in" on public.social_posts for select to authenticated using (true);
create policy "social post owner insert" on public.social_posts for insert to authenticated with check(user_id=auth.uid());
create policy "social post owner delete" on public.social_posts for delete to authenticated using(user_id=auth.uid());
create policy "social likes visible to signed in" on public.social_likes for select to authenticated using(true);
create policy "social likes self manage" on public.social_likes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "social comments visible to signed in" on public.social_comments for select to authenticated using(true);
create policy "social comments self manage" on public.social_comments for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "message participants read" on public.social_messages for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy "message sender insert" on public.social_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=recipient_id) or (f.addressee_id=auth.uid() and f.requester_id=recipient_id))));
create policy "recipient mark read" on public.social_messages for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create or replace function public.get_discoverable_profiles(p_limit integer default 30)
returns table(id uuid,display_name text,points_total bigint)
language sql stable security definer set search_path=public
as $$
 select p.id,p.display_name,coalesce((select sum(l.points) from public.points_ledger l where l.user_id=p.id),0)::bigint
 from public.profiles p
 where p.id<>auth.uid()
 and not exists(select 1 from public.friendships f where f.status in ('accepted','pending') and ((f.requester_id=auth.uid() and f.addressee_id=p.id) or (f.addressee_id=auth.uid() and f.requester_id=p.id)))
 order by coalesce((select sum(l.points) from public.points_ledger l where l.user_id=p.id),0) desc,p.created_at desc
 limit greatest(1,least(coalesce(p_limit,30),60));
$$;
revoke all on function public.get_discoverable_profiles(integer) from public;
grant execute on function public.get_discoverable_profiles(integer) to authenticated;
create or replace function public.consume_daily_meal_scan()
returns table(allowed boolean,used integer,remaining integer)
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); n integer;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':meal_analysis_daily',0));
 select count(*) into n from public.ai_usage_events where user_id=uid and endpoint='meal_analysis_daily' and created_at >= date_trunc('day',now());
 if n>=5 then return query select false,n,0; return; end if;
 insert into public.ai_usage_events(user_id,endpoint) values(uid,'meal_analysis_daily');
 n:=n+1;
 return query select true,n,5-n;
end $$;
revoke all on function public.consume_daily_meal_scan() from public;
grant execute on function public.consume_daily_meal_scan() to authenticated;
create or replace function public.get_daily_meal_scan_usage()
returns table(used integer,remaining integer)
language sql stable security definer set search_path=public
as $$
 select count(*)::integer,greatest(0,5-count(*)::integer)
 from public.ai_usage_events
 where user_id=auth.uid() and endpoint='meal_analysis_daily' and created_at>=date_trunc('day',now());
$$;
revoke all on function public.get_daily_meal_scan_usage() from public;
grant execute on function public.get_daily_meal_scan_usage() to authenticated;
