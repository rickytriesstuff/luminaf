# Product decisions

- Product name is Luminaf and should remain easy to rename through metadata and UI constants.
- Near-black surfaces with mint/neon accents; avoid low-contrast neon body copy.
- Health calculations and meal analysis are estimates and must be labeled accordingly.
- Symptom guidance fails closed until a medically reviewed provider integration exists. A conservative keyword pre-screen is not a medical-grade detector and cannot rule out emergencies.
- Friends sharing is opt-in and limited to display name and points totals. Health records remain private.
- Friend invite tokens are random, stored only as hashes, single-use and expire after seven days.
- Meal photos are stored in a private Supabase bucket and can only be accessed by their owner.
- AI endpoints require authentication, validate image inputs and apply database-backed per-user request limits.
- Initial delivery is staged; do not represent unimplemented integrations as operational.
