# Architecture

- Next.js 14 App Router, TypeScript, Tailwind and Framer Motion.
- Supabase Auth/Postgres/Storage is the intended data platform. Every user-owned table must enforce RLS.
- Server-only API routes own AI, billing and notification credentials.
- Validate requests with Zod; authenticate and enforce ownership/entitlement before database access.
- Treat AI output as untrusted, validate strict schemas and use safe fallbacks.
- Health photos belong in private storage with short-lived signed URLs, compression, consent and deletion support.

## Safety
The symptom route currently fails closed. A conservative red-flag pre-screen routes possible emergencies to real-world emergency care. Keyword matching is not a medical-grade detector and must never be the only safety control. Production launch requires clinical/legal review, localized emergency guidance and tested escalation flows.

## Friends zone
Friendships require explicit acceptance and opt-in sharing. Share only points, streaks and selected activity summaries. Never expose symptoms, meals, body metrics, photos or private health logs by default.
