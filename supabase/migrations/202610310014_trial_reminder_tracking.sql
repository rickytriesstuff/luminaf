-- Ensure the automatic database-backed trial sends a reminder before access expires.
alter table public.subscriptions add column if not exists trial_reminder_sent_at timestamptz;
create index if not exists subscriptions_trial_due_idx
  on public.subscriptions(trial_ends_at)
  where status='trialing' and trial_reminder_sent_at is null;
