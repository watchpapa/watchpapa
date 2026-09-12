import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { config } from "./env.js";
import { TmdbError } from "./tmdb/client.js";
import { globalRateLimit } from "./ratelimit.js";
import { content } from "./routes/content.js";
import { search, posters, imageProxy, sitemap } from "./routes/publicContent.js";
import { referral } from "./routes/referral.js";
import { rewards } from "./routes/rewards.js";
import { announcements } from "./routes/announcements.js";
import { importRoutes } from "./routes/import.js";
import { admin } from "./routes/admin/index.js";
import { runImportTick, handleAdvance } from "./cron.js";

const app = new Hono();

app.use("*", secureHeaders());

app.use("*", (c, next) => {
  const { allowedOrigins } = config(c.env);
  return cors({
    origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : ""),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Disposition"],
    maxAge: 86400,
  })(c, next);
});

app.use("*", globalRateLimit);

app.get("/health", (c) => c.json({ status: "ok" }));

// Public content (TMDB-backed, edge-cached)
app.route("/api/content", content);
app.route("/api/search", search);
app.route("/api/posters", posters);
app.route("/api/image-proxy", imageProxy);
app.route("/", sitemap); // /sitemap*.xml

// Internal-only: the Worker calling itself to advance one import-job chunk
// per invocation (see cron.js). Registered BEFORE the /api/import mount below
// — importRoutes claims the whole /api/import/* prefix with a blanket
// requireAuth, which would otherwise intercept this path first and 401 it
// (Hono matches in registration order) since it's not a route inside
// importRoutes. Gated on X-Internal-Secret instead of a user JWT.
app.post("/api/import/_advance/:id", handleAdvance);

// User data (Hyperdrive → Supabase)
app.route("/api/referral", referral);
app.route("/api/rewards", rewards);
app.route("/api/announcements", announcements);
app.route("/api/import", importRoutes);
app.route("/api/admin", admin);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  if (err instanceof TmdbError) {
    return c.json({ error: err.message }, err.status === 404 ? 404 : 502);
  }
  console.error("[ERROR]", err?.stack ?? err?.message ?? err);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  fetch: app.fetch,
  // Safety net for background import jobs (worker/src/cron.js) — restarts any
  // job whose self-chain died. A healthy import never needs this; it advances
  // itself via POST /api/import/_advance/:id self-fetches instead.
  scheduled: (event, env, ctx) => ctx.waitUntil(runImportTick(env, ctx)),
};
