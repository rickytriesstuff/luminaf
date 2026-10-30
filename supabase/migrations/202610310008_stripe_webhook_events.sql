-- Idempotency ledger for signed Stripe webhook events. Service role only.
create table if not exists public.stripe_events(
 event_id text primary key,
 event_type text not null,
 processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon,authenticated;
