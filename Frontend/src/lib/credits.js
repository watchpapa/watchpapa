// Shapes the Worker's flat cast/crew arrays for the detail-page components.
// Used by: MoviePage, ShowPage, SeasonPage, EpisodePage (via their hooks).
//
// Worker emits:
//   cast: [{ personId, name, profilePath, character, order }]
//   crew: [{ personId, name, profilePath, job, department }]

const DEPT_ORDER = [
  "Directing",
  "Writing",
  "Production",
  "Camera",
  "Editing",
  "Sound",
  "Art",
  "Visual Effects",
  "Costume & Make-Up",
  "Lighting",
  "Crew",
];

// Cast list, ordered by TMDB billing order.
export function toCast(cast) {
  return (cast ?? [])
    .filter((c) => c.personId != null)
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((c) => ({
      id: `${c.personId}-${c.character ?? ""}`,
      personId: c.personId,
      name: c.name,
      profilePath: c.profilePath ?? null,
      character: c.character ?? null,
    }));
}

// Crew grouped department → job → people, departments in DEPT_ORDER.
export function toCrew(crew) {
  const deptMap = new Map();

  for (const c of crew ?? []) {
    if (c.personId == null) continue;
    const dept = c.department ?? "Crew";
    const job = c.job ?? "Unknown";

    if (!deptMap.has(dept)) deptMap.set(dept, new Map());
    const jobMap = deptMap.get(dept);
    if (!jobMap.has(job)) jobMap.set(job, new Map());
    const peopleMap = jobMap.get(job);

    if (!peopleMap.has(c.personId)) {
      peopleMap.set(c.personId, {
        id: `${c.personId}-${job}`,
        personId: c.personId,
        name: c.name,
        profilePath: c.profilePath ?? null,
      });
    }
  }

  return [...deptMap.entries()]
    .sort(([a], [b]) => {
      const ai = DEPT_ORDER.indexOf(a);
      const bi = DEPT_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map(([department, jobMap]) => ({
      department,
      jobs: [...jobMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([job, peopleMap]) => ({ job, people: [...peopleMap.values()] })),
    }));
}
