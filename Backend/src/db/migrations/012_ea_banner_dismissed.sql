-- Generic banner-dismissal store so any future banner can be persisted
-- without schema changes. Each row records one user dismissing one banner.

CREATE TABLE public.user_banner_dismissals (
  profile_id   UUID   NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  banner_key   TEXT   NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  PRIMARY KEY (profile_id, banner_key)
);

ALTER TABLE public.user_banner_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_banner_dismissals: own row read"
  ON public.user_banner_dismissals
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ─── dismiss_banner ───────────────────────────────────────────────────────────
-- Idempotent. Safe to call multiple times — conflict is silently ignored.
CREATE OR REPLACE FUNCTION public.dismiss_banner(p_banner_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_banner_dismissals (profile_id, banner_key)
  VALUES (auth.uid(), p_banner_key)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_banner(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_banner(TEXT) TO authenticated;
