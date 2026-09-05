import { Hono } from "hono";
import { withSql } from "../../db.js";
import { auditLog, setAudit } from "../../audit.js";

// Port of Backend/src/routes/admin/users.js (queries the auth schema — works over
// Hyperdrive since it's the same DB role the droplet used).

export const users = new Hono();

const ALLOWED_TIERS = new Set(["premium", "pro", "pro_plus"]);
const ALL_ADMIN_TIERS = new Set(["free", "premium", "pro", "pro_plus", "god"]);

function parseDays(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = Number.parseInt(v, 10);
  return Number.isInteger(d) && d >= 1 ? d : NaN;
}

users.get("/search", async (c) => {
  const query = (c.req.query("email") ?? "").trim();
  if (query.length < 2) return c.json({ error: "Provide at least 2 characters" }, 400);
  return withSql(c, async (sql) => {
    const rows = await sql`
      SELECT au.id, au.email, au.created_at, p.username, p.role,
             us.tier, us.source, us.is_early_adopter, us.expires_at
      FROM auth.users au
      LEFT JOIN public.profile p ON p.id = au.id
      LEFT JOIN public.user_subscriptions us ON us.profile_id = au.id
      WHERE (au.email ILIKE ${"%" + query + "%"} OR p.username ILIKE ${"%" + query + "%"})
        AND p.deleted_at IS NULL
      ORDER BY au.created_at DESC
      LIMIT 20
    `;
    return c.json({ users: rows });
  });
});

users.get("/staff", async (c) =>
  withSql(c, async (sql) => {
    const rows = await sql`
      SELECT au.id, au.email, au.created_at, p.username, p.role
      FROM public.profile p
      JOIN auth.users au ON au.id = p.id
      WHERE p.role IN (3, 4) AND p.deleted_at IS NULL
      ORDER BY p.role DESC, au.created_at ASC
    `;
    return c.json({ staff: rows });
  }),
);

users.patch("/:id/role", auditLog("admin_role_set", ["role"]), async (c) => {
  const id = c.req.param("id");
  setAudit(c, { targetUserId: id });
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const role = payload?.role;
  if (![0, 3, 4].includes(role)) return c.json({ error: "role must be 0, 3, or 4" }, 400);
  if (id === c.get("user").id) return c.json({ error: "Cannot modify your own role" }, 400);

  return withSql(c, async (sql) => {
    const [profile] = await sql`SELECT id FROM public.profile WHERE id = ${id} AND deleted_at IS NULL`;
    if (!profile) return c.json({ error: "User not found" }, 404);
    await sql`UPDATE public.profile SET role = ${role}, updated_at = now() WHERE id = ${id}`;
    return c.json({ ok: true });
  });
});

users.post("/:id/grant-tier", auditLog("admin_tier_granted", ["tier", "durationDays"]), async (c) => {
  const id = c.req.param("id");
  setAudit(c, { targetUserId: id });
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const { tier, durationDays } = payload ?? {};
  if (!ALLOWED_TIERS.has(tier)) {
    return c.json({ error: `tier must be one of: ${[...ALLOWED_TIERS].join(", ")}` }, 400);
  }
  const days = parseDays(durationDays);
  if (Number.isNaN(days)) return c.json({ error: "durationDays must be a positive integer or null" }, 400);

  return withSql(c, async (sql) => {
    const [profile] = await sql`SELECT id FROM public.profile WHERE id = ${id} AND deleted_at IS NULL`;
    if (!profile) return c.json({ error: "User not found" }, 404);
    await sql`SELECT public.apply_tier_upgrade(${id}::uuid, ${tier}, ${days}, 'admin')`;
    return c.json({ ok: true });
  });
});

users.patch("/:id/tier", auditLog("admin_tier_set", ["tier", "durationDays"]), async (c) => {
  const id = c.req.param("id");
  setAudit(c, { targetUserId: id });
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const { tier, durationDays } = payload ?? {};
  if (!ALL_ADMIN_TIERS.has(tier)) {
    return c.json({ error: `tier must be one of: ${[...ALL_ADMIN_TIERS].join(", ")}` }, 400);
  }
  if (id === c.get("user").id) return c.json({ error: "Cannot modify your own tier" }, 400);

  return withSql(c, async (sql) => {
    const [profile] = await sql`SELECT id FROM public.profile WHERE id = ${id} AND deleted_at IS NULL`;
    if (!profile) return c.json({ error: "User not found" }, 404);

    if (tier === "free") {
      await sql`DELETE FROM public.user_subscriptions WHERE profile_id = ${id}`;
      return c.json({ ok: true });
    }

    const days = parseDays(durationDays);
    if (Number.isNaN(days)) return c.json({ error: "durationDays must be a positive integer or null" }, 400);

    if (days !== null) {
      await sql`
        INSERT INTO public.user_subscriptions (profile_id, tier, source, expires_at, updated_at)
        VALUES (${id}, ${tier}, 'admin', now() + (${String(days)} || ' days')::interval, now())
        ON CONFLICT (profile_id) DO UPDATE
          SET tier = EXCLUDED.tier, source = EXCLUDED.source, expires_at = EXCLUDED.expires_at, updated_at = now()
      `;
    } else {
      await sql`
        INSERT INTO public.user_subscriptions (profile_id, tier, source, expires_at, updated_at)
        VALUES (${id}, ${tier}, 'admin', NULL, now())
        ON CONFLICT (profile_id) DO UPDATE
          SET tier = EXCLUDED.tier, source = EXCLUDED.source, expires_at = NULL, updated_at = now()
      `;
    }
    return c.json({ ok: true });
  });
});
