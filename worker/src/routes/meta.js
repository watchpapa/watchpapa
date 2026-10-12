import { Hono } from "hono";
import { tmdbFetch, TmdbNotFound } from "../tmdb/client.js";
import { TTL } from "../tmdb/lists.js";
import { normalizeMovie, normalizeShow, normalizeSeason, normalizeEpisode, normalizePerson, normalizeCollection } from "../tmdb/normalize.js";
import { readLocale } from "../tmdb/locale.js";
import { buildMeta, notFound } from "../lib/meta.js";

// GET /api/meta?path=<pathname> — consumed by Frontend/functions/_middleware.js
// to inject real <title>/OG/JSON-LD into the SPA shell for the given route.
// Always responds 200 (so it edge-caches cleanly); the body's `httpStatus`
// field tells the caller what HTTP status to put on the HTML response.

export const meta = new Hono();

// Static/list routes — copy mirrors each page's own <PageHead> exactly, so
// there's no title/description flash once React hydrates.
const STATIC_META = {
  "/movies": { title: "Movies", description: "Browse popular and upcoming movies by genre on watchpapa." },
  "/shows": { title: "Shows", description: "Browse popular shows, coming soon, and every genre on watchpapa." },
  "/people": { title: "People", description: "Browse popular actors, directors and crew on watchpapa." },
  "/collections": { title: "Collections", description: "Search movie franchises and collections on watchpapa." },
  "/calendar": { title: "Releases Calendar", description: "Track upcoming movie and TV show release dates on the watchpapa releases calendar." },
  "/updates": { title: "Updates", description: "Latest news, features, and announcements from the watchpapa team." },
  "/subscription": { title: "Plans & Perks", description: "watchpapa is free. See what Free, Premium, Pro and Pro+ include, how the first 5,000 accounts get lifetime Premium, and how referrals and reward codes earn upgrades." },
  "/about": { title: "About watchpapa", description: "watchpapa is a free tracker for the movies and shows you care about — upcoming releases, where to stream, what you've watched, and what to watch next. Powered by live TMDB data." },
  "/help": { title: "Help & FAQ", description: "How to use watchpapa — following and the Releases Radar, ratings, the rewatch diary, watchlists, suggestions, where to watch, language settings, profiles, observing people, adult content, import/export, plans and your account." },
  "/terms": { title: "Terms of Use", description: "The terms of use for watchpapa — eligibility, acceptable use, your content, adult content, plans and referrals, and liability." },
  "/contact": { title: "Contact watchpapa", description: "Get in touch with the watchpapa team — bug reports, feature ideas, privacy requests. Email support@watchpapa.tv or find us on LinkedIn." },
  "/privacy": { title: "Privacy Policy", description: "How watchpapa handles your data — what we store, why, who processes it, how long we keep it, and your rights under the GDPR. We collect only what's necessary and never sell it." },
  "/certifications": { title: "Content Certifications", description: "What movie and TV certifications (age/content ratings) mean, by country — sourced from TMDB." },
};

function posInt(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Mirrors the KNOWN content regexes in Frontend/functions/_middleware.js.
const MOVIE_RE = /^\/movies\/(\d+)$/;
const SHOW_RE = /^\/shows\/(\d+)$/;
const SEASON_RE = /^\/shows\/(\d+)\/seasons\/(\d+)$/;
const EPISODE_RE = /^\/shows\/(\d+)\/seasons\/(\d+)\/episodes\/(\d+)$/;
const PERSON_RE = /^\/people\/(\d+)$/;
const COLLECTION_RE = /^\/collections\/(\d+)$/;

meta.get("/", async (c) => {
  const path = c.req.query("path") || "/";
  const loc = readLocale(c);
  const cacheHeaders = { "Cache-Control": "public, s-maxage=86400, max-age=300" };

  try {
    let payload;

    if (path === "/") {
      payload = buildMeta("home", {});
    } else if (STATIC_META[path]) {
      const s = STATIC_META[path];
      payload = buildMeta("static", { path, staticTitle: s.title, staticDescription: s.description });
    } else {
      let m;
      if ((m = MOVIE_RE.exec(path))) {
        const id = posInt(m[1]);
        if (!id) throw new TmdbNotFound();
        const raw = await tmdbFetch(c.env, `/movie/${id}`, {}, { ttl: TTL.movie, language: loc.language });
        payload = buildMeta("movie", { movie: normalizeMovie(raw, { native: loc.native, region: loc.region }), path });
      } else if ((m = SEASON_RE.exec(path))) {
        const showId = posInt(m[1]);
        const seasonNumber = Number.parseInt(m[2], 10);
        if (!showId) throw new TmdbNotFound();
        const [showRaw, seasonRaw] = await Promise.all([
          tmdbFetch(c.env, `/tv/${showId}`, {}, { ttl: TTL.show, language: loc.language }),
          tmdbFetch(c.env, `/tv/${showId}/season/${seasonNumber}`, {}, { ttl: TTL.season, language: loc.language }),
        ]);
        payload = buildMeta("season", {
          season: normalizeSeason(seasonRaw, showId),
          show: normalizeShow(showRaw, { native: loc.native, region: loc.region }),
          path,
        });
      } else if ((m = EPISODE_RE.exec(path))) {
        const showId = posInt(m[1]);
        const seasonNumber = Number.parseInt(m[2], 10);
        const episodeNumber = posInt(m[3]);
        if (!showId || !episodeNumber) throw new TmdbNotFound();
        const [showRaw, seasonRaw, episodeRaw] = await Promise.all([
          tmdbFetch(c.env, `/tv/${showId}`, {}, { ttl: TTL.show, language: loc.language }),
          tmdbFetch(c.env, `/tv/${showId}/season/${seasonNumber}`, {}, { ttl: TTL.season, language: loc.language }),
          tmdbFetch(c.env, `/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`, {}, { ttl: TTL.episode, language: loc.language }),
        ]);
        payload = buildMeta("episode", {
          episode: normalizeEpisode(episodeRaw, showId),
          season: normalizeSeason(seasonRaw, showId),
          show: normalizeShow(showRaw, { native: loc.native, region: loc.region }),
          path,
        });
      } else if ((m = SHOW_RE.exec(path))) {
        const id = posInt(m[1]);
        if (!id) throw new TmdbNotFound();
        const raw = await tmdbFetch(c.env, `/tv/${id}`, {}, { ttl: TTL.show, language: loc.language });
        payload = buildMeta("show", { show: normalizeShow(raw, { native: loc.native, region: loc.region }), path });
      } else if ((m = PERSON_RE.exec(path))) {
        const id = posInt(m[1]);
        if (!id) throw new TmdbNotFound();
        const raw = await tmdbFetch(c.env, `/person/${id}`, {}, { ttl: TTL.person, language: loc.language });
        payload = buildMeta("person", { person: normalizePerson(raw, { native: loc.native }), path });
      } else if ((m = COLLECTION_RE.exec(path))) {
        const id = posInt(m[1]);
        if (!id) throw new TmdbNotFound();
        const raw = await tmdbFetch(c.env, `/collection/${id}`, {}, { ttl: TTL.collection, language: loc.language });
        payload = buildMeta("collection", { collection: normalizeCollection(raw, { native: loc.native, region: loc.region }), path });
      } else {
        payload = notFound();
      }
    }

    return c.json(payload, 200, cacheHeaders);
  } catch (err) {
    if (err instanceof TmdbNotFound) return c.json(notFound(), 200, cacheHeaders);
    throw err;
  }
});
