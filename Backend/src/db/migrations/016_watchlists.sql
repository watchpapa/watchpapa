-- Watchlist feature: named lists of movies/shows with a watched toggle.
-- Tier limits enforced by BEFORE INSERT trigger (mirrors follow_limit_trigger pattern).

-- ─── watchlist ────────────────────────────────────────────────────────────────
CREATE TABLE public.watchlist (
  id          BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID          NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX watchlist_profile_id_idx ON public.watchlist (profile_id);

-- ─── watchlist_item ───────────────────────────────────────────────────────────
CREATE TABLE public.watchlist_item (
  id            BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  watchlist_id  BIGINT        NOT NULL REFERENCES public.watchlist(id) ON DELETE CASCADE,
  media_type    TEXT          NOT NULL CHECK (media_type IN ('movie', 'show')),
  movie_id      BIGINT        REFERENCES public.movie(id) ON DELETE CASCADE,
  show_id       BIGINT        REFERENCES public.show(id) ON DELETE CASCADE,
  watched       BOOLEAN       NOT NULL DEFAULT false,
  added_at      TIMESTAMPTZ   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT watchlist_item_one_media CHECK (
    (movie_id IS NOT NULL AND show_id IS NULL) OR
    (movie_id IS NULL     AND show_id IS NOT NULL)
  )
);

-- Prevent adding the same item twice to the same list.
CREATE UNIQUE INDEX watchlist_item_movie_unique ON public.watchlist_item (watchlist_id, movie_id) WHERE movie_id IS NOT NULL;
CREATE UNIQUE INDEX watchlist_item_show_unique  ON public.watchlist_item (watchlist_id, show_id)  WHERE show_id  IS NOT NULL;
CREATE INDEX watchlist_item_watchlist_id_idx ON public.watchlist_item (watchlist_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist: own rows"
  ON public.watchlist
  FOR ALL
  TO authenticated
  USING  (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

ALTER TABLE public.watchlist_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_item: own watchlist items"
  ON public.watchlist_item
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlist w
      WHERE w.id = watchlist_id AND w.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watchlist w
      WHERE w.id = watchlist_id AND w.profile_id = auth.uid()
    )
  );

-- ─── Count limit trigger ──────────────────────────────────────────────────────
-- Enforces per-tier max watchlist count before each INSERT on watchlist.
-- Uses get_effective_tier() so expiry + early-adopter logic is respected.
CREATE OR REPLACE FUNCTION public.enforce_watchlist_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier  TEXT;
  v_max   INT;
  v_count INT;
BEGIN
  SELECT get_effective_tier(NEW.profile_id) INTO v_tier;

  v_max := CASE v_tier
    WHEN 'free'     THEN 1
    WHEN 'premium'  THEN 3
    WHEN 'pro'      THEN 10
    WHEN 'pro_plus' THEN 10
    WHEN 'god'      THEN NULL
    ELSE 1
  END;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.watchlist
    WHERE profile_id = NEW.profile_id;

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'WATCHLIST_LIMIT_REACHED: Your % plan allows up to % watchlist(s). Upgrade to create more.', v_tier, v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_watchlist_limit_trigger
  BEFORE INSERT ON public.watchlist
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_watchlist_limit();
