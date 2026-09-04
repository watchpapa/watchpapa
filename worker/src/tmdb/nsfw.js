// Extra "hide when adult content is off" detection beyond TMDB's own `adult`
// flag, which misses softcore/erotica titles that are only tagged via
// keywords. Every tunable (keyword ids, title regex) lives here so adjusting
// a category is a one-line change in one file.

// TMDB keyword ids for genuinely adult/softcore/erotica content. Deliberately
// narrow — generic keywords like "nudity" or "erotic thriller" hit mainstream
// titles and are intentionally NOT included.
export const NSFW_KEYWORD_IDS = new Set([
  356759, // porn
  345933, // porn films
  345881, // porn classic
  190366, // feature porn
  155139, // porn parody
  322288, // alternative porn
  155477, // softcore
  190370, // erotic movie
  343572, // erotic film
  256466, // erotic
  159551, // pink film
  198385, // hentai
  10053, // sexploitation
  335048, // sexsploitation
]);

export const NSFW_TITLE_RE = /\b(porn\w*|xxx|hentai|soft-?core|erotica?|sex\s*tape|nudes?)\b/i;

// Ids that would otherwise false-positive on the title regex (franchise names,
// mainstream titles that happen to contain a flagged word). Checked before the
// regex so a real title never gets hidden by accident. Empty until a specific
// collision is found in practice — e.g. the "xXx" franchise or "Sex Tape" (2014).
export const NSFW_ALLOW_IDS = { movie: new Set(), tv: new Set() };

// TMDB discover `without_keywords` — pipe-joined ids ("OR": exclude a result if it
// carries ANY of these keywords). Comma means AND, which is the wrong semantics for
// an exclusion list of unrelated keywords.
export function withoutKeywordsParam() {
  return [...NSFW_KEYWORD_IDS].join("|");
}

// Movie keywords append_to_response = { keywords: [{id,name}] }; TV = { results: [...] }.
function keywordIds(keywordsField) {
  const arr = keywordsField?.keywords ?? keywordsField?.results ?? [];
  return Array.isArray(arr) ? arr.map((k) => k.id) : [];
}

function titleHit(...titles) {
  return titles.some((t) => typeof t === "string" && t && NSFW_TITLE_RE.test(t));
}

// raw: a TMDB movie/tv/person-credit-ish object. Accepts either a raw `keywords`
// append_to_response field, or a pre-extracted `keywordIdList` array of ids.
// `type` ("movie"|"tv") is only used to look up the allowlist; defaults to "movie".
export function isNsfw(raw, type = "movie") {
  if (!raw) return false;
  if (raw.adult) return true;
  const ids = raw.keywordIdList ?? keywordIds(raw.keywords);
  if (ids.some((id) => NSFW_KEYWORD_IDS.has(id))) return true;
  if (NSFW_ALLOW_IDS[type]?.has(raw.id)) return false;
  return titleHit(raw.title, raw.original_title, raw.name, raw.original_name);
}

export function filterNsfw(rows, includeAdult, type = "movie") {
  if (includeAdult) return rows;
  return rows.filter((r) => !isNsfw(r, type));
}
