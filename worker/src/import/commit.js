// Called once per resolved chunk (cron.js) so ratings/watchlist rows land
// as soon as their films resolve, rather than in one commit at the very end
// — the profile fills in gradually as the import progresses. Takes a raw
// `sql` client (postgres.js), not the Hono `c`, since it runs outside a
// request. Throws on failure — callers map errors (e.g.
// WATCHLIST_LIMIT_REACHED) to a stored job.error.
//
// Returns `watchlistId` so a chunk that creates a new watchlist can hand its
// id back to the caller, which persists it onto the job payload — later
// chunks reuse that id instead of creating a duplicate watchlist each time.
//
// { profileId, ratings: [{tmdbId, value, ratedAt?}], watchlistItems: [{tmdbId, watched}],
//   watchlistId?, newWatchlistName?, conflictMode: 'skip'|'overwrite' }
export async function commitImport(
  sql,
  { profileId, ratings = [], watchlistItems = [], watchlistId: rawWatchlistId, newWatchlistName, conflictMode },
) {
  if (ratings.length === 0 && watchlistItems.length === 0) {
    return { ratingsImported: 0, ratingsSkipped: 0, watchlistAdded: 0, watchlistSkipped: 0, watchlistId: rawWatchlistId ?? null };
  }

  let watchlistId = rawWatchlistId != null ? Number(rawWatchlistId) : null;
  if (watchlistId != null) {
    const [owner] = await sql`SELECT id FROM public.watchlist WHERE id = ${watchlistId} AND profile_id = ${profileId}`;
    if (!owner) throw new Error("Watchlist not found or does not belong to you");
  }

  // One transaction so a single `watchpapa.audit_skip` (SET LOCAL — scoped to
  // this transaction only) suppresses the per-row DB audit triggers for the
  // whole batch; the caller records one `import_committed` summary row instead.
  const result = await sql.begin(async (tx) => {
    await tx`SELECT set_config('watchpapa.audit_skip', '1', true)`;

    let wlId = watchlistId;
    if (watchlistItems.length > 0 && wlId == null && newWatchlistName?.trim()) {
      const [row] = await tx`
        INSERT INTO public.watchlist (profile_id, name, created_at, updated_at)
        VALUES (${profileId}, ${newWatchlistName.trim().slice(0, 100)}, now(), now())
        RETURNING id
      `;
      wlId = Number(row.id);
    }

    let ratingsImported = 0;
    let watchlistAdded = 0;

    if (ratings.length > 0) {
      const values = ratings.map((r) => ({
        profile_id: profileId,
        media_type: "movie",
        tmdb_id: r.tmdbId,
        value: r.value,
        created_at: r.ratedAt ? `${r.ratedAt}T00:00:00.000Z` : new Date().toISOString(),
      }));
      const conflict =
        conflictMode === "overwrite"
          ? tx`DO UPDATE SET value = EXCLUDED.value, created_at = EXCLUDED.created_at, updated_at = now()`
          : tx`DO NOTHING`;
      const inserted = await tx`
        INSERT INTO public.user_rating ${tx(values, "profile_id", "media_type", "tmdb_id", "value", "created_at")}
        ON CONFLICT (profile_id, media_type, tmdb_id) ${conflict}
        RETURNING id
      `;
      ratingsImported = inserted.length;
    }

    if (watchlistItems.length > 0 && wlId != null) {
      const values = watchlistItems.map((w) => ({
        watchlist_id: wlId,
        media_type: "movie",
        tmdb_id: w.tmdbId,
        watched: w.watched,
      }));
      const inserted = await tx`
        INSERT INTO public.watchlist_item ${tx(values, "watchlist_id", "media_type", "tmdb_id", "watched")}
        ON CONFLICT (watchlist_id, media_type, tmdb_id)
        DO UPDATE SET watched = CASE WHEN EXCLUDED.watched THEN true ELSE public.watchlist_item.watched END
        RETURNING id
      `;
      watchlistAdded = inserted.length;
    }

    return { ratingsImported, watchlistAdded, watchlistId: wlId };
  });

  return {
    ratingsImported: result.ratingsImported,
    ratingsSkipped: ratings.length - result.ratingsImported,
    watchlistAdded: result.watchlistAdded,
    watchlistSkipped: watchlistItems.length - result.watchlistAdded,
    watchlistId: result.watchlistId ?? null,
  };
}
