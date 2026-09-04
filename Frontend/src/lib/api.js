// Shared helper for calling the watchpapa Worker API (api.watchpapa.tv, or the
// Vite dev proxy → localhost:8787). Replaces the ~15 local `API_BASE` copies.

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Content-locale query params appended to every /api/content* and /api/search*
// request. Set synchronously by PreferencesProvider (features/preferences/
// PreferencesContext.jsx) so the very first content fetch already carries the
// right values — never from an effect, which would race the first render's fetches.
let contentLocale = { lang: "en-US", region: null, native: null };

export function setContentLocale(next) {
  contentLocale = { lang: next?.lang || "en-US", region: next?.region || null, native: next?.native || null };
}

// A stable string that changes iff contentLocale changes — use as a cache-key
// prefix (see useContent.js / useContentBatch.js) so locale switches don't serve
// stale-language data out of the module-level content caches.
export function getContentLocaleKey() {
  return `${contentLocale.lang}|${contentLocale.region ?? ""}|${contentLocale.native ?? ""}`;
}

const LOCALE_ROUTED = ["/api/content", "/api/search"];

function withLocale(path) {
  if (!LOCALE_ROUTED.some((prefix) => path.startsWith(prefix))) return path;
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("lang")) params.set("lang", contentLocale.lang);
  if (contentLocale.region && !params.has("region")) params.set("region", contentLocale.region);
  if (contentLocale.native && !params.has("native")) params.set("native", contentLocale.native);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// fetch() wrapper. Pass `session` to attach the Supabase bearer token.
// Returns parsed JSON (or text for non-JSON responses). Throws ApiError on !ok.
export async function apiFetch(path, { session, headers, ...init } = {}) {
  const h = new Headers(headers ?? {});
  if (session?.access_token) h.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${withLocale(path)}`, { ...init, headers: h });
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body);
  }
  return body;
}
