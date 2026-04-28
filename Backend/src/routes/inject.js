import { Router } from "express";
import { ingestMovie } from "../scripts/inject_movie.js";
import { ingestTvShow } from "../scripts/inject_tv_show.js";
import { ingestPerson } from "../scripts/inject_person.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;

router.post("/", (req, res) => {
  const { type, tmdbId } = req.body ?? {};
  res.json({ ok: true });

  if (!type || !tmdbId || !TMDB_API_KEY) return;

  if (type === "movie") {
    ingestMovie({ tmdbId, apiKey: TMDB_API_KEY }).catch((e) =>
      console.warn(`inject movie tmdb_id=${tmdbId}:`, e.message)
    );
  } else if (type === "show") {
    ingestTvShow({ tmdbTvId: tmdbId, apiKey: TMDB_API_KEY }).catch((e) =>
      console.warn(`inject show tmdb_id=${tmdbId}:`, e.message)
    );
  } else if (type === "person") {
    ingestPerson({ tmdbId, apiKey: TMDB_API_KEY }).catch((e) =>
      console.warn(`inject person tmdb_id=${tmdbId}:`, e.message)
    );
  }
});

export default router;
