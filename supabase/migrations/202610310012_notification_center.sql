alter table public.notifications add column if not exists read_at timestamptz;
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.notifications set read_at=now()
 where id=p_notification_id and user_id=auth.uid();
 return found;
end $$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
