# Luminaf

A dark, mobile-first wellness companion for habits, movement, nutrition awareness and sustainable progress.

> **Safety:** Luminaf is not a medical service. Meal analysis and symptom guidance, when enabled, are informational estimates only and are not a diagnosis or treatment. Emergency symptoms require real-world emergency care. The symptom endpoint currently fails closed rather than returning fabricated advice.

## Stack
Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Supabase, Zod, Recharts, Vitest and Playwright.

## Local setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project, copy `.env.example` to `.env.local`, and configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Run `npm install`.
5. Start with `npm run dev`.

## Secrets
See [.env.example](.env.example). Never expose Supabase service-role, AI, Stripe secret, VAPID private, or cron credentials through `NEXT_PUBLIC_*`.

## Quality checks
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Deployment

Luminaf is being migrated to **GitHub Pages + Supabase Edge Functions**. GitHub Pages serves only the static Next.js export; Supabase handles authentication, database, private storage and server-side operations. The current app still has server routes/actions and is not ready for static export yet. Do not enable `output: "export"` or replace the live Pages artifact until every operation has been ported and the acceptance checklist passes.

See [GitHub Pages + Supabase Edge Functions migration](docs/github-pages-supabase-migration.md) for the route-by-route plan, security model, OAuth/base-path setup and deployment gates.

## Current status
Frontend milestone: responsive dark wellness dashboard, installable PWA shell with offline fallback, auth and onboarding screens, AI meal scanner UI, workout and sleep tracker UI, habit garden, progress dashboard, body metrics, reminder preferences, starter weekly plans, profile/settings, Friends Zone and safety-first health check-in. The meal scanner, Friends Zone, water logs, habit check-ins, body measurements, reminder preferences, profile updates, workout logs and sleep logs have authenticated server APIs. Signup creates a private profile and a seven-day trial record; `TRIAL_DAYS` adjusts new-user trials when the server service key is configured. Write APIs enforce server-side trial/subscription entitlements while reads remain available after expiry. These APIs require Supabase migrations and environment variables to be configured. Stripe checkout/webhooks/customer portal, push delivery and cron scheduling, AI symptom guidance, weather-aware plans, points award automation, export/deletion and production observability remain to be completed. Do not interpret local preview counters or empty states as persisted health records.

## Supabase backend
See [docs/backend-setup.md](docs/backend-setup.md) for migration, Auth, private storage, and server API setup.
