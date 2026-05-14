import { Router } from "express";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

const ALLOWED_ACTIONS = new Set([
  "inject", "resolve", "referral", "rewards",
  "follow_movie", "unfollow_movie", "follow_show", "unfollow_show",
]);

// GET /api/admin/audit-log?page=1&limit=50&action=&email=&from=&to=
router.get("/", async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const action = req.query.action ?? "";
  const email  = (req.query.email ?? "").trim();
  const from   = req.query.from ?? null;
  const to     = req.query.to   ?? null;

  const conditions = [];
  const replacements = { limit, offset };

  if (action && ALLOWED_ACTIONS.has(action)) {
    conditions.push("action = :action");
    replacements.action = action;
  }
  if (email.length >= 2) {
    conditions.push("email ILIKE :email");
    replacements.email = `%${email}%`;
  }
  if (from) {
    conditions.push("created_at >= :from");
    replacements.from = from;
  }
  if (to) {
    conditions.push("created_at <= :to");
    replacements.to = to;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [events, countResult] = await Promise.all([
    sequelize.query(
      `SELECT id, created_at, action, user_id, email, ip, method, path, body
       FROM audit_events ${where}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS total FROM audit_events ${where}`,
      { replacements, type: QueryTypes.SELECT }
    ),
  ]);

  res.json({ events, total: parseInt(countResult[0].total, 10), page, limit });
});

export default router;
