import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";
import { removeFromWatchlistsOnRating } from "../../watchlist/lib/removeFromWatchlistsOnRating.js";

// mediaType: 'movie' | 'show' | 'season' | 'episode'
// entityId: DB primary key (integer)
export function useRating(mediaType, entityId, session) {
  const id = entityId ? parseInt(entityId, 10) : null;
  const [ratingId, setRatingId] = useState(null);
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !session?.user?.id || !mediaType) {
      setRatingId(null);
      setValue(null);
      return;
    }
    let cancelled = false;
    const col = `${mediaType}_id`;

    supabase
      .from("user_rating")
      .select("id, value")
      .eq("profile_id", session.user.id)
      .eq(col, id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRatingId(data?.id ?? null);
        setValue(data?.value ?? null);
      });

    return () => { cancelled = true; };
  }, [mediaType, id, session?.user?.id]);

  const setRating = useCallback(async (newValue) => {
    if (!session?.user?.id || !isValidId(id) || !mediaType) return;
    const uid = session.user.id;
    const col = `${mediaType}_id`;
    const now = new Date().toISOString();

    if (ratingId) {
      const prev = value;
      setValue(newValue);
      const { error } = await supabase
        .from("user_rating")
        .update({ value: newValue, updated_at: now })
        .eq("id", ratingId);
      if (error) {
        setValue(prev);
      } else {
        await removeFromWatchlistsOnRating(mediaType, id);
      }
    } else {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_rating")
        .insert({ profile_id: uid, [col]: id, value: newValue })
        .select("id, value")
        .single();
      setLoading(false);
      if (!error && data) {
        setRatingId(data.id);
        setValue(data.value);
        await removeFromWatchlistsOnRating(mediaType, id);
      }
    }
  }, [mediaType, id, session?.user?.id, ratingId, value]);

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
