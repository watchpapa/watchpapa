-- Rewatch diary: every time a movie/show is (re)watched, one dated row here.
-- Replaces watchlist_item.watched as the source of truth for "is this
-- watched" — watchlist_item stays purely "is this on my to-watch list".
-- Multiple rows per (profile, media_type, tmdb_id) are expected (rewatches);
-- there is deliberately no uniqueness constraint on that triple.
CREATE TABLE public.watch_log (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID        NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('movie', 'show')),
  tmdb_id     BIGINT      NOT NULL,
  watched_at  DATE        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX watch_log_profile_media_idx ON public.watch_log (profile_id, media_type, tmdb_id, watched_at DESC);

ALTER TABLE public.watch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch_log: own rows"
  ON public.watch_log
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
