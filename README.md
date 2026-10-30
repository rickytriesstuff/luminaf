# Luminaf

A dark, mobile-first wellness companion for habits, movement, nutrition awareness and sustainable progress.

> **Safety:** Luminaf is not a medical service. Meal analysis and symptom guidance, when enabled, are informational estimates only and are not a diagnosis or treatment. Emergency symptoms require real-world emergency care. The symptom endpoint currently fails closed rather than returning fabricated advice.

## Stack
Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Supabase, Zod, Recharts, Vitest and Playwright.

## Local setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Configure Supabase and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run `npm install`.
5. Start with `npm run dev`.

## Secrets
See [.env.example](.env.example). Never expose Supabase service-role, AI, Stripe secret, VAPID private, or cron credentials through `NEXT_PUBLIC_*`.

## Quality checks
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Vercel deployment
Deploy the Next.js app to Vercel, configure environment variables, set Supabase Auth redirect URLs, enable Apple as an OAuth provider in Supabase (Apple Developer Services ID, Team ID, Key ID and private key), enable Google if desired, apply migrations and configure storage policies before enabling user data. Configure payment webhooks and scheduled notification jobs only after their server-side handlers and signature checks are implemented.

## Current status
Foundation milestone: responsive dashboard shell, PWA manifest/icon, Supabase server client, BMI/BMR utilities, safety schemas and fail-closed symptom endpoint, privacy/terms starter pages, CI, initial private schema and architecture notes. Real auth/onboarding, persistent logs, vision meal analysis, workouts, push delivery, friend invitations, billing and data export/deletion remain to be implemented and verified. Dashboard figures are illustrative UI only, not user records.
