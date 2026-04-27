import { Router } from "express";
import {
  searchLocal,
  searchTmdb,
  fastUpsertMovie,
  fastUpsertShow,
  fastUpsertPerson,
  mergeResults,
} from "../services/searchService.js";
import { ingestMovie } from "../scripts/inject_movie.js";
import { ingestTvShow } from "../scripts/inject_tv_show.js";
import { ingestPerson } from "../scripts/inject_person.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;

router.get("/", async (req, res) => {
  const q = (req.query.q ?? "").trim();
  const rawLimit = parseInt(req.query.limit ?? "15", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 15;
  const rawLocalPerType = parseInt(req.query.localPerType ?? "5", 10);
  const localPerType =
    Number.isFinite(rawLocalPerType) && rawLocalPerType > 0
      ? Math.min(rawLocalPerType, 25)
      : 5;

  if (q.length < 2) return res.json({ results: [] });
  if (q.length > 100) return res.status(400).json({ error: "Query too long" });

  try {
    const [localResults, tmdbResults] = await Promise.all([
      searchLocal(q, localPerType),
      searchTmdb(q, TMDB_API_KEY),
    ]);

    const merged = mergeResults(localResults, tmdbResults);

    const resolved = await Promise.all(
      merged.map(async (item) => {
        if (item.source !== "tmdb-only") return item;

        let row;
        try {
          if (item.type === "movie") {
            row = await fastUpsertMovie(item);
            ingestMovie({ tmdbId: item.tmdbId, apiKey: TMDB_API_KEY }).catch((e) =>
              console.warn(`bg ingestMovie tmdb_id=${item.tmdbId}:`, e.message)
            );
          } else if (item.type === "show") {
            row = await fastUpsertShow(item);
            ingestTvShow({ tmdbTvId: item.tmdbId, apiKey: TMDB_API_KEY }).catch((e) =>
              console.warn(`bg ingestTvShow tmdb_id=${item.tmdbId}:`, e.message)
            );
          } else {
            row = await fastUpsertPerson(item);
            ingestPerson({ tmdbId: item.tmdbId, apiKey: TMDB_API_KEY }).catch((e) =>
              console.warn(`bg ingestPerson tmdb_id=${item.tmdbId}:`, e.message)
            );
          }
        } catch (err) {
          console.error(`Fast upsert failed tmdb_id=${item.tmdbId}:`, err.message);
          return null;
        }

        return { ...item, localId: row.id };
      })
    );

    const results = resolved
      .filter(Boolean)
      .slice(0, limit)
      .map(({ source: _s, originalTitle: _ot, originalName: _on, overview: _ov,
               releaseDate: _rd, firstAirDate: _fd, originalLanguage: _ol,
               tmdbVoteAvg: _va, tmdbVoteCount: _vc, ...rest }) => rest);

    res.json({ results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
