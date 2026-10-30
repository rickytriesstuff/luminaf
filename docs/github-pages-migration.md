# GitHub Pages migration status

Target site: https://rickytriesstuff.github.io/luminaf/

## Hosting constraint

GitHub Pages serves static files only. It cannot execute Next.js route handlers, middleware, server actions, or server-rendered pages. Do not enable `output: "export"` until those dependencies have been removed or moved to Supabase Edge Functions.

## Required application work

- Convert the auth page and onboarding page to client components using the Supabase browser client.
- Replace the server-side OAuth callback route with a static callback page that exchanges the PKCE code in the browser.
- Replace all `/api/*` calls with authenticated Supabase Edge Function calls or direct Supabase queries protected by RLS.
- Move billing webhooks, Stripe secret operations, account deletion/export, AI provider calls, and push dispatch to Edge Functions. Keep service-role, Stripe, AI, and VAPID private keys in Supabase Function secrets only.
- Remove Next middleware and server-only Supabase helpers after all consumers are migrated.
- Audit all app routes and dependencies for static-export compatibility.
- Configure `basePath: "/luminaf"`, static export, asset paths, manifest, icons, and service worker scope.
- Add a GitHub Actions Pages workflow that builds and deploys the `out/` directory.
- Verify deep links, sign-in, OAuth providers, data writes, and mobile PWA behavior on the published Pages URL.

## Supabase setup required

In the Supabase dashboard, configure the project URL and anon/publishable key as GitHub Actions repository variables (or build-time public environment variables). Configure the Site URL and redirect allow-list to include:

- `https://rickytriesstuff.github.io/luminaf/`
- `https://rickytriesstuff.github.io/luminaf/auth/callback`

Enable Google and Apple providers only after their provider credentials are configured. Apply reviewed SQL migrations before enabling the corresponding features.

Never place the Supabase service-role key, Stripe secret key, AI provider keys, or VAPID private key in the frontend or GitHub Pages build.

## Deployment safety

The current application is not yet safe to deploy as a static export. A partial export would break API-backed features and authentication. Keep the current live site unchanged until the static build and end-to-end checks pass.
