# Luminaf production integrations

This release keeps all provider secrets server-side. Never put secret keys in frontend code, GitHub Actions Variables, public files, or chat messages.

## Supabase Edge Function secrets

Supabase project: `cgigviwpnvlidguhspnf`

Set these under Supabase Dashboard → Project Settings → Edge Functions → Secrets (or the Edge Functions secrets page):

| Secret | Used for | Required |
|---|---|---|
| `OPENAI_API_KEY` | AI meal photo analysis | Yes, for scanner |
| `OPENAI_VISION_MODEL` | Optional vision model override; defaults to `gpt-4o-mini` | No |
| `STRIPE_SECRET_KEY` | Stripe Checkout and Billing Portal | Yes, for payments |
| `STRIPE_PRICE_ID` | Recurring Stripe Price ID | Yes, for payments |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures | Yes, for payments |
| `VAPID_PUBLIC_KEY` | Browser push application server public key | Yes, for push |
| `VAPID_PRIVATE_KEY` | Browser push signing key | Yes, for push |
| `VAPID_SUBJECT` | Contact URI such as `mailto:support@yourdomain.com` | Yes, for push |
| `SITE_URL` | `https://rickytriesstuff.github.io` | Yes |
| `SITE_BASE_PATH` | `/luminaf` | Yes |

Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never expose the service-role key in the browser.

## AI meal scanner

The photo scanner is available at Meals → Scan what’s on your plate. It sends the image to the authenticated `api-gateway` Edge Function, which calls OpenAI and returns a reviewable estimate. Users must review the result and explicitly save it. The scanner enforces an 8 MB image limit and a per-user analysis rate limit. Estimates are not medical advice and may be inaccurate.

Set `OPENAI_API_KEY` as an Edge Function secret. No key is needed in GitHub Pages or the frontend.

## Stripe payments

The subscription page calls authenticated `/api/billing/status`, `/api/billing/checkout` and `/api/billing/portal` routes through the Edge Function.

1. Create a recurring Product and Price in Stripe.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` as Edge Function secrets.
3. Add a Stripe webhook endpoint:
   `https://cgigviwpnvlidguhspnf.supabase.co/functions/v1/api-gateway?path=%2Fapi%2Fwebhooks%2Fstripe`
4. Subscribe to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, and `invoice.payment_failed`.
5. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

Do not enable paid access until the Stripe test-mode checkout and signed webhook have both been verified. The user-facing page intentionally stays disabled until the required secrets exist.

## Push reminders

The reminders page lets users choose local reminder times and register the browser. The Edge Function `push-dispatch` sends due notifications. The GitHub Actions workflow `.github/workflows/push-reminders.yml` invokes it every five minutes.

1. Generate a VAPID public/private key pair and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in Supabase Edge Function secrets.
2. Add the same `VAPID_PUBLIC_KEY` as a GitHub Actions repository **Variable** named `NEXT_PUBLIC_VAPID_PUBLIC_KEY` only if a future frontend build reads it. Current subscription setup reads the public key from the authenticated backend route.
3. Add `SUPABASE_SERVICE_ROLE_KEY` as a GitHub Actions **Secret** for the scheduled dispatcher. This is server-only and must never be exposed to the browser.
4. The Supabase database migration `202610310011_push_delivery_queue.sql` and `202610310014_trial_reminder_tracking.sql` must already be applied before scheduling delivery.

The workflow runs every five minutes. GitHub scheduled workflows may be delayed during high load. Verify a manual dispatch before relying on reminders.

## Google and Apple sign-in

The auth page already has Google and Apple OAuth buttons and uses Supabase OAuth PKCE. In Supabase Authentication → Sign In / Providers:

- Enable Google and enter the OAuth client ID and client secret from Google Cloud.
- Enable Apple and enter the Apple Services ID, Team ID, Key ID and private key as required by Supabase.
- In each provider console, allow the Supabase callback URL shown by the Supabase provider setup.
- Confirm the Supabase URL configuration includes `https://rickytriesstuff.github.io/luminaf/**`.

The app callback is `https://rickytriesstuff.github.io/luminaf/auth/callback/`. Provider credentials are separate from the app's publishable Supabase key.

## Deployment

- GitHub Pages publishes the static frontend on pushes to `main`.
- The Supabase workflow deploys both `api-gateway` and `push-dispatch` Edge Functions.
- The push scheduler workflow is separate and requires the GitHub Actions secret `SUPABASE_SERVICE_ROLE_KEY`.
- Database migrations are not automatically applied. Review and back up the database before applying any pending migrations.
