import { Router } from "express";
import { QueryTypes } from "sequelize";
import { ingestMovie } from "../../scripts/inject_movie.js";
import { ingestTvShow } from "../../scripts/inject_tv_show.js";
import { ingestPerson } from "../../scripts/inject_person.js";
import { dedupIngest } from "../../lib/ingestionQueue.js";
import { logScriptRun } from "../../lib/logScriptRun.js";
import { searchLocal } from "../../services/searchService.js";
import sequelize from "../../db/database.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;

const ALLOWED_TYPES = new Set(["movie", "show", "person"]);

const MOVIE_SCOPE_KEYS = new Set(["details", "genres", "credits"]);
const SHOW_SCOPE_KEYS = new Set(["details", "genres", "credits", "seasons", "episodes", "episodeCredits"]);
const PERSON_SCOPE_KEYS = new Set(["details", "aka"]);

function validateScope(type, scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return null;
  const allowed =
    type === "movie" ? MOVIE_SCOPE_KEYS :
    type === "show"  ? SHOW_SCOPE_KEYS :
                       PERSON_SCOPE_KEYS;
  const result = {};
  for (const key of allowed) {
    result[key] = scope[key] === true;
  }
  return result;
}

// GET /api/admin/resync/search?q=&type=
router.get("/search", async (req, res) => {
  const q = (req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ results: [] });
  if (q.length > 100) return res.status(400).json({ error: "Query too long" });

  const typeFilter = req.query.type ?? "";
  try {
    const results = await searchLocal(q, 10, { includeAdult: true });
    const filtered =
      typeFilter && ALLOWED_TYPES.has(typeFilter)
        ? results.filter((r) => r.type === typeFilter)
        : results;
    res.json({ results: filtered });
  } catch (err) {
    console.error("Admin resync search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// POST /api/admin/resync
router.post("/", (req, res) => {
  const { type, tmdbId: rawId, scope: rawScope } = req.body ?? {};
  const tmdbId = Number(rawId);

  if (!ALLOWED_TYPES.has(type) || !Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId > 9_999_999) {
    return res.status(400).json({ error: "type must be movie|show|person and tmdbId must be a positive integer" });
  }
  if (!TMDB_API_KEY) return res.status(503).json({ error: "Service unavailable" });

  const scope = rawScope ? validateScope(type, rawScope) : null;

  res.json({ ok: true, queued: true });

  if (type === "movie") {
    dedupIngest(`admin-resync:movie:${tmdbId}`, async () => {
      const startedAt = new Date();
      const scriptName = `inject_movie:${tmdbId}`;
      try {
        const result = await ingestMovie({ tmdbId, apiKey: TMDB_API_KEY, forceRefreshExisting: true, refreshScope: scope });
        await logScriptRun({ scriptName, status: "success", batchSize: (result?.castLinked ?? 0) + (result?.crewLinked ?? 0), startedAt });
      } catch (e) {
        await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
        throw e;
      }
    }).catch((e) => console.warn(`admin resync movie tmdb_id=${tmdbId}:`, e.message));
  } else if (type === "show") {
    dedupIngest(`admin-resync:show:${tmdbId}`, async () => {
      const startedAt = new Date();
      const scriptName = `inject_tv_show:${tmdbId}`;
      try {
        const result = await ingestTvShow({ tmdbTvId: tmdbId, apiKey: TMDB_API_KEY, forceRefreshExisting: true, refreshScope: scope });
        await logScriptRun({ scriptName, status: "success", batchSize: result?.creditsLinked ?? null, startedAt });
      } catch (e) {
        await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
        throw e;
      }
    }).catch((e) => console.warn(`admin resync show tmdb_id=${tmdbId}:`, e.message));
  } else if (type === "person") {
    dedupIngest(`admin-resync:person:${tmdbId}`, async () => {
      const startedAt = new Date();
      const scriptName = `inject_person:${tmdbId}`;
      try {
        await ingestPerson({ tmdbId, apiKey: TMDB_API_KEY, forceRefreshExisting: true, refreshScope: scope });
        await logScriptRun({ scriptName, status: "success", batchSize: 1, startedAt });
      } catch (e) {
        await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
        throw e;
      }
    }).catch((e) => console.warn(`admin resync person tmdb_id=${tmdbId}:`, e.message));
  }
});

const BULK_CAP = 100000;

const BULK_TABLE = { movie: "movie", show: "show", person: "person" };

// POST /api/admin/resync/bulk
router.post("/bulk", async (req, res) => {
  const { type, since: rawSince } = req.body ?? {};

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "type must be movie|show|person" });
  }
  if (!TMDB_API_KEY) return res.status(503).json({ error: "Service unavailable" });

  let since = null;
  if (rawSince) {
    since = new Date(rawSince);
    if (isNaN(since.getTime())) return res.status(400).json({ error: "Invalid since timestamp" });
  }

  const table = BULK_TABLE[type];
  const hasSoftDelete = type === "movie" || type === "person";

  const sql = `
    SELECT tmdb_id FROM ${table}
    WHERE TRUE
    ${hasSoftDelete ? "AND deleted_at IS NULL" : ""}
    ${since ? "AND updated_at >= :since" : ""}
    ORDER BY updated_at DESC
    LIMIT :cap
  `;

  let rows;
  try {
    rows = await sequelize.query(sql, {
      replacements: { since: since?.toISOString() ?? null, cap: BULK_CAP },
      type: QueryTypes.SELECT,
    });
  } catch (err) {
    console.error("Admin bulk resync query error:", err);
    return res.status(500).json({ error: "Failed to fetch items" });
  }

  const tmdbIds = rows.map((r) => r.tmdb_id);
  const count = tmdbIds.length;

  res.json({ ok: true, queued: count, capped: count === BULK_CAP });

  const startedAt = new Date();
  const scriptName = `bulk_resync:${type}${since ? `:since_${since.toISOString()}` : ""}`;

  const ingestFn =
    type === "movie"  ? (id) => ingestMovie({ tmdbId: id, apiKey: TMDB_API_KEY, forceRefreshExisting: true }) :
    type === "show"   ? (id) => ingestTvShow({ tmdbTvId: id, apiKey: TMDB_API_KEY, forceRefreshExisting: true }) :
                        (id) => ingestPerson({ tmdbId: id, apiKey: TMDB_API_KEY, forceRefreshExisting: true });

  let succeeded = 0;
  let failed = 0;

  const jobs = tmdbIds.map((tmdbId) =>
    dedupIngest(`admin-resync:${type}:${tmdbId}`, async () => {
      try {
        await ingestFn(tmdbId);
        succeeded++;
      } catch (e) {
        failed++;
        console.warn(`bulk resync ${type} tmdb_id=${tmdbId}:`, e.message);
      }
    }).catch((e) => { failed++; console.warn(`bulk resync ${type} tmdb_id=${tmdbId}:`, e.message); })
  );

  Promise.all(jobs).then(() =>
    logScriptRun({
      scriptName,
      status: failed === 0 ? "success" : "failure",
      batchSize: count,
      startedAt,
    }).catch(() => {})
  );
});

export default router;
