alter table public.workouts add column if not exists sessions_count integer not null default 1 check(sessions_count between 1 and 50);
