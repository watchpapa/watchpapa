-- Track who archived each announcement and when.
ALTER TABLE public.announcements
  ADD COLUMN archived_by  UUID        REFERENCES auth.users(id),
  ADD COLUMN archived_at  TIMESTAMPTZ;
