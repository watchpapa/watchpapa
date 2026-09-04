// Used by:
// - Frontend/src/pages/app/PersonPage.jsx
//
// Person + combined credits come live from the watchpapa Worker (TMDB). Credits
// come back flat (one row per role/job); merged here into one card per title so
// an actor-director-producer credit on the same film shows up once.
import { useMemo } from "react";
import { usePerson } from "../../content/hooks/useContent.js";
import { mergeCredits, departmentsOf } from "../lib/filmography.js";

export function usePersonData(rawPersonId, showAdult = false) {
  const tmdbId = rawPersonId ? parseInt(rawPersonId, 10) : null;
  const { data: person, loading, error } = usePerson(tmdbId);

  const restricted = person && !showAdult && (person.adult || person.nsfw);

  const credits = useMemo(() => {
    const safe = (person?.credits ?? []).filter((c) => showAdult || !(c.adult || c.nsfw));
    return mergeCredits(safe);
  }, [person, showAdult]);

  const departments = useMemo(() => departmentsOf(credits), [credits]);

  return {
    person: restricted ? null : person,
    knownForDepartment: person?.known_for_department ?? null,
    nicknames: person?.also_known_as ?? [],
    credits,
    departments,
    isLoading: loading,
    error: restricted ? "This content is restricted." : error?.message ?? null,
  };
}
