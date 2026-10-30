# Product and engineering decisions

- **Health safety:** symptom guidance remains unavailable until a clinically reviewed provider and escalation protocol are configured. Emergency red-flag screening stays visible and directs users to real emergency care.
- **Privacy:** all personal wellness tables use row-level security. Friend sharing is restricted to display names and points totals, never meal, weight, sleep, symptom or other health records.
- **Meal photos:** stored in a private bucket under a user-ID folder; short-lived signed URLs are returned to the owner only.
- **Trials:** a database trigger creates the profile and a seven-day fallback trial at signup. The server-only `TRIAL_DAYS` setting adjusts the newly created trial once; it does not reset returning users' trials.
- **Expired accounts:** read access remains available. Write APIs enforce active trial/subscription entitlements and preserve existing data.
- **Reminders:** preference records persist with timezone and quiet-hour settings. Actual push delivery is not claimed until the scheduler and delivery worker exist.
- **Points:** clients cannot write to the points ledger. A trusted server-side award workflow must be implemented before XP is displayed as earned.
- **Weather:** use Open-Meteo without a key and request geolocation only with explicit browser permission.
- **Payments:** Stripe is the initial provider abstraction; keep subscription records provider-neutral so PayPal can be added later.
