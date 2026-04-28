-- Migration 001: Performance indexes
-- Run once in the Supabase SQL editor (or any Postgres client connected to the project).
-- All statements are idempotent (IF NOT EXISTS / CREATE EXTENSION IF NOT EXISTS).

-- ─── genres ──────────────────────────────────────────────────────────────────
-- Injection scripts look up genres by tmdb_id; without this index every lookup
-- is a sequential scan on the genres table.
CREATE UNIQUE INDEX IF NOT EXISTS genres_tmdb_id_key ON genres(tmdb_id);

-- ─── person ──────────────────────────────────────────────────────────────────
-- searchLocal orders persons by popularity DESC; mirrors the pattern already
-- used by movie and show.
CREATE INDEX IF NOT EXISTS person_popularity_desc_idx
  ON person(popularity DESC)
  WHERE deleted_at IS NULL;

-- ─── trigram full-text search ────────────────────────────────────────────────
-- ILIKE '%…%' (leading wildcard) cannot use a btree index. GIN trigram indexes
-- make substring search fast regardless of table size.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS movie_title_trgm_idx
  ON movie USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS movie_orig_title_trgm_idx
  ON movie USING GIN (original_title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS show_name_trgm_idx
  ON show USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS show_orig_name_trgm_idx
  ON show USING GIN (original_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS person_name_trgm_idx
  ON person USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS person_aka_nickname_trgm_idx
  ON person_aka USING GIN (nickname gin_trgm_ops)
  WHERE deleted_at IS NULL;
