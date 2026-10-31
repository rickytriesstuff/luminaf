export const SITE_BASE_PATH = (process.env.NEXT_PUBLIC_SITE_BASE_PATH || "").replace(/\/$/, "");

export function sitePath(path: string) {
  const normalized = path.startsWith("/") ? path : "/" + path;
  const alreadyPrefixed = SITE_BASE_PATH && (normalized === SITE_BASE_PATH || normalized.startsWith(SITE_BASE_PATH + "/"));
  let result = alreadyPrefixed ? normalized : SITE_BASE_PATH + normalized;
  const suffixIndex = result.search(/[?#]/);
  const pathname = suffixIndex < 0 ? result : result.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : result.slice(suffixIndex);
  if (!pathname.endsWith("/") && !/\.[a-z0-9]{1,8}$/i.test(pathname)) result = pathname + "/" + suffix;
  else result = pathname + suffix;
  return result || "/";
}
