import { Hono } from "hono";
import { withSql } from "../../db.js";

export const referrals = new Hono();

referrals.get("/leaderboard", async (c) =>
  withSql(c, async (sql) => {
    const [summaryRows, leaderboard] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int                                     AS total,
          COUNT(*) FILTER (WHERE status = 'rewarded')::int  AS rewarded,
          COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending,
          COUNT(*) FILTER (WHERE status = 'expired')::int   AS expired
        FROM public.referrals
      `,
      sql`
        SELECT
          r.referrer_id, au.email, p.username,
          COUNT(*)::int                                    AS total,
          COUNT(*) FILTER (WHERE r.status = 'rewarded')::int AS rewarded,
          COUNT(*) FILTER (WHERE r.status = 'pending')::int  AS pending,
          COUNT(*) FILTER (WHERE r.status = 'expired')::int  AS expired
        FROM public.referrals r
        LEFT JOIN auth.users au ON au.id = r.referrer_id
        LEFT JOIN public.profile p ON p.id = r.referrer_id
        GROUP BY r.referrer_id, au.email, p.username
        ORDER BY rewarded DESC, total DESC
        LIMIT 100
      `,
    ]);
    return c.json({ summary: summaryRows[0], leaderboard });
  }),
);
