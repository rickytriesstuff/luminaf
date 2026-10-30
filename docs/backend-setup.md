# Supabase backend setup

## Before connecting a project

Create a Supabase project and keep its database password and service-role key private. Add these values to your deployment's encrypted environment-variable settings, never to source control or client-side code.

Required server environment:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key (safe to expose; RLS is mandatory)
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key, used only for first-signup trial configuration
- `NEXT_PUBLIC_APP_URL`: canonical HTTPS application URL
- `TRIAL_DAYS`: signup trial duration, default 7, clamped to 0–90
- `OPENAI_API_KEY`: server-only meal vision provider key

## Apply database migrations

Install the Supabase CLI, authenticate, and link the project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The ordered migrations create the private wellness schema, owner-only RLS, friend invitations and points-only friend views, private meal photo storage, AI rate limiting, seeded exercise library, signup profile/trial initialization, integrity constraints and query indexes.

Review every migration in `supabase/migrations` before applying it to an existing production database. Backups are recommended.

## Authentication providers

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: your production origin
- Redirect URL: `https://YOUR_DOMAIN/auth/callback`
- Local redirect: `http://localhost:3000/auth/callback`

Enable Email/password. For Google, configure OAuth client ID/secret and the Supabase callback URL in the Google Cloud Console. For Apple, configure the Apple Services ID, Team ID, Key ID and signing key in Supabase's Apple provider settings. Apple provider setup also requires the correct domain association and Apple Developer configuration.

## Storage

Migration `202610310004_private_meal_storage_and_ai_limits.sql` creates a private `meal-photos` bucket, caps uploads at 8 MB, and restricts objects to the authenticated user's UUID folder. Meal list responses generate short-lived signed URLs; never change this bucket to public.

## Current authenticated APIs

- `GET/PATCH /api/profile`
- `GET/POST /api/meals` and `POST /api/meals/analyze`
- `GET/POST /api/water`
- `GET/POST /api/habits` and `GET/POST /api/habits/checkins`
- `GET/POST /api/metrics`
- `GET/PUT /api/reminders`
- `POST /api/workouts`, `POST /api/sleep`
- `GET /api/friends`, `POST /api/friends/invite`, `POST /api/friends/accept`
- `GET /api/billing/status`

Read APIs remain available after expiry. Write APIs check the server-side subscription record and return HTTP 402 when the trial or paid period has expired. User records are retained.

## Not yet enabled

Stripe checkout/webhooks/customer portal, push delivery and cron scheduling, AI symptom guidance, scheduled personalized plans, data export/deletion workflows and production observability still require implementation and configuration. The symptom checker intentionally fails closed until a clinically reviewed provider and escalation protocol are approved. Do not enable it as a diagnostic feature.
