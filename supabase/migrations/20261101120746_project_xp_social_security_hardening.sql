-- Keep privileged routines unavailable to anonymous callers.
revoke execute on function public.consume_daily_meal_scan() from anon;
revoke execute on function public.get_daily_meal_scan_usage() from anon;
revoke execute on function public.get_discoverable_profiles(integer) from anon;
revoke execute on function public.get_social_profiles(uuid[]) from anon;
revoke execute on function public.respond_to_friend_request(uuid) from anon;
revoke execute on function public.accept_friend_invite(text) from anon;
revoke execute on function public.get_friends_zone() from anon;

-- A recipient may mark a message read, but may not rewrite the sender's message.
revoke update on table public.social_messages from authenticated;
grant update (read_at) on table public.social_messages to authenticated;

-- Avoid duplicate SELECT policies while keeping per-user like/comment controls.
drop policy if exists "social likes self manage" on public.social_likes;
create policy "social likes self insert" on public.social_likes for insert to authenticated with check(user_id=auth.uid());
create policy "social likes self delete" on public.social_likes for delete to authenticated using(user_id=auth.uid());
drop policy if exists "social comments self manage" on public.social_comments;
create policy "social comments self insert" on public.social_comments for insert to authenticated with check(user_id=auth.uid());
create policy "social comments self delete" on public.social_comments for delete to authenticated using(user_id=auth.uid());