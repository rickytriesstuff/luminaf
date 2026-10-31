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

Luminaf is being migrated to **GitHub Pages + Supabase Edge Functions**. GitHub Pages serves only the static Next.js export; Supabase handles authentication, database, private storage and server-side operations. The frontend is configured for static export. The browser redirects `/api/*` calls to the authenticated Supabase Edge Function gateway; all Next.js API route handlers, middleware and server actions have been removed from this migration branch. Production Pages deployment still requires repository variables and a passing static build.

See [GitHub Pages + Supabase Edge Functions migration](docs/github-pages-supabase-migration.md) for the route-by-route plan, security model, OAuth/base-path setup and deployment gates.

## Current status
Frontend: responsive dark wellness dashboard, static-export-compatible Next.js app, PWA shell with offline fallback, Supabase browser authentication, onboarding, meal scanner, workouts, sleep, habit garden, progress, body metrics, reminders, Friends Zone, profile/settings and privacy controls.

Backend: the migration branch replaces the former Next.js API handlers with a Supabase Edge Function gateway and retains the scheduled push-dispatch worker. The gateway supports authenticated wellness CRUD, private meal photos and AI nutrition estimates, friends, points, reminders, billing, push subscriptions, weather, account export/deletion and Stripe webhook verification. New accounts receive the default seven-day trial from the signup migration. Writes are restricted by server-side subscription entitlements; reads remain available after expiry. Symptom guidance intentionally remains fail-closed.

The static build, lint, type checks, unit tests, Edge Function type checks and Playwright smoke tests pass in the migration branch. Production is still gated on deploying the functions, confirming database migrations and Auth redirect settings, adding repository variables/secrets, publishing through GitHub Pages and completing live account-isolation/payment/push tests. Do not interpret empty states or local preview counters as persisted wellness records.

## Supabase backend
See [docs/backend-setup.md](docs/backend-setup.md) for migration, Auth, private storage, and server API setup.
