import { Router } from "express";
import sequelize from "../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

const CODE_RE = /^[A-Z0-9]{6,12}$/i;

// POST /api/referral/use/:code
router.post("/use/:code", async (req, res) => {
  const code = (req.params.code ?? "").toUpperCase();

  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: "Invalid referral code format" });
  }

  const userId = req.user.id;

  // Find the referrer by their referral_code.
  const [referrer] = await sequelize.query(
    `SELECT id FROM public.profile WHERE referral_code = :code`,
    { replacements: { code }, type: QueryTypes.SELECT }
  );

  if (!referrer) {
    return res.status(404).json({ error: "Referral code not found" });
  }

  if (referrer.id === userId) {
    return res.status(400).json({ error: "You cannot use your own referral code" });
  }

  // Check if this user was already referred (referred_id has a UNIQUE constraint).
  const [existing] = await sequelize.query(
    `SELECT id FROM public.referrals WHERE referred_id = :userId`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  if (existing) {
    return res.status(409).json({ error: "You have already used a referral code" });
  }

  // Insert the referral row.
  await sequelize.query(
    `INSERT INTO public.referrals (referrer_id, referred_id) VALUES (:referrerId, :referred_id)`,
    { replacements: { referrerId: referrer.id, referred_id: userId }, type: QueryTypes.INSERT }
  );

  // Edge case: user already meets tasks at the moment they enter the code.
  await sequelize.query(
    `SELECT public.check_and_complete_referral(:userId)`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  res.json({ ok: true });
});

export default router;
