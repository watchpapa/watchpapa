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
    next();
  };
}
