import { Hono } from "hono";
import { withSql } from "../../db.js";

// Port of Backend/src/routes/admin/stats.js. The /catalog content+credits halves and
// the /queue endpoint are dropped (they counted the mirror / in-process queue).

export const stats = new Hono();

const EARLY_ADOPTER_CAPACITY = 5000;

stats.get("/early-adopters", async (c) =>
  withSql(c, async (sql) => {
    const [row] = await sql`
      SELECT COUNT(*)::int AS count FROM public.user_subscriptions WHERE is_early_adopter = true
    `;
    const count = row.count;
    return c.json({
      count,
      capacity: EARLY_ADOPTER_CAPACITY,
      remaining: Math.max(0, EARLY_ADOPTER_CAPACITY - count),
      is_full: count >= EARLY_ADOPTER_CAPACITY,
    });
  }),
);

stats.get("/early-adopters/list", async (c) => {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10) || 50));
  const offset = (page - 1) * limit;
  return withSql(c, async (sql) => {
    const [list, [count]] = await Promise.all([
      sql`
        SELECT au.id, au.email, au.created_at, p.username
        FROM public.user_subscriptions us
        JOIN public.profile p ON p.id = us.profile_id
        JOIN auth.users au ON au.id = us.profile_id
        WHERE us.is_early_adopter = true AND p.deleted_at IS NULL
        ORDER BY au.created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM public.user_subscriptions us
        JOIN public.profile p ON p.id = us.profile_id
        WHERE us.is_early_adopter = true AND p.deleted_at IS NULL
      `,
    ]);
    return c.json({ list, total: count.total, page, limit });
  });
});

stats.get("/tiers", async (c) =>
  withSql(c, async (sql) => {
    const rows = await sql`
      SELECT
        CASE
          WHEN us.tier IS NULL THEN 'free'
          WHEN us.tier = 'god' THEN 'god'
          WHEN us.expires_at IS NULL OR us.expires_at > now() THEN us.tier
          WHEN us.is_early_adopter = true THEN 'premium'
          ELSE 'free'
        END AS tier,
        COUNT(*)::int AS count
      FROM public.profile p
      LEFT JOIN public.user_subscriptions us ON us.profile_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY 1
      ORDER BY count DESC
    `;
    const total = rows.reduce((s, r) => s + r.count, 0);
    return c.json({ tiers: rows.map((r) => ({ tier: r.tier, count: r.count })), total });
  }),
);

// Activity-only catalog stats (content + credits counts removed with the mirror).
stats.get("/catalog", async (c) =>
  withSql(c, async (sql) => {
    const [row] = await sql`
      SELECT
        (SELECT COUNT(*) FROM public.user_rating)::int          AS ratings,
        (SELECT COUNT(*) FROM public.watchlist_item)::int       AS watchlist_items,
        (SELECT COUNT(*) FROM public.watchlist)::int            AS watchlists,
        (SELECT COUNT(*) FROM public.user_followed_movies)::int AS followed_movies,
        (SELECT COUNT(*) FROM public.user_followed_shows)::int  AS followed_shows,
        (SELECT COUNT(*) FROM public.profile_favourite)::int    AS favourites,
        (SELECT COUNT(*) FROM public.profile WHERE deleted_at IS NULL)::int AS profiles
    `;
    return c.json({
      activity: {
        profiles: row.profiles,
        ratings: row.ratings,
        watchlistItems: row.watchlist_items,
        watchlists: row.watchlists,
        followedMovies: row.followed_movies,
        followedShows: row.followed_shows,
        favourites: row.favourites,
      },
    });
  }),
);
