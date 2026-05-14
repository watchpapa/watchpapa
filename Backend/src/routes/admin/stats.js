import { Router } from "express";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

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

export default router;
