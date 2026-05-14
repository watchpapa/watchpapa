import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

const ALLOWED_TIERS = new Set(["premium", "pro", "pro_plus"]);

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

export default router;
