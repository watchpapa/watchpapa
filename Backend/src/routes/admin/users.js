import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

const ALLOWED_TIERS = new Set(["premium", "pro", "pro_plus"]);
const ALL_ADMIN_TIERS = new Set(["free", "premium", "pro", "pro_plus", "god"]);

let adminClient = null;
function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return adminClient;
}

// GET /api/admin/users/search?email=<query>
router.get("/search", async (req, res) => {
  const query = (req.query.email ?? "").trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: "Provide at least 2 characters" });
  }

  const users = await sequelize.query(
    `SELECT
       au.id,
       au.email,
       au.created_at,
       p.username,
       p.role,
       us.tier,
       us.source,
       us.is_early_adopter,
       us.expires_at
     FROM auth.users au
     LEFT JOIN public.profile p ON p.id = au.id
     LEFT JOIN public.user_subscriptions us ON us.profile_id = au.id
     WHERE (au.email ILIKE :query OR p.username ILIKE :query)
       AND p.deleted_at IS NULL
     ORDER BY au.created_at DESC
     LIMIT 20`,
    { replacements: { query: `%${query}%` }, type: QueryTypes.SELECT }
  );

  res.json({ users });
});

// GET /api/admin/users/staff — all accounts with role 3 (moderator) or 4 (admin)
router.get("/staff", async (_req, res) => {
  const staff = await sequelize.query(
    `SELECT
       au.id,
       au.email,
       au.created_at,
       p.username,
       p.role
     FROM public.profile p
     JOIN auth.users au ON au.id = p.id
     WHERE p.role IN (3, 4)
       AND p.deleted_at IS NULL
     ORDER BY p.role DESC, au.created_at ASC`,
    { type: QueryTypes.SELECT }
  );
  res.json({ staff });
});

// PATCH /api/admin/users/:id/role — set role to 0, 3, or 4; cannot self-modify
router.patch("/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body ?? {};

  if (![0, 3, 4].includes(role)) {
    return res.status(400).json({ error: "role must be 0, 3, or 4" });
  }

  if (id === req.user?.id) {
    return res.status(400).json({ error: "Cannot modify your own role" });
  }

  const [profile] = await sequelize.query(
    `SELECT id FROM public.profile WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );

  if (!profile) {
    return res.status(404).json({ error: "User not found" });
  }

  await sequelize.query(
    `UPDATE public.profile SET role = :role, updated_at = now() WHERE id = :id`,
    { replacements: { id, role }, type: QueryTypes.SELECT }
  );

  res.json({ ok: true });
});

// POST /api/admin/users/:id/grant-tier
router.post("/:id/grant-tier", async (req, res) => {
  const profileId = req.params.id;
  const { tier, durationDays } = req.body;

  if (!ALLOWED_TIERS.has(tier)) {
    return res.status(400).json({ error: `tier must be one of: ${[...ALLOWED_TIERS].join(", ")}` });
  }

  const days = durationDays === null || durationDays === undefined || durationDays === ""
    ? null
    : parseInt(durationDays, 10);

  if (days !== null && (isNaN(days) || days < 1)) {
    return res.status(400).json({ error: "durationDays must be a positive integer or null for lifetime" });
  }

  // Verify the profile exists before granting
  const [profile] = await sequelize.query(
    `SELECT id FROM public.profile WHERE id = :profileId AND deleted_at IS NULL`,
    { replacements: { profileId }, type: QueryTypes.SELECT }
  );

  if (!profile) {
    return res.status(404).json({ error: "User not found" });
  }

  await sequelize.query(
    `SELECT apply_tier_upgrade(:profileId::uuid, :tier, :days, 'admin')`,
    { replacements: { profileId, tier, days }, type: QueryTypes.SELECT }
  );

  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/tier — admin direct tier set; bypasses upgrade-only guards
router.patch("/:id/tier", async (req, res) => {
  const { id } = req.params;
  const { tier, durationDays } = req.body ?? {};

  if (!ALL_ADMIN_TIERS.has(tier)) {
    return res.status(400).json({ error: `tier must be one of: ${[...ALL_ADMIN_TIERS].join(", ")}` });
  }

  if (id === req.user?.id) {
    return res.status(400).json({ error: "Cannot modify your own tier" });
  }

  const [profile] = await sequelize.query(
    `SELECT id FROM public.profile WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );

  if (!profile) {
    return res.status(404).json({ error: "User not found" });
  }

  if (tier === "free") {
    await sequelize.query(
      `DELETE FROM public.user_subscriptions WHERE profile_id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return res.json({ ok: true });
  }

  const days = durationDays === null || durationDays === undefined || durationDays === ""
    ? null
    : parseInt(durationDays, 10);

  if (days !== null && (isNaN(days) || days < 1)) {
    return res.status(400).json({ error: "durationDays must be a positive integer or null for lifetime" });
  }

  if (days !== null) {
    await sequelize.query(
      `INSERT INTO public.user_subscriptions (profile_id, tier, source, expires_at, updated_at)
       VALUES (:id, :tier, 'admin', now() + (:days || ' days')::INTERVAL, now())
       ON CONFLICT (profile_id) DO UPDATE
         SET tier       = EXCLUDED.tier,
             source     = EXCLUDED.source,
             expires_at = EXCLUDED.expires_at,
             updated_at = now()`,
      { replacements: { id, tier, days: String(days) }, type: QueryTypes.SELECT }
    );
  } else {
    await sequelize.query(
      `INSERT INTO public.user_subscriptions (profile_id, tier, source, expires_at, updated_at)
       VALUES (:id, :tier, 'admin', NULL, now())
       ON CONFLICT (profile_id) DO UPDATE
         SET tier       = EXCLUDED.tier,
             source     = EXCLUDED.source,
             expires_at = NULL,
             updated_at = now()`,
      { replacements: { id, tier }, type: QueryTypes.SELECT }
    );
  }

  res.json({ ok: true });
});

export default router;
