import { Router } from "express";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

// GET /api/admin/analytics/dau-wau-mau
router.get("/dau-wau-mau", async (_req, res) => {
  try {
    const [row] = await sequelize.query(
      `SELECT
         COUNT(DISTINCT CASE WHEN hour_bucket >= now() - INTERVAL '1 day'   THEN profile_id END) AS dau,
         COUNT(DISTINCT CASE WHEN hour_bucket >= now() - INTERVAL '7 days'  THEN profile_id END) AS wau,
         COUNT(DISTINCT CASE WHEN hour_bucket >= now() - INTERVAL '30 days' THEN profile_id END) AS mau
       FROM public.analytics_presence_hours
       WHERE hour_bucket >= now() - INTERVAL '30 days'`,
      { type: QueryTypes.SELECT }
    );
    res.json({ dau: parseInt(row.dau, 10), wau: parseInt(row.wau, 10), mau: parseInt(row.mau, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/heatmap-dow
// Returns 0=Sun … 6=Sat counts of distinct users for the last 30 days.
router.get("/heatmap-dow", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         EXTRACT(DOW FROM hour_bucket AT TIME ZONE 'UTC')::INT AS dow,
         COUNT(DISTINCT profile_id) AS unique_users
       FROM public.analytics_presence_hours
       WHERE hour_bucket >= now() - INTERVAL '30 days'
       GROUP BY 1
       ORDER BY 1`,
      { type: QueryTypes.SELECT }
    );
    const data = Array.from({ length: 7 }, (_, i) => ({ dow: i, unique_users: 0 }));
    for (const r of rows) data[r.dow].unique_users = parseInt(r.unique_users, 10);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/heatmap-hour
// Returns 0–23 hour-of-day counts of distinct users for the last 30 days.
router.get("/heatmap-hour", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         EXTRACT(HOUR FROM hour_bucket AT TIME ZONE 'UTC')::INT AS hour_of_day,
         COUNT(DISTINCT profile_id) AS unique_users
       FROM public.analytics_presence_hours
       WHERE hour_bucket >= now() - INTERVAL '30 days'
       GROUP BY 1
       ORDER BY 1`,
      { type: QueryTypes.SELECT }
    );
    const data = Array.from({ length: 24 }, (_, i) => ({ hour_of_day: i, unique_users: 0 }));
    for (const r of rows) data[r.hour_of_day].unique_users = parseInt(r.unique_users, 10);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/pages-per-session
// Sessions = groups of page views separated by <= 30 min idle.
// Excludes admins (role=4) and users in the exclusions table.
router.get("/pages-per-session", async (_req, res) => {
  try {
    const [row] = await sequelize.query(
      `WITH eligible AS (
         SELECT pv.profile_id, pv.visited_at
         FROM public.analytics_page_views pv
         WHERE pv.visited_at >= now() - INTERVAL '30 days'
           AND NOT EXISTS (
             SELECT 1 FROM public.analytics_tracking_exclusions e
             WHERE e.profile_id = pv.profile_id
           )
       ),
       gaps AS (
         SELECT
           profile_id,
           CASE
             WHEN visited_at - LAG(visited_at) OVER (PARTITION BY profile_id ORDER BY visited_at)
                  > INTERVAL '30 minutes'
               OR LAG(visited_at) OVER (PARTITION BY profile_id ORDER BY visited_at) IS NULL
             THEN 1 ELSE 0
           END AS new_session
         FROM eligible
       ),
       session_ids AS (
         SELECT
           profile_id,
           SUM(new_session) OVER (PARTITION BY profile_id ORDER BY rownum ROWS UNBOUNDED PRECEDING) AS session_num
         FROM (SELECT profile_id, new_session, ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY (SELECT NULL)) AS rownum FROM gaps) g
       ),
       session_sizes AS (
         SELECT profile_id, session_num, COUNT(*) AS pages
         FROM session_ids
         GROUP BY profile_id, session_num
       )
       SELECT
         ROUND(AVG(pages), 2) AS avg_pages,
         MIN(pages)           AS min_pages,
         MAX(pages)           AS max_pages,
         COUNT(*)             AS total_sessions
       FROM session_sizes`,
      { type: QueryTypes.SELECT }
    );
    res.json({
      avg_pages: parseFloat(row.avg_pages ?? 0),
      min_pages: parseInt(row.min_pages ?? 0, 10),
      max_pages: parseInt(row.max_pages ?? 0, 10),
      total_sessions: parseInt(row.total_sessions ?? 0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/top-content?limit=20
// Most-clicked movies and shows in the last 7 days.
router.get("/top-content", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const rows = await sequelize.query(
      `SELECT
         acc.content_type,
         acc.content_id,
         COUNT(*) AS clicks_7d,
         COALESCE(m.title, s.name) AS title
       FROM public.analytics_content_clicks acc
       LEFT JOIN public.movie m ON acc.content_type = 'movie' AND m.id = acc.content_id
       LEFT JOIN public.show  s ON acc.content_type = 'show'  AND s.id = acc.content_id
       WHERE acc.clicked_at >= now() - INTERVAL '7 days'
       GROUP BY acc.content_type, acc.content_id, m.title, s.name
       ORDER BY clicks_7d DESC
       LIMIT :limit`,
      { replacements: { limit }, type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, clicks_7d: parseInt(r.clicks_7d, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/click-by-type
// Total movie vs show clicks in the last 30 days.
router.get("/click-by-type", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT content_type, COUNT(*) AS total_clicks
       FROM public.analytics_content_clicks
       WHERE clicked_at >= now() - INTERVAL '30 days'
       GROUP BY content_type`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, total_clicks: parseInt(r.total_clicks, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/click-by-source
// Click counts broken down by discovery source for the last 30 days.
router.get("/click-by-source", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS total_clicks
       FROM public.analytics_content_clicks
       WHERE clicked_at >= now() - INTERVAL '30 days'
       GROUP BY source
       ORDER BY total_clicks DESC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, total_clicks: parseInt(r.total_clicks, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/genre-clicks?limit=20
// Most-clicked genres in the last 30 days.
router.get("/genre-clicks", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const rows = await sequelize.query(
      `SELECT
         agc.genre_id,
         g.name AS genre_name,
         agc.content_type,
         COUNT(*) AS click_count
       FROM public.analytics_genre_clicks agc
       JOIN public.genres g ON g.id = agc.genre_id
       WHERE agc.clicked_at >= now() - INTERVAL '30 days'
       GROUP BY agc.genre_id, g.name, agc.content_type
       ORDER BY click_count DESC
       LIMIT :limit`,
      { replacements: { limit }, type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, click_count: parseInt(r.click_count, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/follow-by-genre?limit=20
// Follow counts per genre derived from existing follow tables (no new storage).
router.get("/follow-by-genre", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const rows = await sequelize.query(
      `SELECT genre_name, content_type, follower_count FROM (
         SELECT g.name AS genre_name, 'movie' AS content_type,
                COUNT(DISTINCT ufm.profile_id) AS follower_count
         FROM public.user_followed_movies ufm
         JOIN public.movie_genre mg ON mg.movie_id = ufm.movie_id
         JOIN public.genres g ON g.id = mg.genres_id
         GROUP BY g.name
         UNION ALL
         SELECT g.name AS genre_name, 'show' AS content_type,
                COUNT(DISTINCT ufs.profile_id) AS follower_count
         FROM public.user_followed_shows ufs
         JOIN public.show_genre sg ON sg.show_id = ufs.show_id
         JOIN public.genres g ON g.id = sg.genres_id
         GROUP BY g.name
       ) sub
       ORDER BY follower_count DESC
       LIMIT :limit`,
      { replacements: { limit }, type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, follower_count: parseInt(r.follower_count, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/follow-by-type
// Total follows per content type derived from existing follow tables.
router.get("/follow-by-type", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT 'movie' AS content_type, COUNT(*) AS follow_count FROM public.user_followed_movies
       UNION ALL
       SELECT 'show'  AS content_type, COUNT(*) AS follow_count FROM public.user_followed_shows`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, follow_count: parseInt(r.follow_count, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/new-user-activation
// % of users who signed up in the last 30 days and followed at least 1 item within 7 days.
router.get("/new-user-activation", async (_req, res) => {
  try {
    const [row] = await sequelize.query(
      `WITH new_users AS (
         SELECT id AS profile_id, created_at
         FROM public.profile
         WHERE created_at >= now() - INTERVAL '30 days'
           AND deleted_at IS NULL
       ),
       first_follows AS (
         SELECT profile_id, MIN(created_at) AS first_follow_at
         FROM (
           SELECT profile_id, created_at FROM public.user_followed_movies
           UNION ALL
           SELECT profile_id, created_at FROM public.user_followed_shows
         ) all_follows
         GROUP BY profile_id
       )
       SELECT
         COUNT(nu.profile_id) AS new_users,
         COUNT(ff.profile_id) AS activated,
         CASE WHEN COUNT(nu.profile_id) = 0 THEN 0
              ELSE ROUND(COUNT(ff.profile_id)::NUMERIC / COUNT(nu.profile_id) * 100, 1)
         END AS activation_pct
       FROM new_users nu
       LEFT JOIN first_follows ff
         ON ff.profile_id = nu.profile_id
        AND ff.first_follow_at <= nu.created_at + INTERVAL '7 days'`,
      { type: QueryTypes.SELECT }
    );
    res.json({
      new_users: parseInt(row.new_users, 10),
      activated: parseInt(row.activated, 10),
      activation_pct: parseFloat(row.activation_pct ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/unfollow-rate
// Follow vs unfollow counts per week for the last 12 weeks, broken out by content type.
// Derived from audit_events (no new storage required).
router.get("/unfollow-rate", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         date_trunc('week', created_at)::DATE AS week_start,
         CASE
           WHEN action IN ('follow_movie', 'follow_show') THEN 'follow'
           ELSE 'unfollow'
         END AS event_type,
         CASE
           WHEN action IN ('follow_movie', 'unfollow_movie') THEN 'movie'
           ELSE 'show'
         END AS content_type,
         COUNT(*) AS event_count
       FROM public.audit_events
       WHERE action IN ('follow_movie', 'unfollow_movie', 'follow_show', 'unfollow_show')
         AND created_at >= now() - INTERVAL '12 weeks'
       GROUP BY 1, 2, 3
       ORDER BY 1 DESC, 2, 3`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({ ...r, event_count: parseInt(r.event_count, 10) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/analytics/exclusions
// Returns manually excluded users only.
router.get("/exclusions", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         e.profile_id,
         au.email,
         p.username,
         e.excluded_at,
         e.note,
         ep.username AS excluded_by_username
       FROM public.analytics_tracking_exclusions e
       JOIN auth.users au ON au.id = e.profile_id
       JOIN public.profile p ON p.id = e.profile_id
       LEFT JOIN public.profile ep ON ep.id = e.excluded_by
       ORDER BY e.excluded_at DESC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/analytics/exclusions
// Body: { profile_id, note? }
router.post("/exclusions", async (req, res) => {
  try {
    const { profile_id, note } = req.body ?? {};
    if (!profile_id) return res.status(400).json({ error: "profile_id required" });
    await sequelize.query(
      `INSERT INTO public.analytics_tracking_exclusions (profile_id, excluded_by, note)
       VALUES (:profile_id, :excluded_by, :note)
       ON CONFLICT (profile_id) DO UPDATE SET note = EXCLUDED.note`,
      { replacements: { profile_id, excluded_by: req.user.id, note: note ?? null }, type: QueryTypes.INSERT }
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/analytics/exclusions/:profileId
router.delete("/exclusions/:profileId", async (req, res) => {
  try {
    await sequelize.query(
      `DELETE FROM public.analytics_tracking_exclusions WHERE profile_id = :profile_id`,
      { replacements: { profile_id: req.params.profileId }, type: QueryTypes.DELETE }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
