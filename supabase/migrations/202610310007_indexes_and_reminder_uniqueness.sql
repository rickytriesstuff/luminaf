-- Reminder upserts are keyed per user and reminder kind.
create unique index if not exists reminders_user_kind_unique on public.reminders(user_id,kind);
create index if not exists meals_user_logged_at_idx on public.meals(user_id,logged_at desc);
create index if not exists water_logs_user_logged_at_idx on public.water_logs(user_id,logged_at desc);
create index if not exists body_metrics_user_measured_at_idx on public.body_metrics(user_id,measured_at desc);
create index if not exists habit_logs_user_completed_at_idx on public.habit_logs(user_id,completed_at desc);

-- Ensure the private AI usage table cannot be queried or mutated by clients.
revoke all on public.ai_usage_events from anon,authenticated;
