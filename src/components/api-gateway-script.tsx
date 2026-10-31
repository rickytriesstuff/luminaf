import Script from "next/script";

const bridgeCode = `(() => {
  if (window.__luminafApiBridge) return;
  window.__luminafApiBridge = true;\n  const siteBasePath = ${JSON.stringify(process.env.NEXT_PUBLIC_SITE_BASE_PATH || "")};\n  document.addEventListener("click", (event) => { const node = event.target; const anchor = node instanceof Element ? node.closest("a[href]") : null; if (!anchor) return; const u = new URL(anchor.href, location.href); if (u.origin !== location.origin || !siteBasePath || u.pathname.startsWith(siteBasePath + "/") || u.pathname === siteBasePath || u.pathname.startsWith("/api/") || u.pathname.startsWith("/_next/")) return; u.pathname = siteBasePath + u.pathname; anchor.href = u.toString(); }, true);
  const nativeFetch = window.fetch.bind(window);
  const supabaseUrl = ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || "")};
  const anonKey = ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")};
  window.fetch = async (input, init) => {
    const original = input instanceof Request ? input : null;
    const requestUrl = new URL(original ? original.url : String(input), window.location.href);
    if (!requestUrl.pathname.startsWith("/api/")) return nativeFetch(input, init);
    if (!supabaseUrl || !anonKey) return new Response(JSON.stringify({error:"Luminaf backend is not configured."}), {status:503,headers:{"Content-Type":"application/json"}});
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    let accessToken = "";
    try {
      const raw = localStorage.getItem("sb-" + projectRef + "-auth-token");
      if (raw) accessToken = JSON.parse(raw).access_token || "";
    } catch {}
    const target = new URL(supabaseUrl.replace(/\/$/, "") + "/functions/v1/api-gateway");
    target.searchParams.set("path", requestUrl.pathname);\n    if (requestUrl.search) target.searchParams.set("query", requestUrl.search.slice(1));
    const headers = new Headers(original ? original.headers : undefined);
    if (init && init.headers) new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
    headers.set("apikey", anonKey);
    if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
    else headers.delete("Authorization");
    const method = (init && init.method) || (original && original.method) || "GET";
    const body = init && "body" in init ? init.body : (original && method !== "GET" && method !== "HEAD" ? await original.clone().arrayBuffer() : undefined);
    return nativeFetch(target.toString(), {method,headers,body,cache:"no-store",credentials:"omit",signal:init && init.signal ? init.signal : original ? original.signal : undefined});
  };
})();`;

export function ApiGatewayScript() {
  return <Script id="luminaf-api-gateway" strategy="beforeInteractive">{bridgeCode}</Script>;
}
