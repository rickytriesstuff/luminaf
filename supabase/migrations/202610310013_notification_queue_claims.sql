alter table public.notifications add column if not exists lease_expires_at timestamptz;
create or replace function public.claim_due_notifications(p_limit integer default 100)
returns table(id uuid,user_id uuid,title text,body text,attempts integer)
language plpgsql security definer set search_path=public
as $$
begin
 return query
 with due as (
  select n.id from public.notifications n
  where n.attempts<3 and n.next_attempt_at<=now()
   and (n.delivery_status in ('queued','failed') or (n.delivery_status='sending' and n.lease_expires_at<now()))
  order by n.next_attempt_at,n.created_at
  for update skip locked
  limit greatest(1,least(coalesce(p_limit,100),500))
 )
 update public.notifications n
 set delivery_status='sending',attempts=n.attempts+1,lease_expires_at=now()+interval '5 minutes'
 from due where n.id=due.id
 returning n.id,n.user_id,n.title,n.body,n.attempts;
end $$;
revoke all on function public.claim_due_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_due_notifications(integer) to service_role;
