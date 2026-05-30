import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Manages own bio and profile_favourite rows for the Edit Profile page.
export function useEditProfile(session) {
  const uid = session?.user?.id;
  const [bio, setBio] = useState("");
  const [favourites, setFavourites] = useState([]); // [{position, movie_id, show_id, movie, show}]
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
        .select(`
          position, movie_id, show_id,
          movie:movie_id(id, title, poster_path, release_date),
          show:show_id(id, name, poster_path, first_air_date)
        `)
        .eq("profile_id", uid)
        .order("position"),
    ]).then(([profileRes, favRes]) => {
      if (cancelled) return;
      setBio(profileRes.data?.bio ?? "");
      setFavourites(favRes.data ?? []);
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, [uid]);

  const saveBio = useCallback(async (newBio) => {
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
  }, [uid]);

  // Set a favourite slot (1-5). Pass null to clear.
  const setFavourite = useCallback(async (position, item) => {
    if (!uid) return;
    setError(null);

    if (!item) {
      // Delete the slot
      await supabase
        .from("profile_favourite")
        .delete()
        .eq("profile_id", uid)
        .eq("position", position);
      setFavourites((prev) => prev.filter((f) => f.position !== position));
      return;
    }

    const row = {
      profile_id: uid,
      position,
      movie_id: item.mediaType === "movie" ? item.id : null,
      show_id: item.mediaType === "show" ? item.id : null,
    };

    const { data, error: err } = await supabase
      .from("profile_favourite")
      .upsert(row, { onConflict: "profile_id,position" })
      .select(`
        position, movie_id, show_id,
        movie:movie_id(id, title, poster_path, release_date),
        show:show_id(id, name, poster_path, first_air_date)
      `)
      .single();

    if (err) { setError(err.message); return; }
    setFavourites((prev) => {
      const filtered = prev.filter((f) => f.position !== position);
      return [...filtered, data].sort((a, b) => a.position - b.position);
    });
  }, [uid]);

  return { bio, setBio, saveBio, favourites, setFavourite, saving, error, loaded };
}
