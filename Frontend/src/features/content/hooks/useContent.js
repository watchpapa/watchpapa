// Generic content-fetch hooks. Everything reads live from the watchpapa Worker
// (which reads TMDB with edge caching). Responses use the same field names the
// UI used to read off the Postgres mirror — `id === tmdb_id`.

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api.js";
import { usePreferences } from "../../preferences/PreferencesContext.jsx";

// Module-level cache so revisiting a detail page / re-rendering a list is instant.
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

function cached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  return undefined;
}

// useContent(path | null) → { data, loading, error, reload }
//
// The cache key is prefixed with the current content-locale key (language/region/
// native — see lib/api.js) rather than just the raw path: apiFetch() silently
// appends lang/region/native to the request, so two different locales hitting the
// same hook-built `path` string must NOT share a cache entry.
export function useContent(path) {
  const { localeKey } = usePreferences();
  const key = path ? `${localeKey}|${path}` : null;
  const [state, setState] = useState(() => {
    const hit = key ? cached(key) : undefined;
    return { data: hit ?? null, loading: !!key && hit === undefined, error: null };
  });
  const reloadRef = useRef(0);

  useEffect(() => {
    if (!key) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const hit = cached(key);
    if (hit !== undefined) {
      setState({ data: hit, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    apiFetch(path)
      .then((data) => {
        if (cancelled) return;
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [key, reloadRef.current]);

  return {
    ...state,
    reload: () => {
      if (key) cache.delete(key);
      reloadRef.current += 1;
    },
  };
}

const idOk = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

export const useMovie = (id) => useContent(idOk(id) ? `/api/content/movie/${Number(id)}` : null);
export const useShow = (id) => useContent(idOk(id) ? `/api/content/show/${Number(id)}` : null);
export const useSeason = (showId, seasonNumber) =>
  useContent(
    idOk(showId) && seasonNumber != null && Number(seasonNumber) >= 0
      ? `/api/content/show/${Number(showId)}/season/${Number(seasonNumber)}`
      : null,
  );
export const useEpisode = (showId, seasonNumber, episodeNumber) =>
  useContent(
    idOk(showId) && seasonNumber != null && Number(seasonNumber) >= 0 && idOk(episodeNumber)
      ? `/api/content/show/${Number(showId)}/season/${Number(seasonNumber)}/episode/${Number(episodeNumber)}`
      : null,
  );
export const usePerson = (id) => useContent(idOk(id) ? `/api/content/person/${Number(id)}` : null);
export const useCollection = (id) => useContent(idOk(id) ? `/api/content/collection/${Number(id)}` : null);
export const useCertifications = () => useContent("/api/content/certifications");

export function useContentList(kind, page = 1, { includeAdult = false } = {}) {
  const q = new URLSearchParams({ page: String(page) });
  if (includeAdult) q.set("include_adult", "true");
  return useContent(kind ? `/api/content/list/${kind}?${q}` : null);
}

export function useDiscover(type, { genreId, upcoming = false, page = 1, includeAdult = false } = {}) {
  const q = new URLSearchParams({ page: String(page) });
  if (genreId) q.set("with_genres", String(genreId));
  if (upcoming) q.set("upcoming", "1");
  if (includeAdult) q.set("include_adult", "true");
  return useContent(type ? `/api/content/discover/${type}?${q}` : null);
}

export const useGenres = () => useContent("/api/content/genres");
