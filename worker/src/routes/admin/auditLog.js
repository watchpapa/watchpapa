import { Hono } from "hono";
import { withSql } from "../../db.js";
import { ACTION_GROUPS, ACTION_SET, AUDIT_ACTIONS, SOURCES } from "../../auditActions.js";

export const auditLog = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Supabase Auth's own event names (auth.audit_log_entries.payload->>'action').
const AUTH_ACTIONS = [
  "login", "logout", "user_signedup", "user_confirmation_requested", "user_repeated_signup",
  "user_recovery_requested", "user_updated_password", "user_modified", "user_deleted",
  "token_refreshed", "token_revoked",
];

function paging(c) {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

function whereOf(sql, conds) {
  return conds.length ? conds.reduce((acc, cur, i) => (i === 0 ? sql`WHERE ${cur}` : sql`${acc} AND ${cur}`), sql``) : sql``;
}

// GET /api/admin/audit-log/actions — the registry, for the UI's filter + colours.
auditLog.get("/actions", (c) => c.json({ groups: ACTION_GROUPS, actions: AUDIT_ACTIONS, sources: SOURCES, authActions: AUTH_ACTIONS }));

// GET /api/admin/audit-log?page&limit&action&email&user_id&target_user_id&path&source&from&to
auditLog.get("/", async (c) => {
  const { page, limit, offset } = paging(c);
  const action = c.req.query("action") ?? "";
  const email = (c.req.query("email") ?? "").trim();
  const userId = (c.req.query("user_id") ?? "").trim();
  const targetUserId = (c.req.query("target_user_id") ?? "").trim();
  const path = (c.req.query("path") ?? "").trim();
  const source = c.req.query("source") ?? "";
  const from = c.req.query("from") || null;
  const to = c.req.query("to") || null;

  if (action && !ACTION_SET.has(action)) return c.json({ error: `Unknown action "${action}"` }, 400);
  if (source && !SOURCES.includes(source)) return c.json({ error: `Unknown source "${source}"` }, 400);
  if (userId && !UUID_RE.test(userId)) return c.json({ error: "user_id must be a UUID" }, 400);
  if (targetUserId && !UUID_RE.test(targetUserId)) return c.json({ error: "target_user_id must be a UUID" }, 400);

  return withSql(c, async (sql) => {
    const conds = [];
    if (action) conds.push(sql`ae.action = ${action}`);
    if (email.length >= 2) conds.push(sql`(ae.email ILIKE ${"%" + email + "%"} OR p.username ILIKE ${"%" + email + "%"})`);
    if (userId) conds.push(sql`(ae.user_id = ${userId}::uuid OR ae.target_user_id = ${userId}::uuid)`);
    if (targetUserId) conds.push(sql`ae.target_user_id = ${targetUserId}::uuid`);
    if (path.length >= 2) conds.push(sql`ae.path ILIKE ${"%" + path + "%"}`);
    if (source) conds.push(sql`ae.source = ${source}`);
    if (from) conds.push(sql`ae.created_at >= ${from}`);
    if (to) conds.push(sql`ae.created_at <= ${to}`);
    const where = whereOf(sql, conds);

    const [events, [count]] = await Promise.all([
      sql`
        SELECT ae.id, ae.created_at, ae.action, ae.source, ae.status, ae.user_id, ae.email,
               p.username, ae.target_user_id, tp.username AS target_username,
               ae.ip, ae.method, ae.path, ae.body
        FROM public.audit_events ae
        LEFT JOIN public.profile p  ON p.id  = ae.user_id
        LEFT JOIN public.profile tp ON tp.id = ae.target_user_id
        ${where}
        ORDER BY ae.created_at DESC, ae.id DESC
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

// GET /api/admin/audit-log/auth?page&limit&action&email&from&to
// Read-only view of Supabase Auth's own log (sign-in/out, password recovery,
// OAuth, token refresh, deletions). Nothing here is written by us.
auditLog.get("/auth", async (c) => {
  const { page, limit, offset } = paging(c);
  const action = c.req.query("action") ?? "";
  const email = (c.req.query("email") ?? "").trim();
  const from = c.req.query("from") || null;
  const to = c.req.query("to") || null;
  if (action && !AUTH_ACTIONS.includes(action)) return c.json({ error: `Unknown auth action "${action}"` }, 400);

  return withSql(c, async (sql) => {
    const conds = [];
    if (action) conds.push(sql`(a.payload->>'action') = ${action}`);
    if (email.length >= 2) conds.push(sql`(a.payload->>'actor_username') ILIKE ${"%" + email + "%"}`);
    if (from) conds.push(sql`a.created_at >= ${from}`);
    if (to) conds.push(sql`a.created_at <= ${to}`);
    const where = whereOf(sql, conds);

    const [events, [count]] = await Promise.all([
      sql`
        SELECT a.id, a.created_at, a.ip_address AS ip,
               a.payload->>'action'         AS action,
               a.payload->>'log_type'       AS log_type,
               a.payload->>'actor_id'       AS user_id,
               a.payload->>'actor_username' AS email,
               a.payload->>'provider'       AS provider,
               (a.payload->>'actor_via_sso')::boolean AS via_sso,
               p.username
        FROM auth.audit_log_entries a
        LEFT JOIN public.profile p ON p.id::text = a.payload->>'actor_id'
        ${where}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*)::int AS total FROM auth.audit_log_entries a ${where}`,
    ]);
    return c.json({ events, total: count.total, page, limit });
  });
});
