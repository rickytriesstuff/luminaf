alter table public.notifications
 add column if not exists reminder_id uuid references public.reminders(id) on delete set null,
 add column if not exists scheduled_for timestamptz,
 add column if not exists attempts integer not null default 0,
 add column if not exists last_error text,
 add column if not exists next_attempt_at timestamptz not null default now();

create unique index if not exists notifications_reminder_schedule_unique
 on public.notifications(reminder_id,scheduled_for)
 where reminder_id is not null and scheduled_for is not null;

create index if not exists notifications_delivery_queue_idx
 on public.notifications(delivery_status,next_attempt_at)
 where delivery_status in ('queued','failed');
