// Reads and validates the content-locale query params shared by every
// /api/content* and /api/search* route. Centralizing this keeps the TMDB
// `language`/`region` values — and therefore the edge cache-key shape — the
// same no matter which route builds the request.

const LANG_RE = /^[a-z]{2}-[A-Z]{2}$/;
const REGION_RE = /^[A-Z]{2}$/;
const NATIVE_RE = /^[a-z]{2}$/;

// { language: "pl-PL", region: "PL"|null, native: "pl"|null, includeAdult, providers: number[] }
export function readLocale(c) {
  const langRaw = c.req.query("lang");
  const language = langRaw && LANG_RE.test(langRaw) ? langRaw : "en-US";

  const regionRaw = c.req.query("region");
  const region = regionRaw && REGION_RE.test(regionRaw) ? regionRaw : null;

  const nativeRaw = c.req.query("native");
  const native = nativeRaw && NATIVE_RE.test(nativeRaw) ? nativeRaw : null;

  // Search kept its original camelCase param; content routes use snake_case.
  // Accept both everywhere so either caller shape works.
  const includeAdult =
    c.req.query("include_adult") === "true" || c.req.query("includeAdult") === "true";

  const providersRaw = c.req.query("providers");
  const providers = providersRaw
    ? providersRaw
        .split("|")
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 60)
    : [];

  return { language, region, native, includeAdult, providers };
}
