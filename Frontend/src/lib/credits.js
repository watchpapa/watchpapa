// Used by:
// - Frontend/src/features/episode/hooks/useEpisodeData.js
// - Frontend/src/features/movie/hooks/useMovieData.js
// - Frontend/src/features/season/hooks/useSeasonData.js
// - Frontend/src/features/show/hooks/useShowData.js
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

// Convert raw credit rows from database joins into cast items.
export function toCast(rows) {
  return rows
    .filter((r) => r.person && r.job?.name === "Actor")
    .map((r) => ({
      id: `${r.person.id}-${r.title ?? ""}`,
      personId: r.person.id,
      name: r.person.name,
      profilePath: r.person.profile_path ?? null,
      character: r.title ?? null,
    }));
}

// Group raw database credit rows into department/job crew sections.
export function toCrew(rows) {
  const deptMap = new Map();

  for (const r of rows) {
    if (!r.person || r.job?.name === "Actor") continue;
    const dept = r.job?.department?.name ?? "Crew";
    const job = r.job?.name ?? "Unknown";

    if (!deptMap.has(dept)) deptMap.set(dept, new Map());
    const jobMap = deptMap.get(dept);

    if (!jobMap.has(job)) jobMap.set(job, new Map());
    const peopleMap = jobMap.get(job);

    // deduplicate by person id within a job
    if (!peopleMap.has(r.person.id)) {
      peopleMap.set(r.person.id, {
        id: `${r.person.id}-${job}`,
        personId: r.person.id,
        name: r.person.name,
        profilePath: r.person.profile_path ?? null,
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
