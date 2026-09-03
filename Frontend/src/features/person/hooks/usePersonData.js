// Used by:
// - Frontend/src/pages/app/PersonPage.jsx
//
// Person + combined credits come live from the watchpapa Worker (TMDB).
import { usePerson } from "../../content/hooks/useContent.js";

export function usePersonData(rawPersonId, showAdult = false) {
  const tmdbId = rawPersonId ? parseInt(rawPersonId, 10) : null;
  const { data: person, loading, error } = usePerson(tmdbId);

  const restricted = person && !showAdult && person.adult;

  const credits = (person?.credits ?? []).filter((c) => showAdult || !c.adult);
  const shape = (c, i) => ({
    id: `${c.type[0]}-${c.mediaId}-${c.role ?? c.job ?? i}`,
    mediaId: c.mediaId,
    type: c.type,
    title: c.title,
    posterPath: c.posterPath ?? null,
    role: c.role ?? null,
    job: c.job ?? null,
    department: c.department ?? null,
  });

  return {
    person: restricted ? null : person,
    knownForDepartment: person?.known_for_department ?? null,
    nicknames: person?.also_known_as ?? [],
    movieCredits: credits.filter((c) => c.type === "movie").map(shape),
    showCredits: credits.filter((c) => c.type === "show").map(shape),
    isLoading: loading,
    error: restricted ? "This content is restricted." : error?.message ?? null,
  };
}
