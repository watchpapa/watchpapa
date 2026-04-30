export function auditLog(action) {
  return (req, _res, next) => {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      userId: req.user?.id ?? "unauthenticated",
      email: req.user?.email ?? null,
      ip: req.ip,
      method: req.method,
      path: req.path,
      body: req.body,
    };
    console.log("[AUDIT]", JSON.stringify(entry));
    next();
  };
}
