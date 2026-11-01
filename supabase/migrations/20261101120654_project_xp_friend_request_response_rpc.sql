create or replace function public.respond_to_friend_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
declare changed integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.friendships set status='accepted'
 where id=p_request_id and addressee_id=auth.uid() and status='pending';
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.respond_to_friend_request(uuid) from public;
grant execute on function public.respond_to_friend_request(uuid) to authenticated;
