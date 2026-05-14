import { Router } from "express";
import sequelize from "../../db/database.js";
import { QueryTypes } from "sequelize";

const router = Router();

const ALLOWED_STATUSES = new Set(["success", "failure", "stopped"]);

// GET /api/admin/script-logs?page=1&limit=50&script=&status=
router.get("/", async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const script = (req.query.script ?? "").trim();
  const status = req.query.status ?? "";

  const conditions = [];
  const replacements = { limit, offset };

  if (script) {
    conditions.push("script_name ILIKE :script");
    replacements.script = `%${script}%`;
  }
  if (status && ALLOWED_STATUSES.has(status)) {
    conditions.push("status = :status");
    replacements.status = status;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [scriptNames, logs, countResult] = await Promise.all([
    sequelize.query(
      `SELECT DISTINCT script_name FROM public.script_logs ORDER BY script_name`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT id, script_name, status, batch_size, error_code, error_detail,
              started_at, finished_at, runtime, created_at
       FROM public.script_logs ${where}
       ORDER BY started_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS total FROM public.script_logs ${where}`,
      { replacements, type: QueryTypes.SELECT }
    ),
  ]);

  res.json({
    logs,
    total: parseInt(countResult[0].total, 10),
    page,
    limit,
    scriptNames: scriptNames.map((r) => r.script_name),
  });
});

export default router;
