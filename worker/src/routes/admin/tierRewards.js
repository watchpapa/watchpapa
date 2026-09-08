import { Hono } from "hono";
import { withSql } from "../../db.js";
import { auditLog, setAudit } from "../../audit.js";

// Bulk tier rewards — grant a higher plan (premium / pro / pro_plus) to every
// active user or a hand-picked set, in one action, with an optional message.
// apply_tier_upgrade() (migration 005) does the subscription write; it is
// upgrade-only, so a user already on an equal/higher effective tier is skipped.
// Each genuine recipient gets a public.tier_reward row — the ledger the frontend
// reads for the one-time popup — and, via that table's AFTER INSERT trigger, a
// notification-bell entry.

export const tierRewards = new Hono();

const ALLOWED_TIERS = new Set(["premium", "pro", "pro_plus"]);
const MAX_MESSAGE = 280;
const MAX_SELECTED = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pure request validator — returns { error } or the normalized shape.
export function validateIssueBody(body) {
  const b = body ?? {};

  if (!ALLOWED_TIERS.has(b.tier)) return { error: "tier must be premium, pro, or pro_plus" };

  let days = null;
  if (b.durationDays !== null && b.durationDays !== undefined && b.durationDays !== "") {
    const d = Number.parseInt(b.durationDays, 10);
    if (!Number.isInteger(d) || d < 1) return { error: "durationDays must be a positive integer or null" };
    days = d;
  }

  let message = null;
  if (b.message !== null && b.message !== undefined && b.message !== "") {
    if (typeof b.message !== "string") return { error: "message must be a string" };
    const m = b.message.trim();
    if (m.length > MAX_MESSAGE) return { error: `message must be ${MAX_MESSAGE} characters or fewer` };
    message = m || null;
  }

  if (b.target !== "all" && b.target !== "selected") return { error: "target must be 'all' or 'selected'" };

  let userIds = null;
  if (b.target === "selected") {
    if (!Array.isArray(b.userIds) || b.userIds.length === 0) {
      return { error: "userIds must be a non-empty array when target is 'selected'" };
    }
    const deduped = [...new Set(b.userIds.map((x) => String(x).trim().toLowerCase()))];
    if (deduped.some((id) => !UUID_RE.test(id))) return { error: "userIds must all be UUIDs" };
    if (deduped.length > MAX_SELECTED) return { error: `cannot reward more than ${MAX_SELECTED} users at once` };
    userIds = deduped;
  }

  return { tier: b.tier, days, message, target: b.target, userIds };
}

// GET /api/admin/tier-rewards — recent reward batches (history table).
tierRewards.get("/", async (c) =>
  withSql(c, async (sql) => {
    const batches = await sql`
      SELECT tr.batch_id, tr.tier, tr.duration_days, tr.message, tr.granted_by,
             gb.username AS granted_by_username,
             MIN(tr.created_at)              AS created_at,
             COUNT(*)::int                   AS recipients,
             COUNT(tr.acknowledged_at)::int  AS acknowledged
      FROM public.tier_reward tr
      LEFT JOIN public.profile gb ON gb.id = tr.granted_by
      GROUP BY tr.batch_id, tr.tier, tr.duration_days, tr.message, tr.granted_by, gb.username
      ORDER BY MIN(tr.created_at) DESC
      LIMIT 50
    `;
    return c.json({ batches });
  }),
);

// GET /api/admin/tier-rewards/eligible-count?tier=pro — how many active users
// would actually be upgraded (effective rank < the target tier). Feeds the
// "All users" confirmation dialog.
tierRewards.get("/eligible-count", async (c) => {
  const tier = c.req.query("tier");
  if (!ALLOWED_TIERS.has(tier)) return c.json({ error: "tier must be premium, pro, or pro_plus" }, 400);
  return withSql(c, async (sql) => {
    const [row] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE public._tier_rank(public.get_effective_tier(p.id)) < public._tier_rank(${tier})
        )::int AS eligible
      FROM public.profile p
      WHERE p.deleted_at IS NULL
    `;
    return c.json(row);
  });
});

// POST /api/admin/tier-rewards — issue a reward batch.
tierRewards.post("/", auditLog("admin_tier_reward", ["tier", "durationDays", "target"]), async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }

  const v = validateIssueBody(payload);
  if (v.error) return c.json({ error: v.error }, 400);
  const { tier, days, message, target, userIds } = v;

  const adminId = c.get("user").id;
  const batchId = crypto.randomUUID();
  const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString();
  const requested = userIds ? userIds.length : null;

  return withSql(c, async (sql) => {
    const granted = await sql.begin(async (tx) => {
      const recipients =
        target === "all"
          ? await tx`
              SELECT p.id FROM public.profile p
              WHERE p.deleted_at IS NULL
                AND p.id <> ${adminId}::uuid
                AND public._tier_rank(public.get_effective_tier(p.id)) < public._tier_rank(${tier})
            `
          : await tx`
              SELECT p.id FROM public.profile p
              WHERE p.deleted_at IS NULL
                AND p.id <> ${adminId}::uuid
                AND p.id = ANY(${userIds}::uuid[])
                AND public._tier_rank(public.get_effective_tier(p.id)) < public._tier_rank(${tier})
            `;

      const ids = recipients.map((r) => r.id);
      if (ids.length === 0) return 0;

      // Apply the upgrade to every recipient in-DB (one round trip).
      await tx`
        SELECT public.apply_tier_upgrade(t.id, ${tier}, ${days}, 'admin')
        FROM unnest(${ids}::uuid[]) AS t(id)
      `;

      // Record the ledger rows; the AFTER INSERT trigger fans out the bell
      // notifications.
      await tx`
        INSERT INTO public.tier_reward
          (profile_id, batch_id, tier, duration_days, expires_at, message, granted_by)
        SELECT t.id, ${batchId}::uuid, ${tier}, ${days}, ${expiresAt}, ${message}, ${adminId}::uuid
        FROM unnest(${ids}::uuid[]) AS t(id)
      `;

      return ids.length;
    });

    setAudit(c, { extra: { batchId, granted, target, requested, tier, durationDays: days } });
    return c.json({
      ok: true,
      batchId,
      granted,
      skipped: requested === null ? null : requested - granted,
    });
  });
});
