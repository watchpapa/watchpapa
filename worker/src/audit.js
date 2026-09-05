import { getSql } from "./db.js";

// Fire-and-forget audit row for a Worker mutation. Runs AFTER the handler via
// executionCtx.waitUntil so the response is never delayed.
//
//   auditLog(action, bodyFields = [])
//     action     — a key from auditActions.js
//     bodyFields — allowlist of request-body keys to record. Defaults to NONE
//                  (an earlier version stored the whole body when omitted —
//                  a footgun for any route that ever carried a secret).
//
// Handlers can add context after the fact:
//   c.set("audit", { targetUserId, extra: { … } })
// `targetUserId` fills audit_events.target_user_id (admin actions on another
// account); `extra` is merged into the recorded body (counts, ids…).
// Rows also carry the response status (attempt vs success) and source='worker'.

export function auditLog(action, bodyFields = []) {
  return async (c, next) => {
    let picked = {};
    if (bodyFields.length > 0) {
      try {
        const raw = await c.req.raw.clone().json();
        picked = Object.fromEntries(bodyFields.filter((k) => raw && k in raw).map((k) => [k, raw[k]]));
      } catch {
        picked = {};
      }
    }

    await next();

    const user = c.get("user");
    const ctx = c.get("audit") ?? {};
    const entry = {
      action,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      ip: c.req.header("cf-connecting-ip") ?? null,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res?.status ?? null,
      targetUserId: ctx.targetUserId ?? null,
      body: JSON.stringify({ ...picked, ...(ctx.extra ?? {}) }),
    };

    c.executionCtx.waitUntil(writeAuditRow(c, entry));
  };
}

async function writeAuditRow(c, e) {
  const sql = getSql(c);
  try {
    await sql`
      INSERT INTO public.audit_events (action, user_id, email, ip, method, path, body, status, target_user_id, source)
      VALUES (${e.action}, ${e.userId}, ${e.email}, ${e.ip}, ${e.method}, ${e.path}, ${e.body}::jsonb,
              ${e.status}, ${e.targetUserId}, 'worker')
    `;
  } catch (err) {
    console.error("[AUDIT] DB write failed:", err?.message);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Convenience for handlers: attach target/extra context to the pending row.
export function setAudit(c, patch) {
  c.set("audit", { ...(c.get("audit") ?? {}), ...patch });
}

// Pure helper (unit-tested): build the row the middleware would write.
export function buildAuditEntry({ action, user, ctx, method, url, ip, status, picked }) {
  return {
    action,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    ip: ip ?? null,
    method,
    path: new URL(url).pathname,
    status: status ?? null,
    targetUserId: ctx?.targetUserId ?? null,
    body: JSON.stringify({ ...(picked ?? {}), ...(ctx?.extra ?? {}) }),
  };
}

export function pickBodyFields(raw, bodyFields = []) {
  if (!raw || bodyFields.length === 0) return {};
  return Object.fromEntries(bodyFields.filter((k) => k in raw).map((k) => [k, raw[k]]));
}
