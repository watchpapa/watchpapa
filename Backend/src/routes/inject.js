import { Router } from "express";
import { ingestMovie } from "../scripts/inject_movie.js";
import { ingestTvShow } from "../scripts/inject_tv_show.js";
import { ingestPerson } from "../scripts/inject_person.js";
import { dedupIngest } from "../lib/ingestionQueue.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;

router.post("/", (req, res) => {
  const { type, tmdbId } = req.body ?? {};
  res.json({ ok: true });

  if (!type || !tmdbId || !TMDB_API_KEY) return;

  if (type === "movie") {
    dedupIngest(`movie:${tmdbId}`, () =>
      ingestMovie({ tmdbId, apiKey: TMDB_API_KEY })
    ).catch((e) => console.warn(`inject movie tmdb_id=${tmdbId}:`, e.message));
  } else if (type === "show") {
    dedupIngest(`show:${tmdbId}`, () =>
      ingestTvShow({ tmdbTvId: tmdbId, apiKey: TMDB_API_KEY })
    ).catch((e) => console.warn(`inject show tmdb_id=${tmdbId}:`, e.message));
  } else if (type === "person") {
    dedupIngest(`person:${tmdbId}`, () =>
      ingestPerson({ tmdbId, apiKey: TMDB_API_KEY })
    ).catch((e) => console.warn(`inject person tmdb_id=${tmdbId}:`, e.message));
  }
});

export default router;
