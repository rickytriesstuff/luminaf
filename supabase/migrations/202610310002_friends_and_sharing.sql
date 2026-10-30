-- Repair the initial migration's habit-log constraint and add invitation-only friend sharing.
create unique index if not exists habit_logs_one_per_day
  on public.habit_logs(habit_id, ((completed_at at time zone 'UTC')::date));

create table if not exists public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.friend_invites enable row level security;
create policy "invite owner can view" on public.friend_invites for select using (inviter_id=auth.uid());
create policy "invite owner can create" on public.friend_invites for insert with check (inviter_id=auth.uid());
create policy "invite owner can revoke" on public.friend_invites for delete using (inviter_id=auth.uid());

create or replace function public.accept_friend_invite(p_token text)
returns boolean language plpgsql security definer set search_path=public,extensions
as $$
declare invite_row public.friend_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invite_row from public.friend_invites
    where token_hash=encode(digest(p_token,'sha256'),'hex')
      and accepted_by is null and expires_at > now()
    for update;
  if not found then return false; end if;
  if invite_row.inviter_id=auth.uid() then raise exception 'Cannot accept your own invitation'; end if;
  insert into public.friendships(requester_id,addressee_id,status,share_points,share_streak)
    values(invite_row.inviter_id,auth.uid(),'accepted',true,true)
    on conflict(requester_id,addressee_id) do update set status='accepted';
  update public.friend_invites set accepted_by=auth.uid(),accepted_at=now() where id=invite_row.id;
  return true;
end $$;
revoke all on function public.accept_friend_invite(text) from public;
grant execute on function public.accept_friend_invite(text) to authenticated;

create or replace function public.get_friends_zone()
returns table(friend_id uuid, display_name text, points_total bigint)
language sql stable security definer set search_path=public
as $$
  select p.id, p.display_name,
    case when f.share_points then coalesce((select sum(pl.points) from public.points_ledger pl where pl.user_id=p.id),0) else 0 end
  from public.friendships f
  join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end
  where f.status='accepted' and (f.requester_id=auth.uid() or f.addressee_id=auth.uid());
$$;
revoke all on function public.get_friends_zone() from public;
grant execute on function public.get_friends_zone() to authenticated;
