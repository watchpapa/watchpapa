import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { withSql } from "../db.js";
import { auditLog } from "../audit.js";
import { mutationRateLimit } from "../ratelimit.js";

export const rewards = new Hono();

// POST /api/rewards/claim  — port of Backend/src/routes/rewards.js
rewards.post("/claim", requireAuth, mutationRateLimit, auditLog("rewards", ["code"]), async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const code = (payload?.code ?? "").trim().toUpperCase();
  if (!code) return c.json({ error: "code is required" }, 400);

  const userId = c.get("user").id;

  return withSql(c, async (sql) => {
    const [rewardCode] = await sql`
      SELECT id, tier, duration_days, max_uses, current_uses
      FROM public.reward_codes
      WHERE code = ${code} AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    `;
    if (!rewardCode) return c.json({ error: "Reward code not found or no longer active" }, 404);
    if (rewardCode.max_uses !== null && rewardCode.current_uses >= rewardCode.max_uses) {
      return c.json({ error: "This reward code has no uses remaining" }, 410);
    }

    const [existingClaim] = await sql`
      SELECT id FROM public.reward_code_claims
      WHERE code_id = ${rewardCode.id} AND profile_id = ${userId}
    `;
    if (existingClaim) return c.json({ error: "You have already claimed this reward code" }, 409);

    try {
      await sql.begin(async (tx) => {
        await tx`INSERT INTO public.reward_code_claims (code_id, profile_id) VALUES (${rewardCode.id}, ${userId})`;
        await tx`UPDATE public.reward_codes SET current_uses = current_uses + 1 WHERE id = ${rewardCode.id}`;
        await tx`SELECT public.apply_tier_upgrade(${userId}, ${rewardCode.tier}, ${rewardCode.duration_days}, 'reward_code')`;
      });
    } catch (e) {
      console.error("reward claim failed:", e?.message);
      return c.json({ error: "Internal server error" }, 500);
    }

    return c.json({ ok: true, tier: rewardCode.tier, durationDays: rewardCode.duration_days });
  });
});
