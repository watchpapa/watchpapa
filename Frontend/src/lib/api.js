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

// fetch() wrapper. Pass `session` to attach the Supabase bearer token.
// Returns parsed JSON (or text for non-JSON responses). Throws ApiError on !ok.
export async function apiFetch(path, { session, headers, ...init } = {}) {
  const h = new Headers(headers ?? {});
  if (session?.access_token) h.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: h });
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body);
  }
  return body;
}
