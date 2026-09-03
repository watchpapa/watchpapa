import { Hono } from "hono";
import { requireAuth, requireAdmin } from "../../auth.js";
import { rateLimit } from "../../ratelimit.js";
import { users } from "./users.js";
import { stats } from "./stats.js";
import { rewardCodes } from "./rewardCodes.js";
import { referrals } from "./referrals.js";
import { auditLog } from "./auditLog.js";
import { announcementsAdmin } from "./announcements.js";

// All /api/admin/* — adminLimiter + requireAuth + requireAdmin (role = 4).

export const admin = new Hono();

admin.use("*", rateLimit("RL_GLOBAL", (c) => c.req.header("cf-connecting-ip") ?? "0.0.0.0"));
admin.use("*", requireAuth, requireAdmin);

admin.route("/users", users);
admin.route("/stats", stats);
admin.route("/reward-codes", rewardCodes);
admin.route("/referrals", referrals);
admin.route("/audit-log", auditLog);
admin.route("/announcements", announcementsAdmin);
