create or replace function public.get_my_points()
returns bigint language sql stable security definer set search_path=public
as $$
 select coalesce(sum(points),0)::bigint from public.points_ledger where user_id=auth.uid();
$$;
revoke all on function public.get_my_points() from public,anon;
grant execute on function public.get_my_points() to authenticated;
