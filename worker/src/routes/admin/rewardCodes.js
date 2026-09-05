import { Hono } from "hono";
import { withSql } from "../../db.js";
import { toCsv } from "../../lib/csv.js";
import { auditLog, setAudit } from "../../audit.js";

// Port of Backend/src/routes/admin/rewardCodes.js. randomBytes → crypto.getRandomValues.

export const rewardCodes = new Hono();

const ALLOWED_TIERS = new Set(["premium", "pro", "pro_plus"]);

const COMPUTED_STATUS = (sql) => sql`
  CASE
    WHEN is_active = false THEN 'inactive'
    WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'expired'
    WHEN max_uses IS NOT NULL AND current_uses >= max_uses THEN 'depleted'
    ELSE 'active'
  END AS status
`;

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/[+/=]/g, "").toUpperCase().slice(0, 8);
}

function statusWhere(sql, filter) {
  switch (filter) {
    case "active":
      return sql`WHERE is_active = true AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR current_uses < max_uses)`;
    case "expired":
      return sql`WHERE expires_at IS NOT NULL AND expires_at <= now()`;
    case "depleted":
      return sql`WHERE max_uses IS NOT NULL AND current_uses >= max_uses`;
    case "inactive":
      return sql`WHERE is_active = false`;
    default:
      return sql``;
  }
}

function validateOptions({ durationDays, maxUses, expiresAt }, { allowPastExpiry = false } = {}) {
  if (durationDays != null) {
    const d = Number.parseInt(durationDays, 10);
    if (!Number.isInteger(d) || d < 1) return "durationDays must be a positive integer or null";
  }
  if (maxUses != null) {
    const m = Number.parseInt(maxUses, 10);
    if (!Number.isInteger(m) || m < 1) return "maxUses must be a positive integer or null";
  }
  if (expiresAt != null) {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return "expiresAt must be a valid date or null";
    if (!allowPastExpiry && d <= new Date()) return "expiresAt must be a valid future date or null";
  }
  return null;
}

rewardCodes.get("/", async (c) => {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10) || 50));
  const offset = (page - 1) * limit;
  const filter = c.req.query("status") ?? "all";

  return withSql(c, async (sql) => {
    const where = statusWhere(sql, filter);
    const [codes, [count]] = await Promise.all([
      sql`
        SELECT id, code, tier, duration_days, max_uses, current_uses, expires_at, is_active, created_at, ${COMPUTED_STATUS(sql)}
        FROM public.reward_codes ${where}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*)::int AS total FROM public.reward_codes ${where}`,
    ]);
    return c.json({ codes, total: count.total, page, limit });
  });
});

rewardCodes.post("/generate", auditLog("reward_code_generated", ["count", "tier", "durationDays", "maxUses", "expiresAt"]), async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const { count, tier, durationDays, maxUses, expiresAt } = payload ?? {};
  const parsedCount = Number.parseInt(count, 10);
  if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 1000) {
    return c.json({ error: "count must be an integer between 1 and 1000" }, 400);
  }
  if (!ALLOWED_TIERS.has(tier)) return c.json({ error: "tier must be premium, pro, or pro_plus" }, 400);
  const optErr = validateOptions({ durationDays, maxUses, expiresAt });
  if (optErr) return c.json({ error: optErr }, 400);

  const codes = new Set();
  while (codes.size < parsedCount) codes.add(generateCode());

  return withSql(c, async (sql) => {
    try {
      const inserted = await sql.begin(async (tx) => {
        const out = [];
        for (const base of codes) {
          let code = base;
          // Resolve the rare collision by regenerating.
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const rows = await tx`
              INSERT INTO public.reward_codes (code, tier, duration_days, max_uses, expires_at)
              VALUES (${code}, ${tier}, ${durationDays ?? null}, ${maxUses ?? null}, ${expiresAt ?? null})
              ON CONFLICT (code) DO NOTHING
              RETURNING id, code, tier, duration_days, max_uses, expires_at, is_active, created_at
            `;
            if (rows.length > 0) {
              out.push(rows[0]);
              break;
            }
            code = generateCode();
          }
        }
        return out;
      });
      setAudit(c, { extra: { generated: inserted.length } });
      return c.json({ ok: true, codes: inserted });
    } catch (e) {
      console.error("generate reward codes failed:", e?.message);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
});

rewardCodes.get("/export", async (c) => {
  const filter = c.req.query("status") ?? "all";
  return withSql(c, async (sql) => {
    const codes = await sql`
      SELECT code, tier, duration_days, max_uses, current_uses, expires_at, is_active, ${COMPUTED_STATUS(sql)}, created_at
      FROM public.reward_codes ${statusWhere(sql, filter)}
      ORDER BY created_at DESC
    `;
    const csv = toCsv(
      ["code", "tier", "duration_days", "max_uses", "current_uses", "expires_at", "is_active", "status", "created_at"],
      codes.map((x) => [
        x.code, x.tier, x.duration_days ?? "", x.max_uses ?? "", x.current_uses,
        x.expires_at ?? "", x.is_active, x.status, x.created_at,
      ]),
    );
    const date = new Date().toISOString().slice(0, 10);
    return c.body(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="reward-codes-${date}.csv"`,
    });
  });
});

rewardCodes.post("/bulk", auditLog("reward_code_bulk", ["action"]), async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const { action, ids } = payload ?? {};
  if (!["enable", "disable", "delete"].includes(action)) {
    return c.json({ error: "action must be enable, disable, or delete" }, 400);
  }
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: "ids must be a non-empty array" }, 400);
  const validIds = ids.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length !== ids.length) return c.json({ error: "All ids must be positive integers" }, 400);
  if (validIds.length > 500) return c.json({ error: "Cannot act on more than 500 codes at once" }, 400);
  setAudit(c, { extra: { count: validIds.length } });

  return withSql(c, async (sql) => {
    if (action === "enable") {
      await sql`UPDATE public.reward_codes SET is_active = true WHERE id = ANY(${validIds})`;
    } else if (action === "disable") {
      await sql`UPDATE public.reward_codes SET is_active = false WHERE id = ANY(${validIds})`;
    } else {
      const claimed = await sql`
        SELECT rc.code FROM public.reward_codes rc
        WHERE rc.id = ANY(${validIds})
          AND EXISTS (SELECT 1 FROM public.reward_code_claims rcc WHERE rcc.code_id = rc.id)
      `;
      if (claimed.length > 0) {
        return c.json(
          { error: `Some codes have claims and cannot be deleted: ${claimed.map((x) => x.code).join(", ")}. Disable them instead.` },
          409,
        );
      }
      await sql`DELETE FROM public.reward_codes WHERE id = ANY(${validIds})`;
    }
    return c.json({ ok: true, count: validIds.length });
  });
});

rewardCodes.get("/:id/claims", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id) || id < 1) return c.json({ error: "Invalid code id" }, 400);
  return withSql(c, async (sql) => {
    const [code] = await sql`SELECT id FROM public.reward_codes WHERE id = ${id}`;
    if (!code) return c.json({ error: "Code not found" }, 404);
    const claims = await sql`
      SELECT rcc.profile_id, p.username, rcc.claimed_at
      FROM public.reward_code_claims rcc
      JOIN public.profile p ON p.id = rcc.profile_id
      WHERE rcc.code_id = ${id}
      ORDER BY rcc.claimed_at DESC
    `;
    return c.json({ claims });
  });
});

rewardCodes.post("/", auditLog("reward_code_created", ["code", "tier", "durationDays", "maxUses", "expiresAt"]), async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const { code, tier, durationDays, maxUses, expiresAt } = payload ?? {};
  if (typeof code !== "string" || !/^[A-Z0-9]{2,32}$/.test(code.trim().toUpperCase())) {
    return c.json({ error: "code must be 2–32 uppercase alphanumeric characters" }, 400);
  }
  if (!ALLOWED_TIERS.has(tier)) return c.json({ error: "tier must be premium, pro, or pro_plus" }, 400);
  const optErr = validateOptions({ durationDays, maxUses, expiresAt });
  if (optErr) return c.json({ error: optErr }, 400);

  const normalized = code.trim().toUpperCase();
  return withSql(c, async (sql) => {
    const [existing] = await sql`SELECT id FROM public.reward_codes WHERE code = ${normalized}`;
    if (existing) return c.json({ error: "A code with that name already exists" }, 409);
    const [row] = await sql`
      INSERT INTO public.reward_codes (code, tier, duration_days, max_uses, expires_at)
      VALUES (${normalized}, ${tier}, ${durationDays ?? null}, ${maxUses ?? null}, ${expiresAt ?? null})
      RETURNING id, code, tier, duration_days, max_uses, expires_at, is_active, created_at
    `;
    return c.json({ ok: true, code: row }, 201);
  });
});

rewardCodes.patch("/:id", auditLog("reward_code_toggled", ["isActive"]), async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id) || id < 1) return c.json({ error: "Invalid code id" }, 400);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  if (typeof payload?.isActive !== "boolean") return c.json({ error: "isActive must be a boolean" }, 400);
  return withSql(c, async (sql) => {
    const [code] = await sql`SELECT id FROM public.reward_codes WHERE id = ${id}`;
    if (!code) return c.json({ error: "Code not found" }, 404);
    await sql`UPDATE public.reward_codes SET is_active = ${payload.isActive} WHERE id = ${id}`;
    return c.json({ ok: true });
  });
});

rewardCodes.put("/:id", auditLog("reward_code_updated", ["tier", "durationDays", "maxUses", "expiresAt", "isActive"]), async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id) || id < 1) return c.json({ error: "Invalid code id" }, 400);
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const { tier, durationDays, maxUses, expiresAt, isActive } = payload ?? {};
  if (!ALLOWED_TIERS.has(tier)) return c.json({ error: "tier must be premium, pro, or pro_plus" }, 400);
  const optErr = validateOptions({ durationDays, maxUses, expiresAt }, { allowPastExpiry: true });
  if (optErr) return c.json({ error: optErr }, 400);
  if (typeof isActive !== "boolean") return c.json({ error: "isActive must be a boolean" }, 400);

  return withSql(c, async (sql) => {
    const [code] = await sql`SELECT id FROM public.reward_codes WHERE id = ${id}`;
    if (!code) return c.json({ error: "Code not found" }, 404);
    await sql`
      UPDATE public.reward_codes
      SET tier = ${tier}, duration_days = ${durationDays ?? null}, max_uses = ${maxUses ?? null},
          expires_at = ${expiresAt ?? null}, is_active = ${isActive}
      WHERE id = ${id}
    `;
    return c.json({ ok: true });
  });
});

rewardCodes.delete("/:id", auditLog("reward_code_deleted"), async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (!Number.isInteger(id) || id < 1) return c.json({ error: "Invalid code id" }, 400);
  return withSql(c, async (sql) => {
    const [code] = await sql`SELECT id FROM public.reward_codes WHERE id = ${id}`;
    if (!code) return c.json({ error: "Code not found" }, 404);
    const [claimCount] = await sql`SELECT COUNT(*)::int AS total FROM public.reward_code_claims WHERE code_id = ${id}`;
    if (claimCount.total > 0) {
      return c.json({ error: `This code has ${claimCount.total} claim(s) — disable it instead of deleting.` }, 409);
    }
    await sql`DELETE FROM public.reward_codes WHERE id = ${id}`;
    return c.json({ ok: true });
  });
});
