import { Router } from "express";
import sequelize from "../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

// GET /api/posters — public, no auth required
router.get("/", async (req, res) => {
  const [movies, shows] = await Promise.all([
    sequelize.query(
      `SELECT poster_path FROM public.movie WHERE poster_path IS NOT NULL ORDER BY tmdb_popularity DESC NULLS LAST LIMIT 40`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT poster_path FROM public.show WHERE poster_path IS NOT NULL ORDER BY tmdb_popularity DESC NULLS LAST LIMIT 40`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  const paths = [
    ...movies.map((m) => m.poster_path),
    ...shows.map((s) => s.poster_path),
  ];

  res.json({ paths });
});

export default router;
