# Supabase backend setup for GitHub Pages

Luminaf's frontend is a static Next.js export hosted on GitHub Pages. Supabase provides authentication, Postgres/RLS, private Storage and Edge Functions. No Next.js application server is required.

## 1. Public frontend build variables

Add these as **GitHub repository variables** in Settings → Secrets and variables → Actions → Variables:

- `NEXT_PUBLIC_SUPABASE_URL`: `https://cgigviwpnvlidguhspnf.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project's public anon/publishable key
- `NEXT_PUBLIC_SITE_BASE_PATH`: `/luminaf` for the default `rickytriesstuff.github.io/luminaf` Pages URL

These values are public by design. Row Level Security must remain enabled. Never put the service-role key, OpenAI key, Stripe secret, webhook secret, VAPID private key or cron credential in a Pages variable.

For local development, copy `.env.example` to `.env.local` and set the Supabase URL and public key. Leave the base path empty locally unless you intentionally want the dev server under `/luminaf`.

## 2. Supabase project and migrations

The repository is linked to project ref `cgigviwpnvlidguhspnf`.

Before applying migrations to a project with existing user data, take a database backup and review the ordered SQL files in `supabase/migrations`.

Manual CLI route:

```bash
npx supabase login
npx supabase link --project-ref cgigviwpnvlidguhspnf
npx supabase db push
```

There is also a GitHub Actions workflow at `.github/workflows/deploy-supabase.yml`. Add the GitHub repository secret `SUPABASE_ACCESS_TOKEN` to deploy Edge Functions. Its optional `apply_migrations` input is disabled by default; set it to true only after reviewing/backup and provide `SUPABASE_DB_PASSWORD`.

Migrations create the private wellness schema, per-user RLS, friend invitations and points-only friend views, private meal-photo storage, AI rate limits, seeded exercises, signup profile/trial initialization, integrity constraints and notification queue.

## 3. Deploy Edge Functions and set secrets

The static frontend sends its existing `/api/*` calls to:

`https://cgigviwpnvlidguhspnf.supabase.co/functions/v1/api-gateway?path=/api/...`

The gateway validates the Supabase user token with Auth `getUser(token)`, then performs ordinary data operations through a user-scoped client so RLS applies. Stripe webhooks are verified by signature before any event is processed. The separate `push-dispatch` worker checks its server-only service-role bearer credential.

In Supabase Dashboard → Edge Functions → Secrets, set:

**Required**
- `SITE_URL=https://rickytriesstuff.github.io` (origin only, no `/luminaf` path)
- `SITE_BASE_PATH=/luminaf`

**Meal scanner**
- `OPENAI_API_KEY`
- Optional `OPENAI_VISION_MODEL=gpt-4o-mini`

**Stripe, when billing is enabled**
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

**Web Push, when enabled**
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:you@example.com`

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions. Do not copy those privileged values into GitHub Pages.

Deploy with:

```bash
npx supabase functions deploy --project-ref cgigviwpnvlidguhspnf
```

Or merge the deployment workflow after setting `SUPABASE_ACCESS_TOKEN`.

## 4. Authentication providers

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://rickytriesstuff.github.io/luminaf/`
- Redirect allow-list: `https://rickytriesstuff.github.io/luminaf/**`
- Local development: `http://localhost:3000/**`

Enable Email/password. Google and Apple buttons work only after their provider credentials and callback configuration are enabled in Supabase. The static `/auth/callback/` page exchanges the PKCE code and handles password-recovery callbacks. The `/auth/reset-password/` page updates the password.

For a root custom domain, update `SITE_URL`, `SITE_BASE_PATH`, GitHub variable `NEXT_PUBLIC_SITE_BASE_PATH` (empty), Supabase Site URL and redirect allow-list together.

## 5. Private meal photos and AI analysis

Migration `202610310004_private_meal_storage_and_ai_limits.sql` creates a private `meal-photos` bucket, caps uploads at 8 MB and restricts objects to the authenticated user's UUID folder. Meal list responses generate short-lived signed URLs; never make this bucket public.

Meal analysis runs inside `api-gateway` and calls OpenAI using the Edge Function secret. It validates image type/size, checks the hourly AI quota, validates the structured response and returns estimates with a non-medical disclaimer.

## 6. Supported API operations

All operations are routed through the `api-gateway` Edge Function:

- Profile, water, habits and daily habit check-ins.
- Workouts and workout sets, sleep, body metrics and reminders.
- Progress summary, points, exercise library and notification inbox/read state.
- Meals, legacy multipart meal save, private photo uploads and AI meal analysis.
- Friends list, invitation creation and acceptance.
- Authenticated local weather lookup.
- Push public key and per-user push subscription registration/removal.
- Subscription status, Stripe checkout and billing portal.
- Stripe webhook processing with timestamped signature verification and event idempotency.
- Account JSON export and permanent account deletion.
- Symptom endpoint intentionally returns a fail-closed unavailable response; it is not a diagnostic tool.

Reads remain available after trial expiry. Write operations check the server-side subscription entitlement and return HTTP 402 when the trial or paid period has ended. The signup migration creates the default seven-day trial.

## 7. Stripe billing

Create a recurring monthly USD $4.99 Price in Stripe and set the Edge Function secrets above. Register this **Supabase Edge Function URL** as the Stripe webhook endpoint:

`https://cgigviwpnvlidguhspnf.supabase.co/functions/v1/api-gateway?path=%2Fapi%2Fwebhooks%2Fstripe`

Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`. The gateway verifies the timestamped HMAC signature over the raw request body and records event IDs for idempotency.

Enable Stripe Customer Portal in Stripe Dashboard. Checkout is available after the free trial expires; active subscribers can manage billing through the portal. Test with Stripe test-mode keys and cards before switching to live mode.

## 8. Web Push delivery worker

Migration 011 adds an idempotent notification queue and locks notification mutations to the service role. Generate VAPID keys locally with `npx web-push generate-vapid-keys`, then store them only as Supabase Edge Function secrets.

Enable pg_cron, pg_net and Vault extensions. Store the project URL and service-role key in Vault, not source control:

```sql
select vault.create_secret('https://cgigviwpnvlidguhspnf.supabase.co','luminaf_project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY','luminaf_service_role_key');
select cron.schedule('luminaf-push-dispatch','* * * * *',
$$ select net.http_post(
 url := (select decrypted_secret from vault.decrypted_secrets where name='luminaf_project_url') || '/functions/v1/push-dispatch',
 headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='luminaf_service_role_key')),
 body := '{}'::jsonb); $$);
```

The worker checks enabled reminders in each saved IANA timezone, respects quiet hours including overnight windows, queues idempotent notifications, sends push, removes expired endpoints and records delivery status. Verify Edge Function logs and notification rows after enabling the schedule. Push requires HTTPS and browser permission; on supported iOS versions, web push requires adding the site to the Home Screen.

## 9. GitHub Pages deployment

In repository Settings → Pages, choose **GitHub Actions** as the publishing source. The `.github/workflows/deploy-pages.yml` workflow builds the static `out/` folder and deploys it on pushes to `main`. It requires the three public repository variables in section 1. Do not merge the migration PR until they are present, otherwise the app would build without its Supabase connection.

## 10. Production verification

After deployment, test on desktop and mobile:

1. Email signup, email confirmation, login, logout, password reset, Google/Apple OAuth if enabled.
2. Session refresh after leaving the app idle and returning on another device.
3. Create/read/update water, habits, meals, workouts, sleep, metrics, reminders and profile.
4. Meal-photo upload, private signed URL access and AI quota enforcement.
5. Friend invitation expiry, acceptance and points-only privacy using two separate accounts.
6. Trial expiry and server-side write restrictions.
7. Stripe test checkout, portal, invalid webhook signature rejection and idempotent event handling.
8. Push registration, quiet hours, scheduled delivery and expired endpoint cleanup.
9. Account export and permanent deletion, including cancellation of an active Stripe subscription.
10. PWA install, offline fallback, deep links and page refresh under `/luminaf/`.

Do not call the system production-ready until these tests pass against the live Supabase project and Pages URL.
