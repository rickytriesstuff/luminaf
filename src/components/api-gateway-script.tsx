/* eslint-disable @next/next/no-before-interactive-script-outside-document */
import Script from "next/script";

const bridgeCode = `(() => {
  if (window.__luminafApiBridge) return;
  window.__luminafApiBridge = true;
  const siteBasePath = ${JSON.stringify(process.env.NEXT_PUBLIC_SITE_BASE_PATH || "")};
  document.addEventListener("click", (event) => { const node = event.target; const anchor = node instanceof Element ? node.closest("a[href]") : null; if (!anchor) return; const u = new URL(anchor.href, location.href); if (u.origin !== location.origin || !siteBasePath || u.pathname.startsWith(siteBasePath + "/") || u.pathname === siteBasePath || u.pathname.startsWith("/api/") || u.pathname.startsWith("/_next/")) return; u.pathname = siteBasePath + u.pathname; anchor.href = u.toString(); }, true);
  const nativeFetch = window.fetch.bind(window);
  const supabaseUrl = ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || "")};
  const anonKey = ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")};
  window.fetch = async (input, init) => {
    const original = input instanceof Request ? input : null;
    const requestUrl = new URL(original ? original.url : String(input), window.location.href);
    if (!requestUrl.pathname.startsWith("/api/")) return nativeFetch(input, init);
    if (!supabaseUrl || !anonKey) return new Response(JSON.stringify({error:"Luminaf backend is not configured."}), {status:503,headers:{"Content-Type":"application/json"}});
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const storageKey = "sb-" + projectRef + "-auth-token";
    let session = null;
    try { const raw = localStorage.getItem(storageKey); if (raw) session = JSON.parse(raw); } catch {}
    const refreshSession = async () => {
      if (!session || !session.refresh_token) return "";
      try {
        const response = await nativeFetch(supabaseUrl.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token", {
          method:"POST", headers:{"apikey":anonKey,"Content-Type":"application/json"},
          body:JSON.stringify({refresh_token:session.refresh_token}), credentials:"omit"
        });
        if (!response.ok) return "";
        const fresh = await response.json();
        session = {...session,...fresh};
        localStorage.setItem(storageKey,JSON.stringify(session));
        return session.access_token || "";
      } catch { return ""; }
    };
    let accessToken = session && session.access_token || "";
    const expiresAt = session && (session.expires_at || (session.expires_in ? Math.floor(Date.now()/1000)+session.expires_in : 0));
    if (session && session.refresh_token && (!accessToken || !expiresAt || expiresAt < Math.floor(Date.now()/1000)+60)) accessToken = await refreshSession() || accessToken;
    const target = new URL(supabaseUrl.replace(/\/$/, "") + "/functions/v1/api-gateway");
    target.searchParams.set("path", requestUrl.pathname);
    if (requestUrl.search) target.searchParams.set("query", requestUrl.search.slice(1));
    const headers = new Headers(original ? original.headers : undefined);
    if (init && init.headers) new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
    headers.set("apikey", anonKey);
    const method = (init && init.method) || (original && original.method) || "GET";
    const body = init && "body" in init ? init.body : (original && method !== "GET" && method !== "HEAD" ? await original.clone().arrayBuffer() : undefined);
    const send = (token) => { const requestHeaders = new Headers(headers); if (token) requestHeaders.set("Authorization","Bearer "+token); else requestHeaders.delete("Authorization"); return nativeFetch(target.toString(), {method,headers:requestHeaders,body,cache:"no-store",credentials:"omit",signal:init && init.signal ? init.signal : original ? original.signal : undefined}); };
    let response = await send(accessToken);
    if (response.status === 401 && session && session.refresh_token) { const renewed = await refreshSession(); if (renewed) response = await send(renewed); }
    return response;
  };
})();`;

export function ApiGatewayScript() {
  return <Script id="luminaf-api-gateway" strategy="beforeInteractive">{bridgeCode}</Script>;
}
