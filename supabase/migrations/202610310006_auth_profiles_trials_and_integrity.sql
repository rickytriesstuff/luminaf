-- Create a private profile and a configurable trial atomically when an Auth user signs up.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=public
as $$ begin new.updated_at=now(); return new; end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare trial_days integer;
begin
  trial_days := greatest(0,least(90,coalesce(nullif(current_setting('app.settings.trial_days',true),''),'7')::integer));
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),nullif(new.raw_user_meta_data->>'full_name',''),split_part(coalesce(new.email,''),'@',1),'Luminaf member'))
  on conflict(id) do nothing;
  insert into public.subscriptions(user_id,provider,status,trial_ends_at,current_period_end)
  values(new.id,'stripe','trialing',now()+make_interval(days=>trial_days),now()+make_interval(days=>trial_days))
  on conflict(user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_luminaf on auth.users;
create trigger on_auth_user_created_luminaf
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Keep table-level access owner scoped. Entitlements are read-only to clients;
-- subscription mutations must be made by verified server-side payment webhooks.
drop policy if exists "subscriptions owner access" on public.subscriptions;
create policy "subscriptions owner read" on public.subscriptions
for select using(user_id=auth.uid());

-- The client may read its own points ledger but cannot mint points directly.
drop policy if exists "points_ledger owner access" on public.points_ledger;
create policy "points ledger owner read" on public.points_ledger
for select using(user_id=auth.uid());

-- Keep points awarding in trusted backend functions only.
revoke insert,update,delete on public.points_ledger from anon,authenticated;

-- Restrict notification and push-subscription records to owner reads/writes.
-- These are user-managed settings, while delivery status will be updated by service role.
drop policy if exists "notifications owner access" on public.notifications;
create policy "notifications owner read" on public.notifications
for select using(user_id=auth.uid());
drop policy if exists "push_subscriptions owner access" on public.push_subscriptions;
create policy "push subscriptions owner access" on public.push_subscriptions
for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Ensure logged data is sane even if a future route forgets validation.
alter table public.water_logs add constraint water_amount_reasonable check(amount_ml between 1 and 5000);
alter table public.body_metrics add constraint body_weight_reasonable check(weight_kg is null or weight_kg between 1 and 500);
alter table public.body_metrics add constraint body_height_reasonable check(height_cm is null or height_cm between 30 and 260);
alter table public.meals add constraint meal_calories_reasonable check(calories is null or calories between 0 and 10000);
alter table public.meals add constraint meal_macros_nonnegative check(
 (protein_g is null or protein_g>=0) and (carbs_g is null or carbs_g>=0)
 and (fat_g is null or fat_g>=0) and (fiber_g is null or fiber_g>=0)
);
