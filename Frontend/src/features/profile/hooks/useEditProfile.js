import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

const DEFAULT_AVATAR = { type: "default", posterMediaType: null, posterTmdbId: null, posterPath: null, uploadPath: null };

// Own bio + profile_favourite rows + avatar for the Edit Profile page.
// Favourites hold (media_type, tmdb_id); metadata is hydrated from the Worker.
export function useEditProfile(session) {
  const uid = session?.user?.id;
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [favRows, setFavRows] = useState([]); // [{ position, media_type, tmdb_id }]
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    Promise.all([
      supabase
        .from("profile")
        .select("bio, avatar_type, avatar_poster_media_type, avatar_poster_tmdb_id, avatar_poster_path, avatar_upload_path")
        .eq("id", uid)
        .single(),
      supabase
        .from("profile_favourite")
        .select("position, media_type, tmdb_id")
        .eq("profile_id", uid)
        .order("position"),
    ]).then(([profileRes, favRes]) => {
      if (cancelled) return;
      setBio(profileRes.data?.bio ?? "");
      setAvatar({
        type: profileRes.data?.avatar_type ?? "default",
        posterMediaType: profileRes.data?.avatar_poster_media_type ?? null,
        posterTmdbId: profileRes.data?.avatar_poster_tmdb_id ?? null,
        posterPath: profileRes.data?.avatar_poster_path ?? null,
        uploadPath: profileRes.data?.avatar_upload_path ?? null,
      });
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

  // Poster avatar: pick a movie/show and use its poster. Available to every tier.
  const setAvatarPoster = useCallback(
    async (item) => {
      if (!uid) return;
      setError(null);
      setAvatarSaving(true);
      const next = {
        type: "poster",
        posterMediaType: item.mediaType,
        posterTmdbId: Number(item.id),
        posterPath: item.poster_path ?? null,
        uploadPath: null,
      };
      const { error: err } = await supabase
        .from("profile")
        .update({
          avatar_type: "poster",
          avatar_poster_media_type: item.mediaType,
          avatar_poster_tmdb_id: Number(item.id),
          avatar_poster_path: item.poster_path ?? null,
          avatar_upload_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uid);
      setAvatarSaving(false);
      if (err) { setError(err.message); return; }
      setAvatar(next);
    },
    [uid],
  );

  // Custom photo avatar (Pro+ only — also enforced server-side by the
  // guard_profile_avatar_tier trigger and the "avatars" storage bucket's RLS).
  // `blob` is the already-cropped square JPEG. Each upload gets a fresh
  // filename so the CDN URL changes and never serves a stale cached image.
  const uploadAvatarPhoto = useCallback(
    async (blob) => {
      if (!uid) return { error: "Not signed in" };
      setError(null);
      setAvatarSaving(true);
      const path = `${uid}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) {
        setAvatarSaving(false);
        setError(uploadErr.message);
        return { error: uploadErr.message };
      }
      const { error: profileErr } = await supabase
        .from("profile")
        .update({
          avatar_type: "upload",
          avatar_upload_path: path,
          avatar_poster_media_type: null,
          avatar_poster_tmdb_id: null,
          avatar_poster_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uid);
      setAvatarSaving(false);
      if (profileErr) { setError(profileErr.message); return { error: profileErr.message }; }
      setAvatar({ type: "upload", posterMediaType: null, posterTmdbId: null, posterPath: null, uploadPath: path });
      return { error: null };
    },
    [uid],
  );

  const setAvatarDefault = useCallback(async () => {
    if (!uid) return;
    setError(null);
    setAvatarSaving(true);
    const { error: err } = await supabase
      .from("profile")
      .update({
        avatar_type: "default",
        avatar_poster_media_type: null,
        avatar_poster_tmdb_id: null,
        avatar_poster_path: null,
        avatar_upload_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uid);
    setAvatarSaving(false);
    if (err) { setError(err.message); return; }
    setAvatar(DEFAULT_AVATAR);
  }, [uid]);

  return {
    bio,
    setBio,
    saveBio,
    favourites,
    setFavourite,
    avatar,
    avatarSaving,
    setAvatarPoster,
    uploadAvatarPhoto,
    setAvatarDefault,
    saving,
    error,
    loaded,
  };
}
