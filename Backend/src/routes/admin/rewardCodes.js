import { Router } from "express";
import { randomBytes } from "crypto";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

const ALLOWED_TIERS = new Set(["premium", "pro", "pro_plus"]);

const COMPUTED_STATUS = `
  CASE
    WHEN is_active = false THEN 'inactive'
    WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'expired'
    WHEN max_uses IS NOT NULL AND current_uses >= max_uses THEN 'depleted'
    ELSE 'active'
  END AS status
`;

function generateCode() {
  return randomBytes(6).toString("base64").replace(/[+/=]/g, "").toUpperCase().slice(0, 8);
}

// GET /api/admin/reward-codes
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const statusFilter = req.query.status ?? "all";

  let whereClause = "";
  if (statusFilter === "active") {
    whereClause = `WHERE is_active = true AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR current_uses < max_uses)`;
  } else if (statusFilter === "expired") {
    whereClause = `WHERE expires_at IS NOT NULL AND expires_at <= now()`;
  } else if (statusFilter === "depleted") {
    whereClause = `WHERE max_uses IS NOT NULL AND current_uses >= max_uses`;
  } else if (statusFilter === "inactive") {
    whereClause = `WHERE is_active = false`;
  }

  const [codes, countResult] = await Promise.all([
    sequelize.query(
      `SELECT id, code, tier, duration_days, max_uses, current_uses, expires_at, is_active, created_at, ${COMPUTED_STATUS}
       FROM public.reward_codes ${whereClause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS total FROM public.reward_codes ${whereClause}`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  res.json({ codes, total: parseInt(countResult[0].total), page, limit });
});

// POST /api/admin/reward-codes/generate
router.post("/generate", async (req, res) => {
  const { count, tier, durationDays, maxUses, expiresAt } = req.body ?? {};

  const parsedCount = parseInt(count);
  if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 1000) {
    return res.status(400).json({ error: "count must be an integer between 1 and 1000" });
  }
  if (!ALLOWED_TIERS.has(tier)) {
    return res.status(400).json({ error: "tier must be premium, pro, or pro_plus" });
  }
  if (durationDays !== null && durationDays !== undefined) {
    const d = parseInt(durationDays);
    if (!Number.isInteger(d) || d < 1) {
      return res.status(400).json({ error: "durationDays must be a positive integer or null" });
    }
  }
  if (maxUses !== null && maxUses !== undefined) {
    const m = parseInt(maxUses);
    if (!Number.isInteger(m) || m < 1) {
      return res.status(400).json({ error: "maxUses must be a positive integer or null" });
    }
  }
  if (expiresAt !== null && expiresAt !== undefined) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime()) || d <= new Date()) {
      return res.status(400).json({ error: "expiresAt must be a valid future date or null" });
    }
  }

  // Build unique codes — retry if a collision happens.
  const codes = new Set();
  while (codes.size < parsedCount) {
    codes.add(generateCode());
  }

  const rows = Array.from(codes).map((code) => ({
    code,
    tier,
    duration_days: durationDays ?? null,
    max_uses: maxUses ?? null,
    expires_at: expiresAt ?? null,
  }));

  // Bulk insert in one round trip. ON CONFLICT on code retries the rare collision silently.
  const t = await sequelize.transaction();
  try {
    const inserted = [];
    for (const row of rows) {
      let insertCode = row.code;
      // Resolve the rare duplicate by regenerating.
      while (true) {
        const [result] = await sequelize.query(
          `INSERT INTO public.reward_codes (code, tier, duration_days, max_uses, expires_at)
           VALUES (:code, :tier, :duration_days, :max_uses, :expires_at)
           ON CONFLICT (code) DO NOTHING
           RETURNING id, code, tier, duration_days, max_uses, expires_at, is_active, created_at`,
          { replacements: { ...row, code: insertCode }, type: QueryTypes.INSERT, transaction: t }
        );
        if (result.length > 0) {
          inserted.push(result[0]);
          break;
        }
        insertCode = generateCode();
      }
    }
    await t.commit();
    res.json({ ok: true, codes: inserted });
  } catch (e) {
    await t.rollback();
    console.error("generate reward codes failed:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/reward-codes/export
router.get("/export", async (req, res) => {
  const statusFilter = req.query.status ?? "all";
  let whereClause = "";
  if (statusFilter === "active") {
    whereClause = `WHERE is_active = true AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR current_uses < max_uses)`;
  } else if (statusFilter === "expired") {
    whereClause = `WHERE expires_at IS NOT NULL AND expires_at <= now()`;
  } else if (statusFilter === "depleted") {
    whereClause = `WHERE max_uses IS NOT NULL AND current_uses >= max_uses`;
  } else if (statusFilter === "inactive") {
    whereClause = `WHERE is_active = false`;
  }

  const codes = await sequelize.query(
    `SELECT code, tier, duration_days, max_uses, current_uses, expires_at, is_active, ${COMPUTED_STATUS}, created_at
     FROM public.reward_codes ${whereClause}
     ORDER BY created_at DESC`,
    { type: QueryTypes.SELECT }
  );

  const header = "code,tier,duration_days,max_uses,current_uses,expires_at,is_active,status,created_at\n";
  const rows = codes.map((c) =>
    [
      c.code,
      c.tier,
      c.duration_days ?? "",
      c.max_uses ?? "",
      c.current_uses,
      c.expires_at ?? "",
      c.is_active,
      c.status,
      c.created_at,
    ]
      .map(String)
      .join(",")
  );

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="reward-codes-${date}.csv"`);
  res.send(header + rows.join("\n"));
});

// GET /api/admin/reward-codes/:id/claims
router.get("/:id/claims", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid code id" });
  }

  const [code] = await sequelize.query(
    `SELECT id FROM public.reward_codes WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  if (!code) return res.status(404).json({ error: "Code not found" });

  const claims = await sequelize.query(
    `SELECT rcc.profile_id, p.username, rcc.claimed_at
     FROM public.reward_code_claims rcc
     JOIN public.profile p ON p.id = rcc.profile_id
     WHERE rcc.code_id = :id
     ORDER BY rcc.claimed_at DESC`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );

  res.json({ claims });
});

// POST /api/admin/reward-codes  — create a single code with a custom name
router.post("/", async (req, res) => {
  const { code, tier, durationDays, maxUses, expiresAt } = req.body ?? {};

  if (typeof code !== "string" || !/^[A-Z0-9]{2,32}$/.test(code.trim().toUpperCase())) {
    return res.status(400).json({ error: "code must be 2–32 uppercase alphanumeric characters" });
  }
  if (!ALLOWED_TIERS.has(tier)) {
    return res.status(400).json({ error: "tier must be premium, pro, or pro_plus" });
  }
  if (durationDays !== null && durationDays !== undefined) {
    const d = parseInt(durationDays);
    if (!Number.isInteger(d) || d < 1) {
      return res.status(400).json({ error: "durationDays must be a positive integer or null" });
    }
  }
  if (maxUses !== null && maxUses !== undefined) {
    const m = parseInt(maxUses);
    if (!Number.isInteger(m) || m < 1) {
      return res.status(400).json({ error: "maxUses must be a positive integer or null" });
    }
  }
  if (expiresAt !== null && expiresAt !== undefined) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime()) || d <= new Date()) {
      return res.status(400).json({ error: "expiresAt must be a valid future date or null" });
    }
  }

  const normalizedCode = code.trim().toUpperCase();

  const [existing] = await sequelize.query(
    `SELECT id FROM public.reward_codes WHERE code = :code`,
    { replacements: { code: normalizedCode }, type: QueryTypes.SELECT }
  );
  if (existing) return res.status(409).json({ error: "A code with that name already exists" });

  const [inserted] = await sequelize.query(
    `INSERT INTO public.reward_codes (code, tier, duration_days, max_uses, expires_at)
     VALUES (:code, :tier, :duration_days, :max_uses, :expires_at)
     RETURNING id, code, tier, duration_days, max_uses, expires_at, is_active, created_at`,
    {
      replacements: {
        code: normalizedCode,
        tier,
        duration_days: durationDays ?? null,
        max_uses: maxUses ?? null,
        expires_at: expiresAt ?? null,
      },
      type: QueryTypes.INSERT,
    }
  );

  res.status(201).json({ ok: true, code: inserted[0] });
});

// PATCH /api/admin/reward-codes/:id  — toggle active only (kept for backward compat)
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid code id" });
  }
  const { isActive } = req.body ?? {};
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "isActive must be a boolean" });
  }

  const [code] = await sequelize.query(
    `SELECT id FROM public.reward_codes WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  if (!code) return res.status(404).json({ error: "Code not found" });

  await sequelize.query(
    `UPDATE public.reward_codes SET is_active = :isActive WHERE id = :id`,
    { replacements: { isActive, id }, type: QueryTypes.UPDATE }
  );

  res.json({ ok: true });
});

// PUT /api/admin/reward-codes/:id  — full edit (tier, duration, max uses, expiry, active)
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid code id" });
  }

  const { tier, durationDays, maxUses, expiresAt, isActive } = req.body ?? {};

  if (!ALLOWED_TIERS.has(tier)) {
    return res.status(400).json({ error: "tier must be premium, pro, or pro_plus" });
  }
  if (durationDays !== null && durationDays !== undefined) {
    const d = parseInt(durationDays);
    if (!Number.isInteger(d) || d < 1) {
      return res.status(400).json({ error: "durationDays must be a positive integer or null" });
    }
  }
  if (maxUses !== null && maxUses !== undefined) {
    const m = parseInt(maxUses);
    if (!Number.isInteger(m) || m < 1) {
      return res.status(400).json({ error: "maxUses must be a positive integer or null" });
    }
  }
  if (expiresAt !== null && expiresAt !== undefined) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: "expiresAt must be a valid date or null" });
    }
  }
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "isActive must be a boolean" });
  }

  const [code] = await sequelize.query(
    `SELECT id FROM public.reward_codes WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  if (!code) return res.status(404).json({ error: "Code not found" });

  await sequelize.query(
    `UPDATE public.reward_codes
     SET tier = :tier, duration_days = :duration_days, max_uses = :max_uses,
         expires_at = :expires_at, is_active = :isActive
     WHERE id = :id`,
    {
      replacements: {
        tier,
        duration_days: durationDays ?? null,
        max_uses: maxUses ?? null,
        expires_at: expiresAt ?? null,
        isActive,
        id,
      },
      type: QueryTypes.UPDATE,
    }
  );

  res.json({ ok: true });
});

// DELETE /api/admin/reward-codes/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid code id" });
  }

  const [code] = await sequelize.query(
    `SELECT id FROM public.reward_codes WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  if (!code) return res.status(404).json({ error: "Code not found" });

  const [claimCount] = await sequelize.query(
    `SELECT COUNT(*) AS total FROM public.reward_code_claims WHERE code_id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  if (parseInt(claimCount.total) > 0) {
    return res.status(409).json({ error: `This code has ${claimCount.total} claim(s) — disable it instead of deleting.` });
  }

  await sequelize.query(
    `DELETE FROM public.reward_codes WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.DELETE }
  );

  res.json({ ok: true });
});

export default router;
