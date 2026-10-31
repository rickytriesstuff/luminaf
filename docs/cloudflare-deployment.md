# Cloudflare Workers deployment

Luminaf runs as a full Next.js application on Cloudflare Workers using the OpenNext adapter. It is not a static export: authenticated route handlers, middleware, server-side Supabase cookie sessions and server actions require a server runtime.

## 1. GitHub Actions deployment credentials

In GitHub repository Settings → Secrets and variables → Actions, add these **repository secrets**:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers Scripts: Edit permission for the target account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon key.

Add this **repository variable**:

- `NEXT_PUBLIC_APP_URL`: exact production origin. On the first deployment this is not known yet. Set it to the assigned `https://luminaf.<workers-subdomain>.workers.dev` origin after the first successful deployment, then rerun the workflow.

The workflow deploys automatically on pushes to `main`, and can also be started manually from Actions. Never commit credentials.

## 2. Cloudflare Worker runtime variables and secrets

In Cloudflare Dashboard → Workers & Pages → luminaf → Settings → Variables and Secrets, configure the runtime values below. Mark sensitive values as **Secrets**.

**Variables**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `TRIAL_DAYS` (normally `7`)
- `OPENAI_VISION_MODEL` (normally `gpt-4o-mini`)
- `OPENAI_TEXT_MODEL` (normally `gpt-4o-mini`)
- `STRIPE_PRICE_ID` (only after billing is configured)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (only after billing is configured)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (only after web push is configured)
- `VAPID_SUBJECT` (only after web push is configured)

**Secrets**
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VAPID_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `CRON_SECRET`

Only add billing and push credentials after those providers are configured. Never expose service-role, OpenAI, Stripe, VAPID private, or cron credentials to browser code. Public Supabase values must match in GitHub Actions and Worker runtime settings. Keep `NEXT_PUBLIC_APP_URL` identical in both places after the first deployment.

## 3. Supabase setup

Follow [backend-setup.md](backend-setup.md):
1. Back up any existing production database.
2. Apply all ordered migrations in `supabase/migrations` to the intended Supabase project.
3. Enable Email/password authentication and configure the production Site URL and `/auth/callback` redirect URL.
4. Enable Google only after configuring its OAuth credentials in Supabase.
5. Keep `meal-photos` private and retain per-user storage policies.
6. Verify RLS and account isolation with two independent test accounts.

The Worker deployment does not apply SQL migrations automatically.

## 4. Local build and deploy

Use Node.js 20+:

```bash
npm install
npm run cf:build
npm run cf:preview
npm run cf:deploy
```

## 5. Production smoke tests

Before inviting users, test:
- Sign-up, sign-in, sign-out, password reset and auth callback redirects.
- Session persistence after refresh and on a second device.
- Create/read/update/delete water, habits, meals, workouts, sleep, metrics and reminders.
- Private meal-photo upload and signed URL access.
- Friend invitations and points-only sharing with two accounts.
- Trial expiry and write restrictions.
- Stripe checkout, webhook signature verification and customer portal, only after Stripe setup.
- Export and account deletion.
- Mobile PWA install, offline fallback and responsive layouts.

A successful Worker deploy does not by itself mean migrations, billing, push delivery or every optional integration is configured. Verify each enabled feature against production services.
