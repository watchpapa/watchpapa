import { Router } from "express";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";
import { getInflightKeys } from "../../lib/ingestionQueue.js";

const router = Router();

const EARLY_ADOPTER_CAPACITY = 5000;

// GET /api/admin/stats/early-adopters
router.get("/early-adopters", async (_req, res) => {
  const [result] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM public.user_subscriptions WHERE is_early_adopter = true`,
    { type: QueryTypes.SELECT }
  );

  const count = parseInt(result.count, 10);

  res.json({
    count,
    capacity: EARLY_ADOPTER_CAPACITY,
    remaining: Math.max(0, EARLY_ADOPTER_CAPACITY - count),
    is_full: count >= EARLY_ADOPTER_CAPACITY,
  });
});

// GET /api/admin/stats/early-adopters/list — paginated list of early adopter accounts
router.get("/early-adopters/list", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const [list, countResult] = await Promise.all([
    sequelize.query(
      `SELECT
         au.id,
         au.email,
         au.created_at,
         p.username
       FROM public.user_subscriptions us
       JOIN public.profile p ON p.id = us.profile_id
       JOIN auth.users au ON au.id = us.profile_id
       WHERE us.is_early_adopter = true
         AND p.deleted_at IS NULL
       ORDER BY au.created_at ASC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS total
       FROM public.user_subscriptions us
       JOIN public.profile p ON p.id = us.profile_id
       WHERE us.is_early_adopter = true AND p.deleted_at IS NULL`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  res.json({ list, total: parseInt(countResult[0].total, 10), page, limit });
});

// GET /api/admin/stats/tiers
router.get("/tiers", async (_req, res) => {
  const rows = await sequelize.query(
    `SELECT
       CASE
         WHEN us.tier IS NULL THEN 'free'
         WHEN us.tier = 'god' THEN 'god'
         WHEN us.expires_at IS NULL OR us.expires_at > now() THEN us.tier
         WHEN us.is_early_adopter = true THEN 'premium'
         ELSE 'free'
       END AS tier,
       COUNT(*) AS count
     FROM public.profile p
     LEFT JOIN public.user_subscriptions us ON us.profile_id = p.id
     WHERE p.deleted_at IS NULL
     GROUP BY 1
     ORDER BY count DESC`,
    { type: QueryTypes.SELECT }
  );

  const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
  const tiers = rows.map((r) => ({ tier: r.tier, count: parseInt(r.count, 10) }));

  res.json({ tiers, total });
});

// GET /api/admin/stats/catalog
router.get("/catalog", async (_req, res) => {
  const [rows] = await sequelize.query(
    `SELECT
       -- content
       (SELECT COUNT(*) FROM movie WHERE deleted_at IS NULL)                   AS movies_active,
       (SELECT COUNT(*) FROM movie WHERE deleted_at IS NOT NULL)               AS movies_deleted,
       (SELECT COUNT(*) FROM show)                                             AS shows,
       (SELECT COUNT(*) FROM season)                                           AS seasons,
       (SELECT COUNT(*) FROM episode)                                          AS episodes,
       (SELECT COUNT(*) FROM person WHERE deleted_at IS NULL)                  AS people_active,
       (SELECT COUNT(*) FROM person WHERE deleted_at IS NOT NULL)              AS people_deleted,
       (SELECT COUNT(*) FROM genres)                                           AS genres,
       -- credits
       (SELECT COUNT(*) FROM movie_credits)                                    AS movie_credits,
       (SELECT COUNT(*) FROM show_credits)                                     AS show_credits,
       (SELECT COUNT(*) FROM episode_credits)                                  AS episode_credits,
       -- person extras
       (SELECT COUNT(*) FROM person_aka WHERE deleted_at IS NULL)              AS person_akas,
       -- user activity
       (SELECT COUNT(*) FROM user_rating)                                      AS ratings,
       (SELECT COUNT(*) FROM watchlist_item)                                   AS watchlist_items,
       (SELECT COUNT(*) FROM watchlist)                                        AS watchlists,
       (SELECT COUNT(*) FROM user_followed_movies)                             AS followed_movies,
       (SELECT COUNT(*) FROM user_followed_shows)                              AS followed_shows,
       (SELECT COUNT(*) FROM profile_favourite)                                AS favourites`,
    { type: QueryTypes.SELECT }
  );

  const n = (v) => parseInt(v ?? 0, 10);
  res.json({
    content: {
      movies:         { active: n(rows.movies_active), deleted: n(rows.movies_deleted) },
      shows:          n(rows.shows),
      seasons:        n(rows.seasons),
      episodes:       n(rows.episodes),
      people:         { active: n(rows.people_active), deleted: n(rows.people_deleted) },
      genres:         n(rows.genres),
    },
    credits: {
      movie:   n(rows.movie_credits),
      show:    n(rows.show_credits),
      episode: n(rows.episode_credits),
      personAkas: n(rows.person_akas),
    },
    activity: {
      ratings:        n(rows.ratings),
      watchlistItems: n(rows.watchlist_items),
      watchlists:     n(rows.watchlists),
      followedMovies: n(rows.followed_movies),
      followedShows:  n(rows.followed_shows),
      favourites:     n(rows.favourites),
    },
  });
});

// GET /api/admin/stats/queue
// Returns currently running ingest jobs (in-process only — resets on server restart).
router.get("/queue", (_req, res) => {
  const keys = getInflightKeys();
  res.json({
    count: keys.length,
    jobs: keys,
  });
});

export default router;
