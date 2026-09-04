// Thin TMDB v3 client for the Worker.
//
// Caching: we rely on Cloudflare's edge cache via `fetch(url, { cf: { cacheEverything,
// cacheTtl } })` rather than explicit `caches.default` calls — on the Free plan those
// share the 50-subrequest budget, so one `fetch()` per TMDB hit (warm or cold) is the
// cheapest option. The api_key never appears in the cache key because Cloudflare keys
// on the full URL and we keep the key in the query string of every request the same
// way; to be safe we also send it as a header-free query param on a stable URL shape.
//
// Rate limiting: no cross-isolate limiter is possible, so we lean on caching and do a
// small bounded retry on 429/5xx honouring Retry-After.

const BASE = "https://api.themoviedb.org/3";

export class TmdbError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

export class TmdbNotFound extends TmdbError {
  constructor(message = "Not found on TMDB") {
    super(404, message);
    this.name = "TmdbNotFound";
  }
}

// `language` is set right after `api_key`, before `params`, on every call site —
// keeping that position stable matters because Cloudflare's edge cache keys on
// the full URL, so a caller-supplied `language` (or any `params` key) naturally
// partitions the cache without any extra work.
function buildUrl(path, params, apiKey, language = "en-US") {
  const u = new URL(BASE + path);
  u.searchParams.set("api_key", apiKey);
  u.searchParams.set("language", language);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export { buildUrl };

// GET a TMDB JSON resource. `ttl` is the edge cache TTL in seconds.
export async function tmdbFetch(env, path, params, { ttl = 3600, retries = 2, language = "en-US" } = {}) {
  const apiKey = env.TMDB_API_KEY_SECRET;
  if (!apiKey) throw new TmdbError(503, "TMDB API key not configured");

  const url = buildUrl(path, params, apiKey, language);
  let attempt = 0;

  while (true) {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cf: { cacheEverything: true, cacheTtl: ttl },
    });

    if (res.ok) return res.json();

    if (res.status === 404) throw new TmdbNotFound();

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
      const waitMs = Number.isFinite(retryAfter)
        ? Math.min(retryAfter * 1000, 5000)
        : 300 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, waitMs));
      attempt += 1;
      continue;
    }

    const body = await res.text().catch(() => "");
    throw new TmdbError(
      res.status,
      `TMDB ${res.status} for ${path}: ${body.slice(0, 200).replace(apiKey, "[redacted]")}`,
    );
  }
}

// Fetch several TMDB resources, tolerating individual failures (returns null for those).
export async function tmdbFetchAllSettled(env, requests) {
  const settled = await Promise.allSettled(
    requests.map((r) => tmdbFetch(env, r.path, r.params, r.opts)),
  );
  return settled.map((s) => (s.status === "fulfilled" ? s.value : null));
}
