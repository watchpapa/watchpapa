// Used by:
// - index.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import searchRouter from "./Backend/src/routes/search.js";
import injectRouter from "./Backend/src/routes/inject.js";
import resolveRouter from "./Backend/src/routes/resolve.js";
import { requireAuth } from "./Backend/src/middleware/requireAuth.js";
import { auditLog } from "./Backend/src/middleware/auditLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const defaultAllowedOrigins = ["http://localhost:5173", "http://localhost:4173"];
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

app.use(helmet());

app.use(express.json({ limit: "128kb" }));

// Apply CORS headers for allowed frontend origins.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && corsAllowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const perUserMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  // Build per-user rate-limit keys from auth context or IP.
  keyGenerator: (req) => req.user?.id ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Handle read search requests that query local database content.
app.use("/api/search", searchRouter);
// Handle authenticated inject requests that write database records.
app.use("/api/inject", mutationLimiter, requireAuth, perUserMutationLimiter, auditLog("inject", ["type", "tmdbId"]), injectRouter);
// Handle authenticated resolve requests that read/write database records.
app.use("/api/resolve", mutationLimiter, requireAuth, perUserMutationLimiter, auditLog("resolve", ["type", "tmdbId"]), resolveRouter);

// Health check
// Return service health status for monitoring.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 404 handler
// Return JSON 404 for unmatched routes.
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
// Return JSON 500 and log server errors.
app.use((err, _req, res, _next) => {
  if (process.env.NODE_ENV === "production") {
    console.error("[ERROR]", err.message);
  } else {
    console.error(err);
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
