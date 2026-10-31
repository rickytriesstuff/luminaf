-- Enforce parent/child ownership at the database boundary, not only in API handlers.
create unique index if not exists meals_id_user_unique on public.meals(id,user_id);
create unique index if not exists workouts_id_user_unique on public.workouts(id,user_id);
create unique index if not exists habits_id_user_unique on public.habits(id,user_id);

do $$
begin
 if not exists(select 1 from pg_constraint where conname='meal_items_parent_owner_fk' and conrelid='public.meal_items'::regclass) then
  alter table public.meal_items add constraint meal_items_parent_owner_fk
   foreign key(meal_id,user_id) references public.meals(id,user_id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='workout_sets_parent_owner_fk' and conrelid='public.workout_sets'::regclass) then
  alter table public.workout_sets add constraint workout_sets_parent_owner_fk
   foreign key(workout_id,user_id) references public.workouts(id,user_id) on delete cascade;
 end if;
 if not exists(select 1 from pg_constraint where conname='habit_logs_parent_owner_fk' and conrelid='public.habit_logs'::regclass) then
  alter table public.habit_logs add constraint habit_logs_parent_owner_fk
   foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade;
 end if;
end $$;
