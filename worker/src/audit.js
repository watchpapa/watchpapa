import { getSql } from "./db.js";

// Fire-and-forget audit row, mirroring Backend/src/middleware/auditLog.js.
// Runs AFTER the handler (so the response is not delayed) via executionCtx.waitUntil.
// ip comes from cf-connecting-ip (the droplet had no trust-proxy, so ip was useless).

export function auditLog(action, allowedBodyFields) {
  return async (c, next) => {
    let parsedBody = {};
    try {
      const raw = await c.req.raw.clone().json();
      parsedBody = allowedBodyFields
        ? Object.fromEntries(
            allowedBodyFields.filter((k) => k in raw).map((k) => [k, raw[k]]),
          )
        : raw;
    } catch {
      parsedBody = {};
    }

    await next();

    const user = c.get("user");
    const entry = {
      action,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      ip: c.req.header("cf-connecting-ip") ?? null,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      body: JSON.stringify(parsedBody),
    };

    c.executionCtx.waitUntil(
      (async () => {
        const sql = getSql(c);
        try {
          await sql`
            INSERT INTO public.audit_events (action, user_id, email, ip, method, path, body)
            VALUES (${entry.action}, ${entry.userId}, ${entry.email}, ${entry.ip},
                    ${entry.method}, ${entry.path}, ${entry.body}::jsonb)
          `;
        } catch (err) {
          console.error("[AUDIT] DB write failed:", err?.message);
        } finally {
          await sql.end({ timeout: 5 });
        }
      })(),
    );
  };
}
