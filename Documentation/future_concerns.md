# Future Concerns

## TMDB Rate Limiter Scope (Per-Process)

The one gap: it's still per-process.

The `requestTimestamps` array and `acquireChain` are module-level singletons, so they have the same boundary as the dedup map — they only work within a single Node process.

If you ever run multiple web server instances behind a load balancer, each process gets its own 35 req/s budget, and together they could exceed TMDB's limit.

For a single-server deployment this is a non-issue.

## Resolved

### Genre Replace Strategy (movie_genre / show_genre)

Previously `replaceMovieGenres` and `replaceShowGenres` did a blunt `DELETE FROM <join_table> WHERE <fk> = :id` followed by a bulk `INSERT`. That destroyed rows that were about to be re-inserted and briefly left the entity with zero genres mid-transaction.

The Supabase index advisor added `UNIQUE (movie_id, genres_id)` on `movie_genre` and `UNIQUE (show_id, genres_id)` on `show_genre`. With those constraints in place, both functions now:

1. `INSERT … VALUES (...) ON CONFLICT (<fk>, genres_id) DO NOTHING` to add only new associations.
2. `DELETE FROM <join_table> WHERE <fk> = :id AND genres_id NOT IN (...)` to remove associations no longer in the incoming TMDB set.

When the resolved id list is empty (entity has no genres, or all TMDB genres failed lookup) the functions fall back to the original full-clear `DELETE`, preserving prior behaviour.
