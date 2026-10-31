# GitHub Pages + Supabase Edge Functions migration

## Decision and current status

GitHub Pages remains the frontend host. Supabase remains the backend. Cloudflare Workers is not part of this deployment plan.

The migration implementation is committed on `feat/github-pages-supabase-edge-migration`. This branch enables Next.js static export, replaces server-side authentication flows, removes the Next.js API handlers and routes the existing browser `/api/*` calls through a Supabase Edge Function gateway. The previous production branch is not changed by this work.

**Production is not yet cut over.** The latest GitHub Actions CI run passed lint, TypeScript, unit tests, the Next.js static export build, Deno checks for both Edge Functions and Playwright smoke tests. Live Edge Function deployment, production migration state, Auth redirect configuration and real-account end-to-end checks remain outstanding. Keep the PR unmerged until the required GitHub Pages variables are present and the production cutover checklist is completed.

The implementation uses one authenticated `api-gateway` Edge Function with operation paths, rather than maintaining a separate Edge Function deployment for every API route. The separate `push-dispatch` function remains the scheduled notification worker.

## Target architecture

- **GitHub Pages:** static HTML, CSS, JS, PWA assets and route shells only.
- **Supabase Auth:** email/password, Google and Apple OAuth, PKCE sessions and refresh tokens.
- **Supabase Edge Functions:** privileged/server-side operations and third-party integrations.
- **Supabase Postgres + RLS:** all user-owned wellness records and entitlement checks.
- **Supabase Storage:** private meal-photo bucket and signed URLs.
- **GitHub Actions:** build static export and publish the `out/` directory to Pages.

Browser code may contain only the Supabase project URL and publishable/anon key. Never put a service-role/secret key, OpenAI key, Stripe secret, webhook secret, VAPID private key or cron secret into a `NEXT_PUBLIC_*` variable or static asset.

## Frontend conversion completed on the migration branch

- `next.config.mjs` now uses `output: "export"`, `trailingSlash: true`, `images.unoptimized: true` and the build-time `NEXT_PUBLIC_SITE_BASE_PATH`.
- Email/password, Google and Apple authentication now use the Supabase browser client. Static callback and password-reset pages exchange PKCE codes and update passwords.
- Onboarding writes the signed-in user's profile through the publishable client and RLS.
- Next middleware, server actions, callback route handler and all `src/app/api/**/route.ts` handlers have been removed from this branch.
- The root layout loads a before-interactive bridge that forwards existing `fetch("/api/...")` requests to the Supabase `api-gateway`, including the access token, request body and query parameters. It refreshes expired Supabase access tokens from the stored refresh token.
- The bridge also prefixes root-relative anchors for the Pages project subpath. The PWA manifest, service worker registration, cache scope and notification click URLs are base-path aware.
- Account export now downloads through the API bridge. Account deletion and sign-out use the browser/Supabase gateway flows.

The latest CI run completed successfully: lint, typecheck, unit tests, static export build, both Deno Edge Function checks and Playwright smoke tests all passed. This validates the build pipeline, not the live Supabase project or deployed Pages runtime.
 
## Edge Function migration inventory

Keep the existing public app routes/feature contracts, but move their implementations into the following functions. Each authenticated function should validate the caller's user JWT and use a user-scoped Supabase client so RLS remains effective. Use an admin/service-role client only for narrowly scoped tasks that genuinely require it.

| Existing Next API route | New Edge Function / operation | Required behavior |
|---|---|---|
| `GET/POST /api/water` | `api-gateway` / water | Read and create water logs; validate amount and date; user ownership and entitlement checks |
| `GET/POST /api/habits` | `api-gateway` / habits | List/create habits; preserve current schema and ownership |
| `POST /api/habits/checkins` | `api-gateway` / habit-checkins | Idempotent daily check-ins and points rules |
| `GET/POST /api/workouts` | `api-gateway` / workouts | Create/list workout logs |
| `GET/POST /api/sleep` | `api-gateway` / sleep | Create/list sleep logs |
| `GET/POST /api/metrics` | `api-gateway` / metrics | Create/list body metrics |
| `GET/POST /api/reminders` | `api-gateway` / reminders | Save/list reminder preferences and quiet hours |
| `GET /api/progress` | `api-gateway` / progress | Aggregate user-owned progress only |
| `GET /api/points` | `api-gateway` / points | Read trusted points summary; do not accept client-awarded points |
| `GET /api/exercises` | `api-gateway` / exercises | Return exercise library |
| `GET/POST /api/profile` | `api-gateway` / profile | Read/update current user's profile |
| `GET /api/notifications` | `api-gateway` / notifications | Read current user's notifications and read state |
| `GET/POST /api/friends` | `api-gateway` / friends | Friend list and invitation creation; expose only approved display name/points |
| `POST /api/friends/invite` | `api-gateway` / invite | Token generation, expiry and rate limiting |
| `POST /api/friends/accept` | `api-gateway` / accept | Validate one-time invitation token and create friendship |
| `GET/POST /api/meals` | `api-gateway` / meals | List/save meal records with ownership and entitlement checks |
| `POST /api/meals/save` | `api-gateway` / save | Validate AI result before storing |
| `POST /api/meals/analyze` | `api-gateway` / analyze | Accept bounded image upload, rate-limit, call OpenAI from server secret, validate structured output |
| `GET /api/health/symptoms` | `api-gateway` / symptoms | Preserve fail-closed behavior; do not enable generated diagnosis or unsafe medical advice |
| `GET /api/weather` | `api-gateway` / weather | Keep provider key server-side if one is ever required; validate location input |
| `GET /api/push/key` | `api-gateway` / public-key | Return only the VAPID public key |
| `POST/DELETE /api/push/subscriptions` | `api-gateway` / subscriptions | Bind subscriptions to authenticated user; delete only caller-owned endpoint |
| Existing `push-dispatch` | `push-dispatch` | Retain scheduled reminder/trial queue delivery; authenticate service/cron invocation independently of browser sessions |
| `GET /api/billing/status` | `api-gateway` / status | Read current user's entitlement/subscription status |
| `POST /api/billing/checkout` | `api-gateway` / checkout | Create Stripe checkout session server-side; never trust client price or user ID |
| `POST /api/billing/portal` | `api-gateway` / portal | Create customer portal session for authenticated customer |
| `POST /api/webhooks/stripe` | `api-gateway` | Public webhook; verify Stripe signature over raw body; idempotently record events and update subscription |
| `GET /api/account/export` | `api-gateway` / export | Export only caller-owned data and private object metadata |
| `POST /api/account/delete` | `api-gateway` / delete | Confirm deletion, cancel eligible billing, remove private photos and auth user safely |

The migration branch removes the Next.js API route handlers and routes their existing browser callers through the `api-gateway` Edge Function. The CI checks validate the gateway's Deno types and the static frontend, but each operation still needs live verification against the connected Supabase project before production cutover.

## Function security model

- `api-gateway` is configured with `verify_jwt = false` because it also receives the Stripe webhook. For every user operation, it reads the bearer token and explicitly calls Supabase Auth `getUser(token)` before creating user-scoped database operations. Missing/invalid tokens are rejected. This is the authentication boundary for the shared gateway.
- User-owned CRUD uses the caller's anon/publishable client with the verified bearer token, so PostgreSQL RLS and ownership policies remain active.
- Stripe webhook requests are handled before user auth and must pass a timestamped HMAC signature check over the exact raw body. The gateway records event IDs for idempotency.
- `push-dispatch` is configured with `verify_jwt = false` and independently requires the exact server-side service-role bearer credential. Never expose that credential to the browser.
- Admin operations use the service-role key only inside Edge Functions for points awards, account deletion and scheduled queue processing.
- CORS allows the configured GitHub Pages origin and local development origins. Requests use explicit bearer tokens, not cookies or credentialed cross-origin sessions.
- Preserve existing RLS policies, ownership constraints, AI quotas, subscription entitlements and trusted-points rules. Client-side hiding of controls is not authorization.

## Supabase function configuration and secrets

The migration branch configures `api-gateway` and `push-dispatch` with `verify_jwt = false`; each performs its own explicit request authentication as described above.

Set production secrets in Supabase Dashboard → Edge Functions → Secrets (or with `supabase secrets set`). The gateway uses:
- Required for origin checks: `SITE_URL=https://rickytriesstuff.github.io`, `SITE_BASE_PATH=/luminaf`.
- Meal scanner: `OPENAI_API_KEY`, optional `OPENAI_VISION_MODEL=gpt-4o-mini`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions. Never copy the service-role key into GitHub Pages variables, static assets or any `NEXT_PUBLIC_*` value.

The frontend build requires only the public `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key) and `NEXT_PUBLIC_SITE_BASE_PATH`.

## GitHub Pages build and deployment

The branch includes `.github/workflows/deploy-pages.yml`, which builds the static `out/` directory and deploys it through GitHub Pages Actions when changes reach `main`.

1. In repository Settings → Pages, choose **GitHub Actions** as the publishing source.
2. Add repository variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_BASE_PATH=/luminaf`. Use an empty base path only if a root custom domain is configured.
3. The workflow installs dependencies, runs `npm run build`, adds `.nojekyll`, uploads `out/` and deploys with the Pages actions.
4. Do not commit `.env.local`, service-role keys or any private provider credentials.

The branch also includes `.github/workflows/deploy-supabase.yml`. Add the GitHub secret `SUPABASE_ACCESS_TOKEN` to allow Edge Function deployment. SQL migration application is a manual opt-in and additionally requires `SUPABASE_DB_PASSWORD`.
 
## OAuth and route handling

- Set Supabase Auth Site URL to the exact Pages URL.
- Add exact redirect URLs for `/luminaf/auth/callback/` (project site) or `/auth/callback/` (root custom domain), plus localhost.
- Configure Google/Apple providers in Supabase before enabling their buttons.
- Because GitHub Pages does not provide server rewrite rules, every App Router path must be emitted as a real static route directory/file. Verify refresh/deep-link navigation for `/auth/`, `/onboarding/`, `/meals/`, `/friends/`, etc. If route fallback is required, use a tested static SPA fallback strategy that preserves the URL and query string; do not assume Next's server 404 handling exists.

## Migration gates (do not skip)

1. **Inventory:** identify all imports of server Supabase clients, server actions, middleware, API fetches and Node-only modules. Record each one in the route matrix above.
2. **Backend parity:** implement each Edge Function operation with the same validation, auth, response semantics and tests as its current API route.
3. **Frontend parity:** replace all API callers and server-only page logic; test OAuth callback and session refresh on static hosting.
4. **Static build:** only now enable `output: "export"`; run a clean production build and inspect the entire `out/` folder for every route, asset, manifest and service worker.
5. **Security:** test two independent accounts, RLS isolation, expired sessions, expired trials, malicious friend tokens, AI quota exhaustion, invalid Stripe signatures and unauthorized account deletion.
6. **Production rehearsal:** deploy to a Pages preview/rehearsal URL, apply migrations to the intended Supabase project only after backup, configure Auth URLs and secrets, then test all features on mobile and desktop.
7. **Cutover:** switch Pages to the new static artifact only after all critical tests pass. Keep the previous working deployment/commit available for rollback.

## Acceptance checklist

- [ ] Static build succeeds without Next server/API/middleware/server-action dependencies.
- [ ] Every page and deep link works on GitHub Pages, including refresh and PWA install.
- [ ] Email/password signup, login, logout, reset and OAuth callback work.
- [ ] Water, habits, meals, workouts, sleep, metrics, reminders, progress and profile persist per account.
- [ ] Meal photo upload remains private; AI analysis works and is rate-limited.
- [ ] Friends invitations and points sharing preserve the existing privacy boundary.
- [ ] Subscription trial gating and Stripe checkout/portal/webhook work if billing is enabled.
- [ ] Account export and deletion work end-to-end.
- [ ] Push registration and scheduled delivery work if push is enabled.
- [ ] Symptom feature remains fail-closed unless a safe, reviewed provider workflow is explicitly enabled.
- [ ] No secret keys are present in the generated `out/` files or source maps.

## Official references

- [GitHub Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages Actions publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Edge Function authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
- [Edge Function CORS](https://supabase.com/docs/guides/functions/cors)
- [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)

## Implementation status on this branch

The frontend conversion is now committed on `feat/github-pages-supabase-edge-migration`:
- Next.js static export is enabled with trailing-slash routes, unoptimized images and configurable `NEXT_PUBLIC_SITE_BASE_PATH`.
- Browser authentication now uses Supabase JS for email/password, Google, Apple, password reset, PKCE callback and profile onboarding. The legacy server actions and middleware have been removed.
- The Next.js API route handlers have been removed from this branch. Existing `fetch("/api/...")` callers are kept working through a before-interactive browser bridge that forwards requests to `api-gateway` with the current Supabase access token.
- The Edge gateway covers wellness CRUD, meals and AI analysis, friends/invitations, profile, progress, reminders, notifications, points, weather, push subscription registration, billing checkout/portal/status, Stripe webhook, account export/deletion and fail-closed symptom requests. Legacy multipart meal-save is supported too.
- `push-dispatch` remains the scheduled notification worker and now builds Pages-scoped notification destinations.
- GitHub Actions workflows have been added for static Pages deployment and Supabase function deployment. SQL migration application is an explicit manual opt-in in the Supabase workflow.

**Verified in CI:** Next.js static build, lint, TypeScript, unit tests, Deno type-check for both Edge Functions and Playwright smoke tests. **Not yet verified in production:** live Edge Function deployment, Supabase SQL migration state, GitHub Pages cutover, OAuth redirect configuration, optional VAPID/Stripe/OpenAI secrets and end-to-end real-account tests. Keep the PR unmerged until the required Pages variables and Auth URL configuration are confirmed, then complete the production acceptance checklist below.

### Required GitHub repository variables
- `NEXT_PUBLIC_SUPABASE_URL` = the Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the Supabase publishable/anon key (public key only).
- `NEXT_PUBLIC_SITE_BASE_PATH` = `/luminaf` for the default project Pages URL, or empty for a root custom domain.

### Required GitHub repository secrets
- `SUPABASE_ACCESS_TOKEN` for the Edge Function deployment workflow.
- `SUPABASE_DB_PASSWORD` only if manually opting into database migration application.

### Supabase Edge Function secrets
Set these in the Supabase project dashboard, not in GitHub Pages build variables:
- Required: `SITE_URL=https://rickytriesstuff.github.io`, `SITE_BASE_PATH=/luminaf`.
- Required for privileged awards/deletion and queue worker: Supabase service role key is injected by Supabase as `SUPABASE_SERVICE_ROLE_KEY`.
- Meal scanner: `OPENAI_API_KEY`, optional `OPENAI_VISION_MODEL=gpt-4o-mini`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

The service-role, OpenAI, Stripe, VAPID private and cron credentials must never be put in Pages variables, client JavaScript or `NEXT_PUBLIC_*` values.
