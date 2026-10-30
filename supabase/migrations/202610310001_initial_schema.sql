-- Luminaf initial private data model. Apply with Supabase CLI migrations.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  birth_date date,
  sex text check (sex in ('female','male','other','prefer_not_to_say')),
  height_cm numeric(5,2), current_weight_kg numeric(6,2), goal_weight_kg numeric(6,2),
  activity_level text, wellness_goal text, dietary_preferences text[] not null default '{}',
  timezone text not null default 'UTC', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.body_metrics (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, weight_kg numeric(6,2), height_cm numeric(5,2), waist_cm numeric(5,2), measured_at timestamptz not null default now(), created_at timestamptz not null default now());
create table if not exists public.meals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, meal_type text, photo_path text, calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric, meal_score integer check (meal_score between 0 and 100), ai_estimate boolean not null default true, logged_at timestamptz not null default now());
create table if not exists public.meal_items (id uuid primary key default gen_random_uuid(), meal_id uuid not null references public.meals(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, name text not null, portion_grams numeric, confidence numeric check (confidence between 0 and 1), nutrition jsonb not null default '{}');
create table if not exists public.water_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, amount_ml integer not null check (amount_ml > 0), logged_at timestamptz not null default now());
create table if not exists public.workouts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, workout_type text, duration_seconds integer, distance_m numeric, notes text, started_at timestamptz not null default now());
create table if not exists public.workout_sets (id uuid primary key default gen_random_uuid(), workout_id uuid not null references public.workouts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, exercise_name text not null, set_number integer, reps integer, weight_kg numeric, duration_seconds integer);
create table if not exists public.exercises (id uuid primary key default gen_random_uuid(), name text not null unique, category text not null, instructions text not null, difficulty text not null default 'beginner');
create table if not exists public.fitness_plans (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, plan jsonb not null, created_at timestamptz not null default now());
create table if not exists public.sleep_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, bedtime timestamptz not null, wake_time timestamptz not null, quality integer check (quality between 1 and 5), notes text);
create table if not exists public.habits (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, target text, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.habit_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, habit_id uuid not null references public.habits(id) on delete cascade, completed_at timestamptz not null default now(), unique(habit_id, (completed_at::date)));
create table if not exists public.symptom_checks (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, symptom_text text not null, response jsonb, emergency_flag boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.reminders (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, kind text not null, local_time time, timezone text not null default 'UTC', enabled boolean not null default true, quiet_hours jsonb);
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, body text not null, delivered_at timestamptz, delivery_status text not null default 'queued', created_at timestamptz not null default now());
create table if not exists public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, endpoint text not null unique, subscription jsonb not null, created_at timestamptz not null default now());
create table if not exists public.points_ledger (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, points integer not null, reason text not null, source_id uuid, created_at timestamptz not null default now());
create table if not exists public.badges (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, badge_key text not null, awarded_at timestamptz not null default now(), unique(user_id,badge_key));
create table if not exists public.subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade, provider text not null default 'stripe', provider_customer_id text, provider_subscription_id text, status text not null default 'trialing', trial_ends_at timestamptz, current_period_end timestamptz, created_at timestamptz not null default now());
create table if not exists public.friendships (id uuid primary key default gen_random_uuid(), requester_id uuid not null references auth.users(id) on delete cascade, addressee_id uuid not null references auth.users(id) on delete cascade, status text not null default 'pending' check(status in ('pending','accepted','declined','blocked')), share_points boolean not null default true, share_streak boolean not null default true, created_at timestamptz not null default now(), unique(requester_id,addressee_id), check(requester_id <> addressee_id));
-- Every user-owned table is private by default. Friends never receive direct access to health records.
do $$
declare t text;
begin
  foreach t in array array['profiles','body_metrics','meals','meal_items','water_logs','workouts','workout_sets','fitness_plans','sleep_logs','habits','habit_logs','symptom_checks','reminders','notifications','push_subscriptions','points_ledger','badges','subscriptions'] loop
    execute format('alter table public.%I enable row level security',t);
    if t='profiles' then
      execute 'create policy "profile owner access" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid())';
    elsif t='meal_items' then
      execute 'create policy "meal item owner access" on public.meal_items for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
    elsif t='workout_sets' then
      execute 'create policy "workout set owner access" on public.workout_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
    else
      execute format('create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t || ' owner access', t);
    end if;
  end loop;
end $$;
alter table public.friendships enable row level security;
create policy "friendship participants read" on public.friendships for select using (requester_id=auth.uid() or addressee_id=auth.uid());
create policy "friendship requester creates" on public.friendships for insert with check (requester_id=auth.uid() and status='pending');
create policy "participants update friendship" on public.friendships for update using (requester_id=auth.uid() or addressee_id=auth.uid()) with check (requester_id=auth.uid() or addressee_id=auth.uid());
alter table public.exercises enable row level security;
create policy "exercise library readable" on public.exercises for select using (true);
