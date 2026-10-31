# GitHub Pages + Supabase Edge Functions migration

## Decision and current status

GitHub Pages remains the frontend host. Supabase remains the backend. Cloudflare Workers is not part of this deployment plan.

**Important: do not turn on `output: "export"` or publish the current Next.js build yet.** The current application is not static-export compatible. It still contains 27 Next.js API route handlers, server actions, a cookie-refresh middleware, server-side Supabase clients, a server callback route and Node-only APIs. A static export cannot run those handlers. Switching the config first would break sign-in and app features.

This document is the migration blueprint. The work is complete only after each server feature has been ported, browser callers have been changed to invoke Edge Functions, the static export succeeds, and the production smoke tests pass.

## Target architecture

- **GitHub Pages:** static HTML, CSS, JS, PWA assets and route shells only.
- **Supabase Auth:** email/password, Google and Apple OAuth, PKCE sessions and refresh tokens.
- **Supabase Edge Functions:** privileged/server-side operations and third-party integrations.
- **Supabase Postgres + RLS:** all user-owned wellness records and entitlement checks.
- **Supabase Storage:** private meal-photo bucket and signed URLs.
- **GitHub Actions:** build static export and publish the `out/` directory to Pages.

Browser code may contain only the Supabase project URL and publishable/anon key. Never put a service-role/secret key, OpenAI key, Stripe secret, webhook secret, VAPID private key or cron secret into a `NEXT_PUBLIC_*` variable or static asset.

## Critical frontend changes before static export

1. Replace all Next.js server actions in `src/app/auth/actions.ts` and `src/app/onboarding/actions.ts` with browser Supabase Auth calls and client-side profile writes protected by RLS.
2. Rewrite `src/app/auth/page.tsx` and `src/app/onboarding/page.tsx` as client-compatible static pages. Remove server `searchParams`, `cookies()`, `redirect()` and `"use server"` dependencies.
3. Replace `src/middleware.ts` with a client-side session provider/route guard. Static hosting cannot refresh Supabase cookies through Next middleware. Use `supabase.auth.getSession()` for UI state and `getUser()`/JWT validation at the function boundary for protected operations. Do not treat client route guards as authorization.
4. Replace `src/app/auth/callback/route.ts` with a static `/auth/callback/` page that reads the OAuth `code` from the URL, calls `supabase.auth.exchangeCodeForSession(code)`, then routes to onboarding/home. Handle errors and clear the query string after processing.
5. Replace every `fetch("/api/...")` with a typed API client based on `supabase.functions.invoke()`. Preserve each operation's HTTP semantics, validation, error messages, multipart image handling and response shape. Do not silently point the old relative URLs at GitHub Pages.
6. Convert any page/component importing `@/lib/supabase/server`, `@/lib/supabase/admin`, Next server actions, `next/headers`, or dynamic server-only data fetching into browser-side Supabase reads or Edge Function calls. Audit all App Router pages, not just the dashboard.
7. Set `output: "export"`, `images.unoptimized: true`, and the correct base path only after the above work is complete. For the default project Pages URL the path is `/luminaf`; for a configured custom domain at the root it is empty. Confirm the actual Pages domain in repository Settings before choosing. Next's `basePath` must be applied consistently to all assets, manifest icons, service-worker scope/start URL, OAuth redirects and plain HTML anchors. Replace root-relative `href="/..."` links with a shared `sitePath()` helper or Next links that respect basePath.
8. Export-compatible route pages need static shells. Ensure no route relies on request-time search params or dynamic server rendering. Use `trailingSlash: true` or equivalent static route handling and test deep links and refreshes on Pages.

## Edge Function migration inventory

Keep the existing public app routes/feature contracts, but move their implementations into the following functions. Each authenticated function should validate the caller's user JWT and use a user-scoped Supabase client so RLS remains effective. Use an admin/service-role client only for narrowly scoped tasks that genuinely require it.

| Existing Next API route | New Edge Function / operation | Required behavior |
|---|---|---|
| `GET/POST /api/water` | `wellness-api` / water | Read and create water logs; validate amount and date; user ownership and entitlement checks |
| `GET/POST /api/habits` | `wellness-api` / habits | List/create habits; preserve current schema and ownership |
| `POST /api/habits/checkins` | `wellness-api` / habit-checkins | Idempotent daily check-ins and points rules |
| `GET/POST /api/workouts` | `wellness-api` / workouts | Create/list workout logs |
| `GET/POST /api/sleep` | `wellness-api` / sleep | Create/list sleep logs |
| `GET/POST /api/metrics` | `wellness-api` / metrics | Create/list body metrics |
| `GET/POST /api/reminders` | `wellness-api` / reminders | Save/list reminder preferences and quiet hours |
| `GET /api/progress` | `wellness-api` / progress | Aggregate user-owned progress only |
| `GET /api/points` | `wellness-api` / points | Read trusted points summary; do not accept client-awarded points |
| `GET /api/exercises` | `wellness-api` / exercises | Return exercise library |
| `GET/POST /api/profile` | `wellness-api` / profile | Read/update current user's profile |
| `GET /api/notifications` | `wellness-api` / notifications | Read current user's notifications and read state |
| `GET/POST /api/friends` | `social-api` / friends | Friend list and invitation creation; expose only approved display name/points |
| `POST /api/friends/invite` | `social-api` / invite | Token generation, expiry and rate limiting |
| `POST /api/friends/accept` | `social-api` / accept | Validate one-time invitation token and create friendship |
| `GET/POST /api/meals` | `meals-api` / meals | List/save meal records with ownership and entitlement checks |
| `POST /api/meals/save` | `meals-api` / save | Validate AI result before storing |
| `POST /api/meals/analyze` | `meals-api` / analyze | Accept bounded image upload, rate-limit, call OpenAI from server secret, validate structured output |
| `GET /api/health/symptoms` | `health-api` / symptoms | Preserve fail-closed behavior; do not enable generated diagnosis or unsafe medical advice |
| `GET /api/weather` | `wellness-api` / weather | Keep provider key server-side if one is ever required; validate location input |
| `GET /api/push/key` | `push-api` / public-key | Return only the VAPID public key |
| `POST/DELETE /api/push/subscriptions` | `push-api` / subscriptions | Bind subscriptions to authenticated user; delete only caller-owned endpoint |
| Existing `push-dispatch` | `push-dispatch` | Retain scheduled reminder/trial queue delivery; authenticate service/cron invocation independently of browser sessions |
| `GET /api/billing/status` | `billing-api` / status | Read current user's entitlement/subscription status |
| `POST /api/billing/checkout` | `billing-api` / checkout | Create Stripe checkout session server-side; never trust client price or user ID |
| `POST /api/billing/portal` | `billing-api` / portal | Create customer portal session for authenticated customer |
| `POST /api/webhooks/stripe` | `stripe-webhook` | Public webhook; verify Stripe signature over raw body; idempotently record events and update subscription |
| `GET /api/account/export` | `account-api` / export | Export only caller-owned data and private object metadata |
| `POST /api/account/delete` | `account-api` / delete | Confirm deletion, cancel eligible billing, remove private photos and auth user safely |

The existing app currently has one Edge Function, `push-dispatch`; the other route implementations have not yet been ported. Do not remove the Next API routes until the replacement function and browser caller are tested.

## Function security model

- User-facing functions: leave platform JWT verification enabled. Invoke them through the signed-in Supabase client so the user access token is sent as `Authorization: Bearer <JWT>`. Validate the user in the function and use a user-scoped client for ordinary CRUD.
- Public endpoints: expose only genuinely public data/operations. Apply strict input validation, rate limits and abuse controls.
- Stripe webhook: disable JWT verification only for this function, then verify `stripe-signature` using Stripe's Deno-compatible asynchronous Web Crypto provider over the exact raw request body. Never accept a webhook based only on JSON contents.
- Scheduled push dispatch: disable browser JWT verification only if needed for the scheduler, then require a dedicated server-side cron credential or authenticated service-to-service mechanism. Never ship it to the browser.
- Admin operations: keep the service-role key exclusively in Edge Function secrets. Use it only after verifying the caller/operation and only for the minimal privileged action.
- CORS: allow the exact GitHub Pages production origin and localhost development origin; support OPTIONS preflight and required Supabase headers. Do not use wildcard origins with credentialed requests.
- Preserve all existing RLS policies, ownership constraints, AI quotas, trial/subscription entitlements and trusted-points rules. Client-side hiding of buttons is not an access-control boundary.

## Supabase function configuration and secrets

Add one `[functions.<name>]` section per function to `supabase/config.toml`. Keep JWT verification on for authenticated user functions. Set `verify_jwt = false` only for Stripe webhook and scheduled/internal entry points that perform their own authentication.

Set production secrets in Supabase Dashboard → Edge Functions → Secrets (or with `supabase secrets set`). Expected server-side secrets, only when the corresponding feature is enabled:

- `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`, `OPENAI_TEXT_MODEL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `CRON_SECRET` (or another dedicated scheduler credential)

Supabase injects its project URL and server keys into Edge Functions. Do not duplicate secrets into client-side build variables. The frontend build needs only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key) and the public site base path.

## GitHub Pages build and deployment

After static-export compatibility is achieved:

1. Configure repository Pages to publish with GitHub Actions.
2. Add a workflow that runs Node 20, installs locked dependencies with `npm ci`, sets only public build-time variables, runs lint/typecheck/tests and `npm run build`, verifies `out/index.html`, writes `.nojekyll` if needed, uploads `out/` with `actions/upload-pages-artifact`, and deploys with `actions/deploy-pages`.
3. Use repository variable `NEXT_PUBLIC_SITE_BASE_PATH=/luminaf` for the project site, or an empty value if a custom domain is configured at the origin root.
4. Set Pages deployment permissions to read contents and write Pages/id-token as required by the official workflow.
5. Do not commit `.env.local`, secret keys or a populated `.dev.vars`.

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
