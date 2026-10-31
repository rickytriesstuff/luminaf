export const SITE_BASE_PATH = (process.env.NEXT_PUBLIC_SITE_BASE_PATH || "").replace(/\/$/, "");
export function sitePath(path: string) { return SITE_BASE_PATH + (path.startsWith("/") ? path : "/" + path); }
