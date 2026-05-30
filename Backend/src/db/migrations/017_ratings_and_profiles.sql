-- user_rating: 1–10 integer, one per user per content item (movies, shows, seasons, episodes).
-- All ratings are public — no is_public flag. They feed community histograms and profile grids.
CREATE TABLE public.user_rating (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID        NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  movie_id    BIGINT      REFERENCES public.movie(id)   ON DELETE CASCADE,
  show_id     BIGINT      REFERENCES public.show(id)    ON DELETE CASCADE,
  season_id   BIGINT      REFERENCES public.season(id)  ON DELETE CASCADE,
  episode_id  BIGINT      REFERENCES public.episode(id) ON DELETE CASCADE,
  value       SMALLINT    NOT NULL CHECK (value >= 1 AND value <= 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT user_rating_one_media CHECK (
    (movie_id   IS NOT NULL)::int +
    (show_id    IS NOT NULL)::int +
    (season_id  IS NOT NULL)::int +
    (episode_id IS NOT NULL)::int = 1
  )
);
CREATE UNIQUE INDEX user_rating_movie_uniq   ON public.user_rating (profile_id, movie_id)   WHERE movie_id   IS NOT NULL;
CREATE UNIQUE INDEX user_rating_show_uniq    ON public.user_rating (profile_id, show_id)    WHERE show_id    IS NOT NULL;
CREATE UNIQUE INDEX user_rating_season_uniq  ON public.user_rating (profile_id, season_id)  WHERE season_id  IS NOT NULL;
CREATE UNIQUE INDEX user_rating_episode_uniq ON public.user_rating (profile_id, episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX user_rating_profile_id_idx  ON public.user_rating (profile_id);
CREATE INDEX user_rating_movie_id_idx    ON public.user_rating (movie_id)   WHERE movie_id   IS NOT NULL;
CREATE INDEX user_rating_show_id_idx     ON public.user_rating (show_id)    WHERE show_id    IS NOT NULL;
CREATE INDEX user_rating_season_id_idx   ON public.user_rating (season_id)  WHERE season_id  IS NOT NULL;
CREATE INDEX user_rating_episode_id_idx  ON public.user_rating (episode_id) WHERE episode_id IS NOT NULL;

-- RLS: anon can read all (for community histogram on public detail pages);
-- authenticated can write only their own rows.
ALTER TABLE public.user_rating ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_rating: public read"
  ON public.user_rating FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "user_rating: own insert"
  ON public.user_rating FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "user_rating: own update"
  ON public.user_rating FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "user_rating: own delete"
  ON public.user_rating FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- profile_favourite: up to 5 pinned movies or shows shown on the public profile page.
CREATE TABLE public.profile_favourite (
  id          BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID     NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  position    SMALLINT NOT NULL CHECK (position >= 1 AND position <= 5),
  movie_id    BIGINT   REFERENCES public.movie(id) ON DELETE CASCADE,
  show_id     BIGINT   REFERENCES public.show(id)  ON DELETE CASCADE,
  CONSTRAINT profile_favourite_one_media CHECK (
    (movie_id IS NOT NULL AND show_id IS NULL) OR
    (movie_id IS NULL     AND show_id IS NOT NULL)
  ),
  UNIQUE (profile_id, position)
);
ALTER TABLE public.profile_favourite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_favourite: authenticated read"
  ON public.profile_favourite FOR SELECT TO authenticated USING (true);
CREATE POLICY "profile_favourite: own write"
  ON public.profile_favourite FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- Add short bio to profile (max 200 chars, displayed on public profile page).
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 200);

-- Allow authenticated users to read any profile row (needed for /u/:username pages).
-- Writes still gate to id = auth.uid() via the existing policy.
CREATE POLICY "profile: authenticated read all"
  ON public.profile FOR SELECT TO authenticated USING (true);

-- Genre stats for a profile — too complex for PostgREST inline joins.
-- Returns top 20 genres by rating count with average score.
CREATE OR REPLACE FUNCTION public.get_profile_genre_stats(p_profile_id UUID)
RETURNS TABLE (genre_name TEXT, rating_count BIGINT, avg_value NUMERIC)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    g.name                                  AS genre_name,
    COUNT(*)                                AS rating_count,
    ROUND(AVG(r.value)::NUMERIC, 1)         AS avg_value
  FROM   public.user_rating r
  LEFT JOIN public.movie       m  ON r.movie_id = m.id
  LEFT JOIN public.show        s  ON r.show_id  = s.id
  LEFT JOIN public.movie_genre mg ON m.id = mg.movie_id
  LEFT JOIN public.show_genre  sg ON s.id = sg.show_id
  LEFT JOIN public.genres      g  ON g.id = mg.genres_id OR g.id = sg.genres_id
  WHERE  r.profile_id = p_profile_id AND g.id IS NOT NULL
  GROUP  BY g.id, g.name
  ORDER  BY rating_count DESC
  LIMIT  20;
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_genre_stats(UUID) TO authenticated;

-- Limit status for overage detection — used by WatchlistsPage and FollowsPage.
-- ReleasesCalendarPage and FollowsPage compute overage live from reactive arrays instead.
CREATE OR REPLACE FUNCTION public.get_limit_status(p_profile_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT get_effective_tier(p_profile_id) INTO v_tier;
  RETURN jsonb_build_object(
    'tier',            v_tier,
    'show_follows',    (SELECT COUNT(*) FROM public.user_followed_shows  WHERE profile_id = p_profile_id),
    'movie_follows',   (SELECT COUNT(*) FROM public.user_followed_movies WHERE profile_id = p_profile_id),
    'watchlist_count', (SELECT COUNT(*) FROM public.watchlist            WHERE profile_id = p_profile_id),
    'show_limit',      CASE v_tier WHEN 'free' THEN 3   WHEN 'premium' THEN NULL WHEN 'pro' THEN 100 WHEN 'pro_plus' THEN 100 WHEN 'god' THEN NULL ELSE 3   END,
    'movie_limit',     CASE v_tier WHEN 'free' THEN 1   WHEN 'premium' THEN NULL WHEN 'pro' THEN 100 WHEN 'pro_plus' THEN 100 WHEN 'god' THEN NULL ELSE 1   END,
    'combined_limit',  CASE v_tier WHEN 'premium' THEN 10 ELSE NULL END,
    'watchlist_limit', CASE v_tier WHEN 'free' THEN 1   WHEN 'premium' THEN 3   WHEN 'pro' THEN 10  WHEN 'pro_plus' THEN 10  WHEN 'god' THEN NULL ELSE 1   END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_limit_status(UUID) TO authenticated;
