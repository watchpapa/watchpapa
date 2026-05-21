-- Announcements table for the public Updates page.
-- Author is tracked internally but never exposed publicly — posts appear as "watchpapa".
-- Soft deletes only (archived = true); hard deletes are DB-level only.
-- All reads/writes go through the Express backend with the service-role key.

CREATE TABLE public.announcements (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  image_url  TEXT,
  author_id  UUID        NOT NULL REFERENCES auth.users(id),
  archived   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX announcements_created_at_idx ON public.announcements(created_at DESC);
CREATE INDEX announcements_archived_idx   ON public.announcements(archived, created_at DESC);
