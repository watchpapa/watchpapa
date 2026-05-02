import sequelize from "../db/database.js";

export function auditLog(action, allowedBodyFields) {
  return (req, _res, next) => {
    const rawBody = req.body ?? {};
    const body = allowedBodyFields
      ? Object.fromEntries(allowedBodyFields.filter((k) => k in rawBody).map((k) => [k, rawBody[k]]))
      : rawBody;
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      userId: req.user?.id ?? "unauthenticated",
      email: req.user?.email ?? null,
      ip: req.ip,
      method: req.method,
      path: req.path,
      body,
    };
    console.log("[AUDIT]", JSON.stringify(entry));

    sequelize
      .query(
        `INSERT INTO audit_events (action, user_id, email, ip, method, path, body)
         VALUES (:action, :userId, :email, :ip, :method, :path, :body::jsonb)`,
        {
          replacements: {
            action,
            userId: req.user?.id ?? null,
            email: req.user?.email ?? null,
            ip: req.ip,
            method: req.method,
            path: req.path,
            body: JSON.stringify(body),
          },
        }
      )
      .catch((err) => console.error("[AUDIT] DB write failed:", err.message));

    next();
  };
}
