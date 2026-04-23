# Documentation backlog

Items tracked here are follow-ups for schema or docs that are not part of a single script change.

## Database migrations (TV / seed upserts)

**Already reflected in the public DDL snapshot:**

- `person.tmdb_id` — **`NOT NULL UNIQUE`** (`inject_person`: `ON CONFLICT (tmdb_id)`).
- `season.tmdb_id` — **`NOT NULL UNIQUE`** — TV ingest can upsert seasons with `ON CONFLICT (tmdb_id) DO UPDATE` (and still set `show_id` / `season_number` from TMDB on conflict).
- `episode.tmdb_id` — **`NOT NULL UNIQUE`** — TV ingest can upsert episodes with `ON CONFLICT (tmdb_id) DO UPDATE` while keeping `id` independent as the database-generated primary key.

**Optional follow-ups** (not in the current DDL): composite uniques if you want the database to enforce “one row per show season index” or “one row per season episode index” independent of TMDB id stability:

- **`season`:** `UNIQUE (show_id, season_number)` (redundant with global `tmdb_id` uniqueness for TMDB-sourced data, but documents the in-show identity).
- **`episode`:** `UNIQUE (season_id, episode_number)` (same note).

## Related references

- Public model snapshot: [supabase_public_model.md](./supabase_public_model.md)
- Index summary: [available_public_indexes.md](./available_public_indexes.md)
