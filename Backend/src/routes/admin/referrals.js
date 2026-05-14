import { Router } from "express";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

// GET /api/admin/referrals/leaderboard
router.get("/leaderboard", async (_req, res) => {
  const [summary, leaderboard] = await Promise.all([
    sequelize.query(
      `SELECT
         COUNT(*)                                          AS total,
         COUNT(*) FILTER (WHERE status = 'rewarded')      AS rewarded,
         COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
         COUNT(*) FILTER (WHERE status = 'expired')       AS expired
       FROM public.referrals`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT
         r.referrer_id,
         au.email,
         p.username,
         COUNT(*)                                          AS total,
         COUNT(*) FILTER (WHERE r.status = 'rewarded')    AS rewarded,
         COUNT(*) FILTER (WHERE r.status = 'pending')     AS pending,
         COUNT(*) FILTER (WHERE r.status = 'expired')     AS expired
       FROM public.referrals r
       LEFT JOIN auth.users au ON au.id = r.referrer_id
       LEFT JOIN public.profile p ON p.id = r.referrer_id
       GROUP BY r.referrer_id, au.email, p.username
       ORDER BY rewarded DESC, total DESC
       LIMIT 100`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  const s = summary[0];
  res.json({
    summary: {
      total:    parseInt(s.total, 10),
      rewarded: parseInt(s.rewarded, 10),
      pending:  parseInt(s.pending, 10),
      expired:  parseInt(s.expired, 10),
    },
    leaderboard: leaderboard.map((r) => ({
      referrer_id: r.referrer_id,
      email:    r.email,
      username: r.username,
      total:    parseInt(r.total, 10),
      rewarded: parseInt(r.rewarded, 10),
      pending:  parseInt(r.pending, 10),
      expired:  parseInt(r.expired, 10),
    })),
  });
});

export default router;
