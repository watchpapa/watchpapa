import { Hono } from "hono";
import { withSql } from "../../db.js";

export const auditLog = new Hono();

const ALLOWED_ACTIONS = new Set([
  "inject", "resolve", "referral", "rewards",
  "follow_movie", "unfollow_movie", "follow_show", "unfollow_show",
]);

// GET /api/admin/audit-log?page=&limit=&action=&email=&from=&to=
auditLog.get("/", async (c) => {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10) || 50));
  const offset = (page - 1) * limit;

  const action = c.req.query("action") ?? "";
  const email = (c.req.query("email") ?? "").trim();
  const from = c.req.query("from") || null;
  const to = c.req.query("to") || null;

  return withSql(c, async (sql) => {
    // Build the shared WHERE with postgres.js fragments.
    const conds = [];
    if (action && ALLOWED_ACTIONS.has(action)) conds.push(sql`ae.action = ${action}`);
    if (email.length >= 2) conds.push(sql`ae.email ILIKE ${"%" + email + "%"}`);
    if (from) conds.push(sql`ae.created_at >= ${from}`);
    if (to) conds.push(sql`ae.created_at <= ${to}`);
    const where = conds.length
      ? conds.reduce((acc, cur, i) => (i === 0 ? sql`WHERE ${cur}` : sql`${acc} AND ${cur}`), sql``)
      : sql``;

    const [events, [count]] = await Promise.all([
      sql`
        SELECT ae.id, ae.created_at, ae.action, ae.user_id, ae.email,
               p.username, ae.ip, ae.method, ae.path, ae.body
        FROM public.audit_events ae
        LEFT JOIN public.profile p ON p.id = ae.user_id
        ${where}
        ORDER BY ae.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM public.audit_events ae
        LEFT JOIN public.profile p ON p.id = ae.user_id
        ${where}
      `,
    ]);

    return c.json({ events, total: count.total, page, limit });
  });
});
