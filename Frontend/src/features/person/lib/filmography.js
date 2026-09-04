// Pure helpers for the PersonPage filmography: merging duplicate (same title,
// different role/job) rows into one card, sorting, and filtering. Kept separate
// from the hook/component so it's trivially unit-testable.

// One row per role/job comes back from the Worker (see usePersonData.js). Merge
// rows for the same title into a single card listing every role/job.
export function mergeCredits(credits) {
  const byKey = new Map();
  for (const c of credits ?? []) {
    const key = `${c.type}:${c.mediaId}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        key,
        mediaId: c.mediaId,
        type: c.type,
        title: c.title,
        originalTitle: c.originalTitle ?? null,
        posterPath: c.posterPath ?? null,
        date: c.date ?? null,
        year: c.year ?? null,
        popularity: c.popularity ?? 0,
        voteAverage: c.voteAverage ?? 0,
        voteCount: c.voteCount ?? 0,
        episodeCount: c.episodeCount ?? null,
        nsfw: Boolean(c.nsfw),
        roles: [],
        jobs: [],
        departments: new Set(),
      };
      byKey.set(key, entry);
    }
    if (c.role) entry.roles.push(c.role);
    if (c.job) entry.jobs.push({ job: c.job, department: c.department ?? null });
    if (c.department) entry.departments.add(c.department);
    if (c.episodeCount != null) entry.episodeCount = Math.max(entry.episodeCount ?? 0, c.episodeCount);
  }
  return [...byKey.values()].map((e) => ({ ...e, departments: [...e.departments] }));
}

export const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "popular", label: "Most popular" },
  { id: "rated", label: "Highest rated" },
  { id: "title", label: "Title A–Z" },
];

const MIN_VOTES_FOR_RATING = 20;

export function sortCredits(list, sortId) {
  const arr = [...list];
  switch (sortId) {
    case "oldest":
      return arr.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });
    case "popular":
      return arr.sort((a, b) => b.popularity - a.popularity);
    case "rated":
      return arr.sort((a, b) => {
        const aRanked = a.voteCount >= MIN_VOTES_FOR_RATING;
        const bRanked = b.voteCount >= MIN_VOTES_FOR_RATING;
        if (aRanked !== bRanked) return aRanked ? -1 : 1;
        if (aRanked && bRanked) return b.voteAverage - a.voteAverage;
        return b.popularity - a.popularity;
      });
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    case "newest":
    default:
      return arr.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
  }
}

export function filterCredits(list, { kind = "all", department = "all" } = {}) {
  return list.filter((c) => {
    if (kind !== "all" && c.type !== kind) return false;
    if (department !== "all" && !c.departments.includes(department)) return false;
    return true;
  });
}

// Acting first (most common), then whatever crew departments are actually present,
// alphabetically.
export function departmentsOf(list) {
  const set = new Set();
  for (const c of list) for (const d of c.departments) set.add(d);
  const rest = [...set].filter((d) => d !== "Acting").sort((a, b) => a.localeCompare(b));
  return set.has("Acting") ? ["Acting", ...rest] : rest;
}
