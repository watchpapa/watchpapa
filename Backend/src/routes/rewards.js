import { Router } from "express";
import sequelize from "../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

// POST /api/rewards/claim
// Body: { code: string }
router.post("/claim", async (req, res) => {
  const code = (req.body?.code ?? "").trim().toUpperCase();

  if (!code) {
    return res.status(400).json({ error: "code is required" });
  }

  const userId = req.user.id;

  // Look up the reward code — must be active, not expired, and have uses remaining.
  const [rewardCode] = await sequelize.query(
    `SELECT id, tier, duration_days, max_uses, current_uses
     FROM public.reward_codes
     WHERE code = :code
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())`,
    { replacements: { code }, type: QueryTypes.SELECT }
  );

  if (!rewardCode) {
    return res.status(404).json({ error: "Reward code not found or no longer active" });
  }

  if (rewardCode.max_uses !== null && rewardCode.current_uses >= rewardCode.max_uses) {
    return res.status(410).json({ error: "This reward code has no uses remaining" });
  }

  // Check for duplicate claim.
  const [existingClaim] = await sequelize.query(
    `SELECT id FROM public.reward_code_claims WHERE code_id = :codeId AND profile_id = :userId`,
    { replacements: { codeId: rewardCode.id, userId }, type: QueryTypes.SELECT }
  );

  if (existingClaim) {
    return res.status(409).json({ error: "You have already claimed this reward code" });
  }

  // Transactionally insert claim, increment uses, and apply the tier upgrade.
  const t = await sequelize.transaction();
  try {
    await sequelize.query(
      `INSERT INTO public.reward_code_claims (code_id, profile_id) VALUES (:codeId, :userId)`,
      { replacements: { codeId: rewardCode.id, userId }, type: QueryTypes.INSERT, transaction: t }
    );

    await sequelize.query(
      `UPDATE public.reward_codes SET current_uses = current_uses + 1 WHERE id = :codeId`,
      { replacements: { codeId: rewardCode.id }, type: QueryTypes.UPDATE, transaction: t }
    );

    await sequelize.query(
      `SELECT public.apply_tier_upgrade(:userId, :tier, :durationDays, 'reward_code')`,
      {
        replacements: { userId, tier: rewardCode.tier, durationDays: rewardCode.duration_days },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    await t.commit();
    res.json({ ok: true, tier: rewardCode.tier, durationDays: rewardCode.duration_days });
  } catch (e) {
    await t.rollback();
    console.error("reward claim failed:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
