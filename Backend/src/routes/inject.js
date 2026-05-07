// Used by:
// - app.js
import { Router } from "express";
import { ingestMovie } from "../scripts/inject_movie.js";
import { ingestTvShow } from "../scripts/inject_tv_show.js";
import { ingestPerson } from "../scripts/inject_person.js";
import { dedupIngest } from "../lib/ingestionQueue.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;
const ALLOWED_TYPES = new Set(["movie", "show", "person"]);
const ALLOWED_KEYS = new Set(["type", "tmdbId"]);

// Validate inject input and trigger background database ingestion by type.
router.post("/", (req, res) => {
  const body = req.body ?? {};
  const extraKeys = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: `Unknown fields: ${extraKeys.join(", ")}` });
  }

  const { type, tmdbId: rawId } = body;
  const tmdbId = Number(rawId);

  if (!ALLOWED_TYPES.has(type) || !Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId > 9_999_999) {
    return res.status(400).json({ error: "type must be movie|show|person and tmdbId must be a positive integer" });
  }
  if (!TMDB_API_KEY) return res.status(503).json({ error: "Service unavailable" });

  res.json({ ok: true });

  if (type === "movie") {
    // Queue movie ingestion that writes/updates local database records.
    dedupIngest(`movie:${tmdbId}`, () =>
      ingestMovie({ tmdbId, apiKey: TMDB_API_KEY })
    ).catch((e) => console.warn(`inject movie tmdb_id=${tmdbId}:`, e.message));
  } else if (type === "show") {
    // Queue show ingestion that writes/updates local database records.
    dedupIngest(`show:${tmdbId}`, () =>
      ingestTvShow({ tmdbTvId: tmdbId, apiKey: TMDB_API_KEY })
    ).catch((e) => console.warn(`inject show tmdb_id=${tmdbId}:`, e.message));
  } else if (type === "person") {
    // Queue person ingestion that writes/updates local database records.
    dedupIngest(`person:${tmdbId}`, () =>
      ingestPerson({ tmdbId, apiKey: TMDB_API_KEY })
    ).catch((e) => console.warn(`inject person tmdb_id=${tmdbId}:`, e.message));
  }
});

export default router;
