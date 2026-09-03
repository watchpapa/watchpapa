import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { withSql } from "../db.js";
import { auditLog } from "../audit.js";
import { mutationRateLimit } from "../ratelimit.js";

export const referral = new Hono();

const CODE_RE = /^[A-Z0-9]{6,12}$/i;

// POST /api/referral/use/:code  — port of Backend/src/routes/referral.js
referral.post("/use/:code", requireAuth, mutationRateLimit, auditLog("referral", ["code"]), async (c) => {
  const code = (c.req.param("code") ?? "").toUpperCase();
  if (!CODE_RE.test(code)) return c.json({ error: "Invalid referral code format" }, 400);

  const userId = c.get("user").id;

  return withSql(c, async (sql) => {
    const [referrer] = await sql`SELECT id FROM public.profile WHERE referral_code = ${code}`;
    if (!referrer) return c.json({ error: "Referral code not found" }, 404);
    if (referrer.id === userId) return c.json({ error: "You cannot use your own referral code" }, 400);

    const [existing] = await sql`SELECT id FROM public.referrals WHERE referred_id = ${userId}`;
    if (existing) return c.json({ error: "You have already used a referral code" }, 409);

    await sql`INSERT INTO public.referrals (referrer_id, referred_id) VALUES (${referrer.id}, ${userId})`;
    await sql`SELECT public.check_and_complete_referral(${userId})`;

    return c.json({ ok: true });
  });
});
