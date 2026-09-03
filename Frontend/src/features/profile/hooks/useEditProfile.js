import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

// Own bio + profile_favourite rows for the Edit Profile page. Favourites hold
// (media_type, tmdb_id); metadata is hydrated from the Worker.
export function useEditProfile(session) {
  const uid = session?.user?.id;
  const [bio, setBio] = useState("");
  const [favRows, setFavRows] = useState([]); // [{ position, media_type, tmdb_id }]
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    Promise.all([
      supabase.from("profile").select("bio").eq("id", uid).single(),
      supabase
        .from("profile_favourite")
        .select("position, media_type, tmdb_id")
        .eq("profile_id", uid)
        .order("position"),
    ]).then(([profileRes, favRes]) => {
      if (cancelled) return;
      setBio(profileRes.data?.bio ?? "");
      setFavRows((favRes.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) })));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const { cards } = useContentBatch(
    useMemo(() => favRows.map((r) => ({ type: r.media_type, id: r.tmdb_id })), [favRows]),
  );

  const favourites = useMemo(
    () =>
      favRows.map((r) => {
        const c = cards[cardKey({ type: r.media_type, id: r.tmdb_id })];
        const media = c ? { id: r.tmdb_id, title: c.title, name: c.title, poster_path: c.poster_path, release_date: c.date, first_air_date: c.date } : null;
        return {
          position: r.position,
          media_type: r.media_type,
          tmdb_id: r.tmdb_id,
          movie_id: r.media_type === "movie" ? r.tmdb_id : null,
          show_id: r.media_type === "show" ? r.tmdb_id : null,
          movie: r.media_type === "movie" ? media : null,
          show: r.media_type === "show" ? media : null,
        };
      }),
    [favRows, cards],
  );

  const saveBio = useCallback(
    async (newBio) => {
      if (!uid) return;
      setSaving(true);
      setError(null);
      const { error: err } = await supabase
        .from("profile")
        .update({ bio: newBio.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", uid);
      setSaving(false);
      if (err) setError(err.message);
      else setBio(newBio);
    },
    [uid],
  );

  // position 1-5; item = { mediaType, id (tmdb) } or null to clear.
  const setFavourite = useCallback(
    async (position, item) => {
      if (!uid) return;
      setError(null);
      if (!item) {
        await supabase.from("profile_favourite").delete().eq("profile_id", uid).eq("position", position);
        setFavRows((prev) => prev.filter((f) => f.position !== position));
        return;
      }
      const row = { profile_id: uid, position, media_type: item.mediaType, tmdb_id: item.id };
      const { error: err } = await supabase
        .from("profile_favourite")
        .upsert(row, { onConflict: "profile_id,position" });
      if (err) {
        setError(err.message);
        return;
      }
      setFavRows((prev) =>
        [...prev.filter((f) => f.position !== position), { position, media_type: item.mediaType, tmdb_id: Number(item.id) }].sort(
          (a, b) => a.position - b.position,
        ),
      );
    },
    [uid],
  );

  return { bio, setBio, saveBio, favourites, setFavourite, saving, error, loaded };
}
