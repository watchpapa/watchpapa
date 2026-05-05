import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

const app = new Hono();
const ALLOWED_TYPES = new Set(["movie", "show", "person"]);
const ALLOWED_KEYS = new Set(["type", "tmdbId"]);
const TMDB_BASE = "https://api.themoviedb.org/3";

let adminClient = null;

function parseAllowedOrigins(raw) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function applyCors(c, env) {
  const reqOrigin = c.req.header("origin");
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (reqOrigin && allowed.includes(reqOrigin)) {
    c.header("Access-Control-Allow-Origin", reqOrigin);
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Vary", "Origin");
  }
}

function yearFrom(dateStr) {
  return typeof dateStr === "string" && dateStr.length >= 4 ? dateStr.slice(0, 4) : null;
}

function getAdminClient(env) {
  if (adminClient) return adminClient;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return adminClient;
}

async function requireAuth(c) {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  try {
    const token = auth.slice(7);
    const client = getAdminClient(c.env);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: true, user: data.user };
  } catch (error) {
    console.error("Auth check failed:", error?.message ?? error);
    return { ok: false, status: 500, error: "Authentication service unavailable" };
  }
}

function validateMutationBody(body) {
  const extraKeys = Object.keys(body ?? {}).filter((k) => !ALLOWED_KEYS.has(k));
  if (extraKeys.length > 0) {
    return { ok: false, status: 400, error: `Unknown fields: ${extraKeys.join(", ")}` };
  }
  const type = body?.type;
  const tmdbId = Number(body?.tmdbId);
  if (!ALLOWED_TYPES.has(type) || !Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId > 9_999_999) {
    return {
      ok: false,
      status: 400,
      error: "type must be movie|show|person and tmdbId must be a positive integer",
    };
  }
  return { ok: true, type, tmdbId };
}

async function fetchTmdbJson(env, pathAndQuery) {
  if (!env.TMDB_API_KEY_SECRET) {
    return { ok: false, status: 503, error: "Service unavailable" };
  }
  const url = `${TMDB_BASE}${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(env.TMDB_API_KEY_SECRET)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return { ok: false, status: response.status, error: `TMDB request failed (${response.status})` };
  }
  return { ok: true, data: await response.json() };
}

async function findLocalId(client, table, tmdbId) {
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("tmdb_id", tmdbId)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function upsertMovie(client, tmdbMovie) {
  const payload = {
    tmdb_id: tmdbMovie.id,
    title: tmdbMovie.title ?? tmdbMovie.original_title ?? "",
    original_title: tmdbMovie.original_title ?? tmdbMovie.title ?? "",
    poster_path: tmdbMovie.poster_path ?? null,
    tmdb_popularity: tmdbMovie.popularity ?? 0,
    overview: tmdbMovie.overview ?? "",
    release_date: tmdbMovie.release_date ?? null,
    original_language: tmdbMovie.original_language ?? null,
    adult: tmdbMovie.adult ?? false,
    tmdb_vote_avg: tmdbMovie.vote_average ?? 0,
    tmdb_vote_count: tmdbMovie.vote_count ?? 0,
  };
  const { error } = await client.from("movie").upsert(payload, { onConflict: "tmdb_id" });
  if (error) throw error;
  return findLocalId(client, "movie", tmdbMovie.id);
}

async function upsertShow(client, tmdbShow) {
  const payload = {
    tmdb_id: tmdbShow.id,
    name: tmdbShow.name ?? tmdbShow.original_name ?? "",
    original_name: tmdbShow.original_name ?? tmdbShow.name ?? "",
    poster_path: tmdbShow.poster_path ?? null,
    tmdb_popularity: tmdbShow.popularity ?? 0,
    overview: tmdbShow.overview ?? "",
    first_air_date: tmdbShow.first_air_date ?? null,
    original_language: tmdbShow.original_language ?? null,
    adult: tmdbShow.adult ?? false,
    tmdb_vote_avg: tmdbShow.vote_average ?? 0,
    tmdb_vote_count: tmdbShow.vote_count ?? 0,
  };
  const { error } = await client.from("show").upsert(payload, { onConflict: "tmdb_id" });
  if (error) throw error;
  return findLocalId(client, "show", tmdbShow.id);
}

async function upsertPerson(client, tmdbPerson) {
  const payload = {
    tmdb_id: tmdbPerson.id,
    name: tmdbPerson.name ?? "",
    profile_path: tmdbPerson.profile_path ?? null,
    popularity: tmdbPerson.popularity ?? 0,
    adult: tmdbPerson.adult ?? false,
  };
  const { error } = await client.from("person").upsert(payload, { onConflict: "tmdb_id" });
  if (error) throw error;
  return findLocalId(client, "person", tmdbPerson.id);
}

async function resolveTmdbEntity(client, env, type, tmdbId) {
  const table = type === "movie" ? "movie" : type === "show" ? "show" : "person";
  const existingId = await findLocalId(client, table, tmdbId);
  if (existingId != null) return existingId;

  if (type === "movie") {
    const tmdb = await fetchTmdbJson(env, `/movie/${tmdbId}?language=en-US`);
    if (!tmdb.ok) throw new Error(tmdb.error);
    return upsertMovie(client, tmdb.data);
  }
  if (type === "show") {
    const tmdb = await fetchTmdbJson(env, `/tv/${tmdbId}?language=en-US`);
    if (!tmdb.ok) throw new Error(tmdb.error);
    return upsertShow(client, tmdb.data);
  }
  const tmdb = await fetchTmdbJson(env, `/person/${tmdbId}?language=en-US`);
  if (!tmdb.ok) throw new Error(tmdb.error);
  return upsertPerson(client, tmdb.data);
}

app.use("*", async (c, next) => {
  applyCors(c, c.env);
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  return next();
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/api/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ results: [] });
  if (q.length > 100) return c.json({ error: "Query too long" }, 400);
  const includeAdult = c.req.query("includeAdult") === "true";

  try {
    const query = new URLSearchParams({
      query: q,
      language: "en-US",
      page: "1",
      include_adult: includeAdult ? "true" : "false",
    }).toString();
    const [movieRes, showRes, personRes] = await Promise.all([
      fetchTmdbJson(c.env, `/search/movie?${query}`),
      fetchTmdbJson(c.env, `/search/tv?${query}`),
      fetchTmdbJson(c.env, `/search/person?${query}`),
    ]);
    if (!movieRes.ok || !showRes.ok || !personRes.ok) {
      return c.json({ results: [] });
    }

    const filterAdult = (rows) => (includeAdult ? rows : rows.filter((r) => !r.adult));
    const perType = 15;

    const movies = filterAdult(movieRes.data.results ?? []).slice(0, perType).map((r) => ({
      type: "movie",
      localId: null,
      tmdbId: r.id,
      title: r.title ?? r.original_title ?? "",
      posterPath: r.poster_path ?? null,
      year: yearFrom(r.release_date),
      popularity: r.popularity ?? 0,
      originalTitle: r.original_title ?? r.title ?? "",
      overview: r.overview ?? "",
      releaseDate: r.release_date ?? null,
      originalLanguage: r.original_language ?? null,
      adult: r.adult ?? false,
      tmdbVoteAvg: r.vote_average ?? 0,
      tmdbVoteCount: r.vote_count ?? 0,
    }));

    const shows = filterAdult(showRes.data.results ?? []).slice(0, perType).map((r) => ({
      type: "show",
      localId: null,
      tmdbId: r.id,
      title: r.name ?? r.original_name ?? "",
      posterPath: r.poster_path ?? null,
      year: yearFrom(r.first_air_date),
      popularity: r.popularity ?? 0,
      originalName: r.original_name ?? r.name ?? "",
      overview: r.overview ?? "",
      firstAirDate: r.first_air_date ?? null,
      originalLanguage: r.original_language ?? null,
      adult: r.adult ?? false,
      tmdbVoteAvg: r.vote_average ?? 0,
      tmdbVoteCount: r.vote_count ?? 0,
    }));

    const people = filterAdult(personRes.data.results ?? []).slice(0, perType).map((r) => ({
      type: "person",
      localId: null,
      tmdbId: r.id,
      title: r.name ?? "",
      posterPath: r.profile_path ?? null,
      year: null,
      popularity: r.popularity ?? 0,
      adult: r.adult ?? false,
    }));

    return c.json({ results: [...movies, ...shows, ...people] });
  } catch (error) {
    console.error("Search error:", error?.message ?? error);
    return c.json({ error: "Search failed" }, 500);
  }
});

app.post("/api/resolve", async (c) => {
  const authCheck = await requireAuth(c);
  if (!authCheck.ok) {
    return c.json({ error: authCheck.error }, authCheck.status);
  }
  const body = await c.req.json().catch(() => ({}));
  const validated = validateMutationBody(body);
  if (!validated.ok) return c.json({ error: validated.error }, validated.status);

  try {
    const client = getAdminClient(c.env);
    const localId = await resolveTmdbEntity(client, c.env, validated.type, validated.tmdbId);
    return c.json({ localId });
  } catch (error) {
    console.error("Resolve error:", error?.message ?? error);
    return c.json({ error: "resolve failed" }, 500);
  }
});

app.post("/api/inject", async (c) => {
  const authCheck = await requireAuth(c);
  if (!authCheck.ok) {
    return c.json({ error: authCheck.error }, authCheck.status);
  }
  if (!c.env.TMDB_API_KEY_SECRET) {
    return c.json({ error: "Service unavailable" }, 503);
  }
  const body = await c.req.json().catch(() => ({}));
  const validated = validateMutationBody(body);
  if (!validated.ok) return c.json({ error: validated.error }, validated.status);

  try {
    const client = getAdminClient(c.env);
    const localId = await resolveTmdbEntity(client, c.env, validated.type, validated.tmdbId);
    return c.json({ ok: true, localId });
  } catch (error) {
    console.error("Inject error:", error?.message ?? error);
    return c.json({ error: "inject failed" }, 500);
  }
});

export default app;
