import { createRemoteJWKSet, jwtVerify } from "jose";
import { getSql } from "./db.js";

// Verify the Supabase access token locally against the project JWKS (ES256).
// No network round-trip to Supabase Auth per request — the JWKS is fetched once
// and cached by jose (module-level singleton keyed by SUPABASE_URL).

let jwks = null;
let jwksUrl = null;

function getJwks(supabaseUrl) {
  const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (!jwks || jwksUrl !== url) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksUrl = url;
  }
  return jwks;
}

async function verify(c) {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const supabaseUrl = (c.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  try {
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });
    if (!payload.sub) return null;
    return { id: payload.sub, email: payload.email ?? null };
  } catch {
    return null;
  }
}

// Hono middleware: 401 unless a valid token; sets c.get('user').
export async function requireAuth(c, next) {
  const user = await verify(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
}

// Requires profile.role === 4. DB-checked (a crafted JWT cannot spoof it).
export async function requireAdmin(c, next) {
  const user = c.get("user");
  const sql = getSql(c);
  try {
    const rows = await sql`SELECT role FROM public.profile WHERE id = ${user.id}`;
    if (Number(rows[0]?.role) !== 4) return c.json({ error: "Forbidden" }, 403);
    c.set("role", 4);
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    c.executionCtx.waitUntil(sql.end({ timeout: 5 }));
  }
  await next();
}

// Requires profile.role IN (3, 4).
export async function requireEditor(c, next) {
  const user = c.get("user");
  const sql = getSql(c);
  try {
    const rows = await sql`SELECT role FROM public.profile WHERE id = ${user.id}`;
    const role = Number(rows[0]?.role);
    if (role !== 3 && role !== 4) return c.json({ error: "Forbidden" }, 403);
    c.set("role", role);
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    c.executionCtx.waitUntil(sql.end({ timeout: 5 }));
  }
  await next();
}
