// Used by:
// - app.js
import { Router } from "express";
import { searchTmdb } from "../services/searchService.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;

// Validate query text and return search results for local DB/TMDB resolution flows.
router.get("/", async (req, res) => {
  const q = (req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ results: [] });
  if (q.length > 100) return res.status(400).json({ error: "Query too long" });

  const includeAdult = req.query.includeAdult === "true";

  try {
    // Fetch candidate entities that clients can map to local database records.
    const items = await searchTmdb(q, TMDB_API_KEY, { includeAdult });
    res.json({
      results: items.map(({ source: _s, ...rest }) => rest),
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
