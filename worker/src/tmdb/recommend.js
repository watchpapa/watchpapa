// Pure helpers for POST /api/content/recommendations (see routes/content.js).
//
// The ranking blends three signals so "Suggested for you" tracks both the
// user's own taste and what is popular right now:
//   1. TMDB's per-seed /recommendations (weighted by how highly the user rated
//      the seed),
//   2. genre overlap with a taste profile built from those same seeds,
//   3. current TMDB popularity (candidates from a genre-filtered
//      /discover sorted by popularity also enter the pool this way).
// A small random jitter keeps the order from being frozen between visits.

// Weighted random sample without replacement (Efraimidis–Spirakis keys).
// `weight` is the user's rating (1-10); missing/invalid falls back to 6.
export function sampleSeeds(items, n, rng = Math.random) {
  if (items.length <= n) return items.slice();
  return items
    .map((it) => {
      const w = Number.isFinite(it.weight) && it.weight > 0 ? it.weight : 6;
      return { it, key: Math.pow(rng(), 1 / w) };
    })
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.it);
}

// genre id -> weight, accumulated from the candidates each seed recommended
// (list-shaped TMDB items carry `genre_ids`), scaled by the seed's weight.
export function addToProfile(profile, genreIds, seedWeight) {
  for (const g of genreIds ?? []) profile.set(g, (profile.get(g) ?? 0) + seedWeight);
}

export function topGenres(profile, n = 3) {
  return [...profile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);
}

// 0..1: weighted share of the candidate's genres that the profile cares about.
export function genreScore(profile, genreIds) {
  if (!genreIds?.length || profile.size === 0) return 0;
  const max = Math.max(...profile.values());
  let sum = 0;
  for (const g of genreIds) sum += (profile.get(g) ?? 0) / max;
  return Math.min(1, sum / Math.min(genreIds.length, 3));
}

// 0..1 on a log scale — TMDB popularity is heavy-tailed (≈1 … several hundred).
export function popularityScore(popularity) {
  return Math.min(1, Math.log10(1 + Math.max(0, popularity ?? 0)) / 3);
}

export function scoreCandidate({ recScore, genres, popularity }, profile, rng = Math.random) {
  return recScore + genreScore(profile, genres) * 1.2 + popularityScore(popularity) * 0.8 + (rng() - 0.5) * 0.3;
}
