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
import { runImportTick } from "./cron.js";

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
  // Advances background import jobs (worker/src/cron.js), several chunks per
  // job per tick.
  scheduled: (event, env, ctx) => ctx.waitUntil(runImportTick(env)),
};
