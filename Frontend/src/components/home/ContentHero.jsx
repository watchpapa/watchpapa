import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";

const ROTATE_MS = 8000;

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Cinematic featured hero. Showcases the top trending titles with a vivid,
 * blurred backdrop, poster, title and quick actions. The thumbnail strip lets
 * the user swap which title is featured; it also auto-rotates.
 */
function ContentHero({ items = [], isAuthenticated }) {
  const featured = items.slice(0, 6).filter((i) => i.posterPath);
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (featured.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((p) => (p + 1) % featured.length);
    }, ROTATE_MS);
  };

  useEffect(() => {
    startTimer();
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured.length]);

  if (featured.length === 0) return null;

  const current = featured[Math.min(active, featured.length - 1)];
  const to = current.type === "movie" ? `/movies/${current.id}` : `/shows/${current.id}`;
  const isMovie = current.type === "movie";

  const handleSelect = (i) => {
    setActive(i);
    startTimer();
  };

  return (
    <section
      className="relative -mt-5 mb-4 overflow-hidden bg-[#111320] sm:-mt-6"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}
      aria-label="Featured trending titles"
    >
      {/* Blurred backdrop. The image lives in a wrapper that overshoots all
          edges well past the blur radius, so the feather never hits a hard
          clip inside the visible area. The scrims are separate, aligned to
          the section edges: the bottom/side scrims go fully opaque *before*
          reaching the actual edge (explicit stops, not the default 0/50/100
          spacing), so nothing — glow included — is ever still fading right
          at the section boundary where it would read as a visible seam
          against the flat page background below. */}
      <div className="absolute -inset-x-8 -inset-y-20 overflow-hidden">
        <img
          key={current.id}
          src={tmdbImg(current.posterPath, "w780")}
          alt=""
          aria-hidden
          className="h-full w-full object-cover opacity-50 blur-2xl saturate-[1.6]"
          style={{ animation: "heroBannerFadeIn 0.7s ease-out both" }}
        />
      </div>
      <div className="absolute inset-0" style={{ background: "radial-gradient(80% 90% at 18% 22%, rgba(192,132,252,0.22) 0%, transparent 60%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #111320 0%, rgba(17,19,32,0.9) 45%, rgba(17,19,32,0.4) 100%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #111320 0%, #111320 12%, transparent 55%, rgba(17,19,32,0.55) 100%)" }} />

      {/* Content */}
      <div className="relative mx-auto flex min-h-[300px] max-w-[1500px] items-center gap-5 px-4 py-9 sm:min-h-[360px] sm:gap-8 sm:px-8 sm:py-12 lg:min-h-[420px] lg:py-16">
        <Link
          to={to}
          className="group relative block w-[120px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#2a3570] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] transition duration-300 hover:-translate-y-1 hover:border-[#6f6fdc] hover:shadow-[0_22px_50px_-10px_rgba(111,111,220,0.5)] sm:w-[160px] lg:w-[190px]"
        >
          <img
            key={`p-${current.id}`}
            src={tmdbImg(current.posterPath, "w342")}
            alt={current.title}
            className="aspect-[2/3] h-full w-full object-cover"
            style={{ animation: "heroBannerFadeIn 0.5s ease-out both" }}
          />
        </Link>

        <div className="min-w-0 flex-1" key={`info-${current.id}`} style={{ animation: "fadeInUp 0.45s ease-out both" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: "rgba(10,12,35,0.78)", color: isMovie ? "#e8c04a" : "#7eb8f7" }}
            >
              {isMovie ? "Movie" : "Show"}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[#c084fc]">
              <StarIcon /> Trending now
            </span>
            {current.releaseLabel && current.releaseLabel !== "Airing" && (
              <span className="rounded bg-[#e8c04a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a1405]">
                {current.releaseLabel}
              </span>
            )}
          </div>

          {/* line-clamp-2 + a min-height reserving that same 2-line box means
              a one-line title doesn't shrink the hero and a long title never
              grows past it — the section's height stays constant regardless
              of which title is featured. */}
          <h1 className="line-clamp-2 min-h-[2.1em] max-w-3xl text-3xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl lg:text-6xl">
            {current.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={to}
              className="inline-flex items-center justify-center rounded-2xl border border-[#6f6fdc] bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(111,111,220,0.7)] transition hover:from-[#8585ef] hover:to-[#6f6fdc] active:scale-95"
            >
              View details
            </Link>
            {current.onFollowToggle && (
              <button
                type="button"
                onClick={current.onFollowToggle}
                disabled={!isAuthenticated || (!current.isFollowing && !!current.followBlockedLabel)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-bold transition active:scale-95 ${
                  current.isFollowing
                    ? "border-green-600 bg-green-900/40 text-green-400"
                    : "border-[#3a3a7a] bg-[#1a1d35]/70 text-[#c0c0e8] backdrop-blur-sm hover:border-[#6060b0] hover:text-white"
                } ${!isAuthenticated || (!current.isFollowing && current.followBlockedLabel) ? "opacity-60" : ""}`}
                title={
                  !isAuthenticated
                    ? "Sign in to follow"
                    : !current.isFollowing && current.followBlockedLabel
                      ? current.followBlockedLabel
                      : undefined
                }
              >
                {current.isFollowing
                  ? <><CheckIcon /> Following</>
                  : current.followBlockedLabel
                    ? current.followBlockedLabel
                    : <><PlusIcon /> Follow</>}
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          {featured.length > 1 && (
            <div className="mt-7 hidden items-center gap-2 sm:flex">
              {featured.map((it, i) => (
                <button
                  key={`${it.type}-${it.id}`}
                  type="button"
                  onClick={() => handleSelect(i)}
                  aria-label={`Feature ${it.title}`}
                  aria-current={i === active}
                  className={`h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg border transition ${
                    i === active
                      ? "border-[#c084fc] ring-2 ring-[#c084fc]/50"
                      : "border-white/15 opacity-55 hover:opacity-100"
                  }`}
                >
                  <img src={tmdbImg(it.posterPath, "w342")} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right side: short "what is watchpapa" intro (wide screens only) */}
        <aside className="hidden w-[330px] flex-shrink-0 lg:block">
          <div className="rounded-2xl border border-[#2a3570]/60 bg-[#0d0f1e]/55 p-5 backdrop-blur-md">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#c084fc]">
              Welcome to watchpapa
            </p>
            <p className="text-sm leading-relaxed text-[#c0c0e8]">
              Your home for films &amp; shows — rate what you&rsquo;ve watched, build watchlists,
              follow the titles and people you love, and never miss a release.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Rate", "Track", "Watchlists", "Calendar"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[#2a3570] bg-[#141728]/70 px-3 py-1 text-xs font-medium text-[#a78bfa]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ContentHero;
