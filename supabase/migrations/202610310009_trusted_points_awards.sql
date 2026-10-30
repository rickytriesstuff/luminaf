-- Idempotent server-only points awards. Clients may read their own ledger but cannot mint points.
create unique index if not exists points_award_source_unique
on public.points_ledger(user_id,reason,source_id)
where source_id is not null;

create or replace function public.award_points(
 p_user_id uuid,
 p_points integer,
 p_reason text,
 p_source_id uuid,
 p_daily_limit integer
) returns boolean
language plpgsql security definer set search_path=public
as $$
declare awarded_today integer;
begin
 if p_points<1 or p_points>50 or p_daily_limit<1 or p_daily_limit>20 then
  raise exception 'Invalid points award';
 end if;
 if p_reason not in ('meal_logged','water_logged','workout_completed','sleep_logged','habit_completed') then
  raise exception 'Unsupported points reason';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_reason||':'||current_date::text,0));
 select count(*) into awarded_today from public.points_ledger
  where user_id=p_user_id and reason=p_reason and created_at>=date_trunc('day',now());
 if awarded_today>=p_daily_limit then return false; end if;
 insert into public.points_ledger(user_id,points,reason,source_id)
 values(p_user_id,p_points,p_reason,p_source_id)
 on conflict(user_id,reason,source_id) where source_id is not null do nothing;
 return found;
end $$;
revoke all on function public.award_points(uuid,integer,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.award_points(uuid,integer,text,uuid,integer) to service_role;
