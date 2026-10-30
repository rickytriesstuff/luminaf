-- Tighten friendship mutation: acceptance is only possible through the validated token RPC.
drop policy if exists "participants update friendship" on public.friendships;
create policy "participants may decline or block" on public.friendships
for update using (requester_id=auth.uid() or addressee_id=auth.uid())
with check (
  (requester_id=auth.uid() or addressee_id=auth.uid())
  and status in ('declined','blocked')
);
