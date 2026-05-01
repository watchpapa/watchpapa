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

app.use(express.json({ limit: "64kb" }));

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

app.use(globalLimiter);

app.use("/api/search", searchRouter);
app.use("/api/inject", mutationLimiter, requireAuth, auditLog("inject", ["type", "tmdbId"]), injectRouter);
app.use("/api/resolve", mutationLimiter, requireAuth, auditLog("resolve", ["type", "tmdbId"]), resolveRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
