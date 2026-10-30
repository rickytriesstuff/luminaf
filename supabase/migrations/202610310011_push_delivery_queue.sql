-- Durable, idempotent queue for scheduled web-push delivery.
alter table public.notifications
  add column if not exists reminder_id uuid references public.reminders(id) on delete set null,
  add column if not exists scheduled_for timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text;
create unique index if not exists notifications_reminder_schedule_unique
  on public.notifications(reminder_id,scheduled_for)
  where reminder_id is not null and scheduled_for is not null;
create index if not exists notifications_queue_due_idx
  on public.notifications(delivery_status,created_at)
  where delivery_status='queued';
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
drop policy if exists "notifications owner access" on public.notifications;
drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read" on public.notifications
  for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.notifications from anon,authenticated;
