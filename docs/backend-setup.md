# Supabase backend setup

## Before connecting a project

Create a Supabase project and keep its database password and service-role key private. Add these values to your deployment's encrypted environment-variable settings, never to source control or client-side code.

Required server environment:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key (safe to expose; RLS is mandatory)
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key, used for first-signup trial configuration, trusted points awards, Stripe webhook updates, and account deletion
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
- `GET /api/billing/status`, `POST /api/billing/checkout`, `POST /api/billing/portal`, and Stripe webhook `POST /api/webhooks/stripe`
- `GET /api/points` and `GET /api/progress`
- `GET /api/weather?lat=...&lon=...` (authenticated; browser geolocation is opt-in)
- `GET /api/account/export` and `POST /api/account/delete`

Read APIs remain available after expiry. Write APIs check the server-side subscription record and return HTTP 402 when the trial or paid period has expired. User records are retained.

## Not yet enabled

Web Push delivery and cron scheduling, AI symptom guidance, scheduled personalized plans, and production observability still require implementation and configuration. XP is awarded by a server-only database function after successful user actions, with per-action daily caps and idempotency. The points ledger cannot be written by client sessions. The symptom checker intentionally fails closed until a clinically reviewed provider and escalation protocol are approved. Do not enable it as a diagnostic feature.

## Stripe billing

Create a recurring monthly Price in Stripe for USD $4.99, then configure:

- `STRIPE_SECRET_KEY`: server-only secret key
- `STRIPE_PRICE_ID`: the recurring monthly Price ID
- `STRIPE_WEBHOOK_SECRET`: signing secret for the webhook endpoint
- `NEXT_PUBLIC_APP_URL`: production HTTPS origin

Register `https://YOUR_DOMAIN/api/webhooks/stripe` as a Stripe webhook endpoint. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`. The handler verifies the timestamped HMAC signature, applies subscription changes with the server-only Supabase service role, and records processed event IDs for idempotency.

Enable the Stripe Customer Portal in the Stripe Dashboard. Checkout is available after the free trial expires; active subscribers are sent to the portal to manage billing. The database trial record is created at signup, and server-side write APIs enforce the resulting entitlement. Test with Stripe test-mode keys and test cards before switching to live mode.

## Web Push and scheduled reminders

The browser asks for notification permission only when the user presses **Enable** on the Reminder Settings screen. The browser creates a PushSubscription, which is saved under the authenticated user's ID. The service worker displays notifications and opens the app when a notification is tapped.

Generate a VAPID key pair and configure:

- Next.js environment: `VAPID_PUBLIC_KEY`
- Supabase Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`

Deploy the worker:

```bash
supabase functions deploy send-reminders --no-verify-jwt
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:YOUR_EMAIL CRON_SECRET=...
```

The function requires the `x-cron-secret` header and should be invoked once per minute. Enable `pg_cron`, `pg_net` and Supabase Vault in the project, store the cron secret in Vault, then schedule the Edge Function. Example SQL (replace the project ref and store the real secret using Vault):

```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'luminaf-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='luminaf_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The worker respects each reminder's timezone and quiet hours, deduplicates each scheduled minute, retries failed deliveries up to three times, and removes expired browser subscriptions. Test on HTTPS with a real browser and VAPID credentials before enabling production schedules.
