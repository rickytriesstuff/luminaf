-- Friendship state changes are performed only by audited server-side RPCs.
drop policy if exists "participants update friendship" on public.friendships;
drop policy if exists "participants may decline or block" on public.friendships;
