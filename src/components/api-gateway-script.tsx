"use client";

import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window { __luminafApiBridge?: boolean; }
}

if (typeof window !== "undefined" && !window.__luminafApiBridge) {
  window.__luminafApiBridge = true;

  const nativeFetch = window.fetch.bind(window);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const basePath = (process.env.NEXT_PUBLIC_SITE_BASE_PATH || "").replace(/\/$/, "");

  const rewriteAnchor = (anchor: HTMLAnchorElement) => {
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("//") || raw.startsWith("#")) return;
    let url: URL;
    try { url = new URL(raw, window.location.origin); } catch { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

    let pathname = url.pathname;
    if (basePath && pathname !== basePath && !pathname.startsWith(basePath + "/")) {
      pathname = basePath + (pathname.startsWith("/") ? pathname : "/" + pathname);
    }
    if (!pathname.endsWith("/") && !/\.[a-z0-9]{1,8}$/i.test(pathname)) pathname += "/";
    const nextHref = pathname + url.search + url.hash;
    if (nextHref !== raw) anchor.setAttribute("href", nextHref);
  };

  const rewriteLinks = () => {
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach(rewriteAnchor);
  };

  rewriteLinks();
  if (document.documentElement) {
    new MutationObserver(rewriteLinks).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["href"],
    });
  }
  document.addEventListener("click", event => {
    const target = event.target;
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    if (anchor) rewriteAnchor(anchor);
  }, true);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const original = input instanceof Request ? input : null;
    const rawUrl = original ? original.url : input instanceof URL ? input.toString() : String(input);
    const requestUrl = new URL(rawUrl, window.location.href);
    if (requestUrl.origin !== window.location.origin || !requestUrl.pathname.startsWith("/api/")) {
      return nativeFetch(input, init);
    }
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: "Luminaf backend configuration is missing." }), {
        status: 503, headers: { "Content-Type": "application/json" },
      });
    }

    let accessToken = "";
    try {
      const { data, error } = await createClient().auth.getSession();
      if (!error) accessToken = data.session?.access_token || "";
    } catch {
      // The gateway will return a clear authentication response if no session is available.
    }

    const target = new URL(supabaseUrl.replace(/\/$/, "") + "/functions/v1/api-gateway");
    target.searchParams.set("path", requestUrl.pathname);
    if (requestUrl.search) target.searchParams.set("query", requestUrl.search.slice(1));

    const headers = new Headers(original?.headers);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set("apikey", anonKey);
    if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
    else headers.delete("Authorization");

    const method = init?.method || original?.method || "GET";
    let body: BodyInit | null | undefined = init && "body" in init ? init.body : undefined;
    if (body === undefined && original && method !== "GET" && method !== "HEAD") {
      body = await original.clone().arrayBuffer();
    }
    return nativeFetch(target.toString(), {
      ...init,
      method,
      headers,
      body,
      cache: "no-store",
      credentials: "omit",
      signal: init?.signal || original?.signal,
    });
  };
}

export function ApiGatewayScript() {
  return null;
}
