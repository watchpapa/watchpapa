// Cloudflare Pages Function — runs in front of every request to watchpapa.tv.
//
// Two jobs:
//  1. Real HTTP status codes for the SPA: unknown URLs get a genuine 404
//     instead of Cloudflare Pages' default "serve index.html with 200" SPA
//     fallback (soft 404s). React still renders <NotFoundPage>.
//  2. Social/search crawlers don't execute JS, so a shared /movies/:id link
//     (or any non-JS crawl of a content page) would otherwise only ever see
//     the generic homepage <title>/OG tags baked into index.html. For
//     content routes (and a handful of static ones) we ask the Worker's
//     GET /api/meta for the real tag values and rewrite the response <head>
//     with HTMLRewriter before handing it back.
//
// Keep this in sync with the route table in src/App.jsx.

const API_BASE = "https://api.watchpapa.tv";

// Every path the SPA itself handles. Anything else is a real 404.
const KNOWN_ROUTES = [
  /^\/$/,
  /^\/(login|register|verify-email|forgot-password|reset-password|complete-username)$/,
  /^\/search$/,
  /^\/adult$/,
  /^\/movies$/,
  /^\/movies\/\d+$/,
  /^\/movies\/tmdb\/\d+$/,
  /^\/shows$/,
  /^\/shows\/\d+$/,
  /^\/shows\/\d+\/seasons\/\d+$/,
  /^\/shows\/\d+\/seasons\/\d+\/episodes\/\d+$/,
  /^\/shows\/tmdb\/\d+$/,
  /^\/collections$/,
  /^\/collections\/\d+$/,
  /^\/my-services$/,
  /^\/people$/,
  /^\/people\/\d+$/,
  /^\/people\/tmdb\/\d+$/,
  /^\/calendar$/,
  /^\/(about|help|terms|contact|privacy|certifications|updates|subscription)$/,
  /^\/settings$/,
  /^\/watchlists$/,
  /^\/follows$/,
  /^\/users$/,
  /^\/feed$/,
  /^\/observe-requests$/,
  /^\/notifications$/,
  /^\/u\/[^/]+$/,
  /^\/u\/[^/]+\/(observers|observing|ratings)$/,
  /^\/profile\/edit$/,
  /^\/import$/,
  /^\/admin$/,
  /^\/admin\/[a-z-]+$/,
];

// Paths worth asking /api/meta for real <head> tags. Content routes carry a
// TMDB id; the flat set is handled by a static map on the Worker side (no
// per-request TMDB fetch for those).
const CONTENT_ROUTE_RE =
  /^\/(movies\/\d+|shows\/\d+(\/seasons\/\d+(\/episodes\/\d+)?)?|people\/\d+|collections\/\d+)$/;
const STATIC_META_PATHS = new Set([
  "/",
  "/movies",
  "/shows",
  "/people",
  "/collections",
  "/calendar",
  "/updates",
  "/subscription",
  "/about",
  "/help",
  "/terms",
  "/contact",
  "/privacy",
  "/certifications",
]);

function isKnownRoute(pathname) {
  return KNOWN_ROUTES.some((re) => re.test(pathname));
}

function wantsMeta(pathname) {
  return CONTENT_ROUTE_RE.test(pathname) || STATIC_META_PATHS.has(pathname);
}

async function fetchMeta(pathname, search) {
  try {
    const url = `${API_BASE}/api/meta?path=${encodeURIComponent(pathname)}${search ? `&${search}` : ""}`;
    const res = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // never fail the page load because the meta lookup failed
  }
}

function injectMeta(response, meta) {
  const rewriter = new HTMLRewriter()
    .on("title", { element: (e) => meta.title && e.setInnerContent(meta.title) })
    .on('meta[name="description"]', {
      element: (e) => meta.description && e.setAttribute("content", meta.description),
    })
    .on('meta[property="og:title"]', { element: (e) => meta.title && e.setAttribute("content", meta.title) })
    .on('meta[property="og:description"]', {
      element: (e) => meta.description && e.setAttribute("content", meta.description),
    })
    .on('meta[property="og:image"]', { element: (e) => meta.ogImage && e.setAttribute("content", meta.ogImage) })
    .on('meta[property="og:url"]', { element: (e) => meta.canonical && e.setAttribute("content", meta.canonical) })
    .on('meta[property="og:type"]', { element: (e) => e.setAttribute("content", meta.ogType || "website") })
    .on('meta[name="twitter:title"]', { element: (e) => meta.title && e.setAttribute("content", meta.title) })
    .on('meta[name="twitter:description"]', {
      element: (e) => meta.description && e.setAttribute("content", meta.description),
    })
    .on('meta[name="twitter:image"]', { element: (e) => meta.ogImage && e.setAttribute("content", meta.ogImage) })
    .on('link[rel="canonical"]', { element: (e) => meta.canonical && e.setAttribute("href", meta.canonical) })
    .on("head", {
      element(e) {
        if (meta.noindex) e.append('<meta name="robots" content="noindex">', { html: true });
        for (const obj of meta.jsonLd || []) {
          e.append(`<script type="application/ld+json" data-rh="true">${JSON.stringify(obj)}</script>`, {
            html: true,
          });
        }
      },
    });
  return rewriter.transform(response);
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const { pathname, search } = url;

  const isDocRequest =
    request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");

  // Never touch the API proxy, sitemaps, or anything that looks like a file
  // (assets, favicons, manifest, etc.) — let _redirects / static serving
  // handle those exactly as before.
  if (!isDocRequest || pathname.startsWith("/api/") || pathname.startsWith("/assets/") ||
      pathname.startsWith("/sitemap") || /\.[a-z0-9]+$/i.test(pathname)) {
    return next();
  }

  const known = isKnownRoute(pathname);
  const res = await next(); // the SPA shell (index.html), normally 200

  if (!wantsMeta(pathname)) {
    return known ? res : new Response(res.body, { status: 404, headers: res.headers });
  }

  const meta = await fetchMeta(pathname, search.replace(/^\?/, ""));
  const status = meta?.httpStatus ?? (known ? 200 : 404);

  if (!meta) {
    return known ? res : new Response(res.body, { status, headers: res.headers });
  }

  const rewritten = injectMeta(res, meta);
  return new Response(rewritten.body, { status, headers: rewritten.headers });
}
