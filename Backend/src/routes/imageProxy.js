import express from "express";

const router = express.Router();

const VALID_SIZES = new Set(["w92","w154","w185","w342","w500","w780","original"]);
// TMDB poster paths look like /abc123XYZ.jpg — only safe chars allowed
const SAFE_PATH = /^\/[a-zA-Z0-9/_.-]+\.(jpg|jpeg|png|webp)$/;

router.get("/", async (req, res) => {
  const { path: posterPath, size = "w342" } = req.query;

  if (!posterPath || !SAFE_PATH.test(posterPath) || !VALID_SIZES.has(size)) {
    return res.status(400).end();
  }

  try {
    const upstream = await fetch(`https://image.tmdb.org/t/p/${size}${posterPath}`);
    if (!upstream.ok) return res.status(upstream.status).end();

    const contentType = upstream.headers.get("Content-Type") || "image/jpeg";
    // Cache aggressively — TMDB poster paths are content-addressed
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");

    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

export default router;
