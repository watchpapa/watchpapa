-- Whether to blur the poster of a title flagged nsfw (see worker/src/tmdb/nsfw.js)
-- wherever it appears as a card. Only meaningful once "show adult content" is on
-- (nsfw titles never render at all otherwise) — defaults to true (blurred) so
-- opting into adult content doesn't also opt into unblurred posters by surprise.
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS setting_blur_nsfw_posters BOOLEAN NOT NULL DEFAULT true;
