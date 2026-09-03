// Card-key helpers for POST /api/content/batch.
// key: movie:ID | show:ID | person:ID | season:SHOW:N | episode:SHOW:N:M

export function cardKey(item) {
  if (item.type === "season") return `season:${item.showId}:${item.seasonNumber}`;
  if (item.type === "episode") return `episode:${item.showId}:${item.seasonNumber}:${item.episodeNumber}`;
  return `${item.type}:${item.id}`;
}

// Map a user-data row (with the 029 tmdb_id columns) to a batch item.
// Works for user_rating, watchlist_item, profile_favourite, followed_* rows.
export function itemFromRow(row) {
  const mt = row.media_type;
  if (mt === "season") {
    return { type: "season", showId: row.tmdb_show_id, seasonNumber: row.season_number };
  }
  if (mt === "episode") {
    return {
      type: "episode",
      showId: row.tmdb_show_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
    };
  }
  return { type: mt, id: Number(row.tmdb_id) };
}
