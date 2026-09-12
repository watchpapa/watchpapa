-- 048_import_jobs — background Letterboxd/watchpapa CSV import.
--
-- Previously the browser drove the whole import: it parsed the CSV, then
-- sequentially awaited chunked /api/import/resolve calls and one final
-- /api/import/commit, all inside a single page load. Closing the tab mid-import
-- silently abandoned it (commit only ever fired once, at the end) with nothing
-- written and no way to resume.
--
-- This table is the job queue: the client still parses the CSV and dedupes to
-- a film list, but now hands it to the Worker once (POST /api/import/jobs) and
-- polls status (GET /api/import/jobs/:id). A Cloudflare Cron Trigger
-- (worker/src/cron.js, runs every minute — no Durable Objects/alarms on the
-- Workers Free plan) advances each pending job by one chunk per tick, so the
-- import finishes in the background regardless of whether the tab is open.
CREATE TABLE public.import_job (
  id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id     UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  status         TEXT         NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'resolving', 'committing', 'done', 'failed', 'cancelled')),
  -- { uniqueFilms, ratingsSrc, watchlistSrc, watchlistId, newWatchlistName, conflictMode }
  payload        JSONB        NOT NULL,
  -- filmKey -> tmdbId, accumulated as chunks resolve
  resolved       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- ["Name (Year)", ...] display strings for films that couldn't be matched
  unresolved     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  resolve_cursor INT          NOT NULL DEFAULT 0,
  total          INT          NOT NULL,
  result         JSONB,
  error          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

-- Cron picks the oldest unfinished jobs first.
CREATE INDEX import_job_pending_idx ON public.import_job (created_at)
  WHERE status IN ('pending', 'resolving', 'committing');
CREATE INDEX import_job_profile_idx ON public.import_job (profile_id, created_at DESC);

ALTER TABLE public.import_job ENABLE ROW LEVEL SECURITY;

-- Worker writes via the privileged pooler role (same as tier_reward / import
-- itself) — no client INSERT/UPDATE/DELETE policy. The frontend only ever
-- reads status through GET /api/import/jobs/:id, not this table directly, but
-- the read policy is here for consistency with every other per-user table.
CREATE POLICY "import_job: own read"
  ON public.import_job FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
