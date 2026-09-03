import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey, itemFromRow } from "../../content/lib/keys.js";

const PAGE_SIZE = 20;
const RECENT_PAGE_SIZE = 10;

const ROW_SELECT =
  "id, value, created_at, media_type, tmdb_id, tmdb_show_id, season_number, episode_number";

// Rebuild the movie/show/season/episode embed shape ProfileRatingCard expects,
// from a hydrated batch card.
function hydrateRow(row, cards) {
  const card = cards[cardKey(itemFromRow(row))];
  const out = { ...row, movie: null, show: null, season: null, episode: null };
  if (!card) return out;
  const showStub = card.showId
    ? { id: card.showId, name: card.showTitle, poster_path: card.poster_path }
    : null;
  if (row.media_type === "movie") {
    out.movie = { id: card.id, title: card.title, poster_path: card.poster_path, release_date: card.date };
  } else if (row.media_type === "show") {
    out.show = { id: card.id, name: card.title, poster_path: card.poster_path, first_air_date: card.date };
  } else if (row.media_type === "season") {
    out.season = { id: card.id, name: card.title, poster_path: card.poster_path, air_date: card.date, season_number: card.seasonNumber, show: showStub };
  } else if (row.media_type === "episode") {
    out.episode = {
      id: card.id,
      name: card.title,
      air_date: card.date,
      season_number: card.seasonNumber,
      episode_number: card.episodeNumber,
      poster_path: card.poster_path,
      season: { id: null, show: showStub },
    };
  }
  return out;
}

function dateOf(r) {
  return r.movie?.release_date || r.show?.first_air_date || r.season?.air_date || r.episode?.air_date || "";
}

function sortRatings(ratings, sort) {
  const copies = [...ratings];
  if (sort === "oldest") return copies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === "rating_desc") return copies.sort((a, b) => b.value - a.value || new Date(b.created_at) - new Date(a.created_at));
  if (sort === "rating_asc") return copies.sort((a, b) => a.value - b.value || new Date(b.created_at) - new Date(a.created_at));
  if (sort === "release_desc") return copies.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  if (sort === "release_asc") return copies.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  return copies;
}

export function useProfileRatings(profileId, opts = {}) {
  const { since, sort = "newest" } = opts;
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const pageSz = since ? RECENT_PAGE_SIZE : PAGE_SIZE;

  const fetchPage = useCallback(
    async (pageNum, append) => {
      if (!profileId) return;
      setLoading(true);
      const from = pageNum * pageSz;
      let query = supabase.from("user_rating").select(ROW_SELECT).eq("profile_id", profileId);
      if (since) query = query.gte("created_at", since);
      const { data } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSz - 1);
      setLoading(false);
      const rows = (data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id), tmdb_show_id: r.tmdb_show_id ? Number(r.tmdb_show_id) : null }));
      setHasMore(rows.length === pageSz);
      setRawRows((prev) => (append ? [...prev, ...rows] : rows));
    },
    [profileId, since, pageSz],
  );

  useEffect(() => {
    setRawRows([]);
    setPage(0);
    setHasMore(true);
    if (profileId) fetchPage(0, false);
  }, [profileId, since, fetchPage]);

  const { cards, loading: cardsLoading } = useContentBatch(
    useMemo(() => rawRows.map(itemFromRow), [rawRows]),
  );

  const ratings = useMemo(() => {
    const hydrated = rawRows.map((r) => hydrateRow(r, cards));
    return sort !== "newest" ? sortRatings(hydrated, sort) : hydrated;
  }, [rawRows, cards, sort]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [page, fetchPage]);

  return { ratings, loading: loading || cardsLoading, hasMore, loadMore };
}
