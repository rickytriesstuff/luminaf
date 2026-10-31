import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * GitHub Pages is a static host: there is no Next.js middleware/server process
 * available to refresh SSR auth cookies. Persist the browser session directly
 * in the origin's localStorage so it survives route changes and page reloads.
 */
export function createClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("The Supabase browser client can only be used in the browser.");
  }

  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Add the public URL and anon key.");
  }

  browserClient = createSupabaseClient(url, key, {
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      // The static callback page explicitly exchanges the OAuth code. Disable the
      // SDK's automatic URL detection so it cannot race that exchange and
      // consume the one-time PKCE verifier before the callback handler does.
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });

  return browserClient;
}
