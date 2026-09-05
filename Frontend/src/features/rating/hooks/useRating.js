import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { removeFromWatchlistsOnRating } from "../../watchlist/lib/removeFromWatchlistsOnRating.js";
import { ensureWatchLogSeed } from "../../watchlist/lib/watchLog.js";

// mediaType: 'movie' | 'show' | 'season' | 'episode'
// entityId:  the TMDB id of the rated entity
// ctx (season/episode only): { tmdbShowId, seasonNumber, episodeNumber }
export function useRating(mediaType, entityId, session, ctx = {}) {
  const tmdbId = entityId ? parseInt(entityId, 10) : null;
  const { tmdbShowId, seasonNumber, episodeNumber } = ctx;

  const [ratingId, setRatingId] = useState(null);
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tmdbId || !session?.user?.id || !mediaType) {
      setRatingId(null);
      setValue(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_rating")
      .select("id, value")
      .eq("profile_id", session.user.id)
      .eq("media_type", mediaType)
      .eq("tmdb_id", tmdbId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRatingId(data?.id ?? null);
        setValue(data?.value ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId, session?.user?.id]);

  const rowFields = useCallback(
    () => ({
      profile_id: session.user.id,
      media_type: mediaType,
      tmdb_id: tmdbId,
      tmdb_show_id:
        mediaType === "show" ? tmdbId : mediaType === "season" || mediaType === "episode" ? tmdbShowId ?? null : null,
      season_number: mediaType === "season" || mediaType === "episode" ? seasonNumber ?? null : null,
      episode_number: mediaType === "episode" ? episodeNumber ?? null : null,
    }),
    [mediaType, tmdbId, tmdbShowId, seasonNumber, episodeNumber, session?.user?.id],
  );

  const setRating = useCallback(
    async (newValue) => {
      if (!session?.user?.id || !tmdbId || !mediaType) return;
      const now = new Date().toISOString();

      if (ratingId) {
        const prev = value;
        setValue(newValue);
        const { error } = await supabase
          .from("user_rating")
          .update({ value: newValue, updated_at: now })
          .eq("id", ratingId);
        if (error) setValue(prev);
        else {
          // Seed before dispatching the removal event (inside
          // removeFromWatchlistsOnRating) — useWatchLog.js reloads on that
          // event, so the log row needs to exist first or it'd refetch too early.
          await ensureWatchLogSeed(mediaType, tmdbId, tmdbShowId, session.user.id);
          await removeFromWatchlistsOnRating(mediaType, tmdbId, tmdbShowId);
        }
      } else {
        setLoading(true);
        const { data, error } = await supabase
          .from("user_rating")
          .insert({ ...rowFields(), value: newValue })
          .select("id, value")
          .single();
        setLoading(false);
        if (!error && data) {
          setRatingId(data.id);
          setValue(data.value);
          await ensureWatchLogSeed(mediaType, tmdbId, tmdbShowId, session.user.id);
          await removeFromWatchlistsOnRating(mediaType, tmdbId, tmdbShowId);
        }
      }
    },
    [mediaType, tmdbId, tmdbShowId, session?.user?.id, ratingId, value, rowFields],
  );

  const clearRating = useCallback(async () => {
    if (!ratingId) return;
    const prev = value;
    const prevId = ratingId;
    setRatingId(null);
    setValue(null);
    const { error } = await supabase.from("user_rating").delete().eq("id", ratingId);
    if (error) {
      setRatingId(prevId);
      setValue(prev);
    }
  }, [ratingId, value]);

  return { value, loading, setRating, clearRating };
}
