import { useCallback, useEffect, useRef, useState } from "react";

const FEATURE_INTERVAL_MS = 5500;
const FEATURE_TRANSITION_MS = 700;

const FEATURES = [
  { label: "Ratings", tagline: "Score what you've watched", icon: StarIcon },
  { label: "Watchlists", tagline: "Plan what to watch next", icon: ListIcon },
  { label: "Details", tagline: "Cast, crew & episodes", icon: InfoIcon },
  { label: "Calendar", tagline: "Upcoming releases", icon: CalendarIcon },
  { label: "Follow", tagline: "Track titles you love", icon: HeartIcon },
  { label: "Discover", tagline: "Browse films & shows", icon: SearchIcon },
];

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BannerBackground() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, #15182a 0%, #1a1f38 45%, #121528 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 30%, rgba(131,131,231,0.35) 0%, transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
    </>
  );
}

function FeatureStrip() {
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef(null);

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % FEATURES.length);
  }, []);

  const startAutoplay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(advance, FEATURE_INTERVAL_MS);
  }, [advance]);

  useEffect(() => {
    startAutoplay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoplay]);

  const handleDotClick = (index) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    startAutoplay();
  };

  return (
    <div
      className="border-t border-white/10 bg-black/20 backdrop-blur-sm"
      aria-roledescription="carousel"
      aria-label="watchpapa features"
    >
      <div className="relative overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translateX(-${activeIndex * 100}%)`,
            transition: `transform ${FEATURE_TRANSITION_MS}ms ease-in-out`,
          }}
        >
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.label}
                className="flex w-full flex-shrink-0 items-center justify-center gap-2.5 px-5 py-2.5"
                aria-hidden={index !== activeIndex}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-[#b8b8ff]">
                  <Icon />
                </div>
                <p className="text-sm text-white">
                  <span className="font-semibold">{feature.label}</span>
                  <span className="text-white/55"> · {feature.tagline}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pb-2">
        {FEATURES.map((feature, index) => (
          <button
            key={feature.label}
            type="button"
            aria-label={`Show feature: ${feature.label}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => handleDotClick(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === activeIndex ? "w-6 bg-[#8383e7]" : "w-1.5 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function HeroBanner() {
  return (
    <section
      className="relative left-1/2 -mt-5 mb-2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden sm:-mt-6"
      style={{ animation: "heroBannerFadeIn 0.6s ease-out both" }}
      aria-label="About watchpapa"
    >
      <div className="relative">
        <BannerBackground />

        <div className="relative mx-auto max-w-2xl px-5 py-6 text-center sm:px-8 sm:py-7">
          <h2 className="text-lg font-bold text-white sm:text-xl">
            Discover, Track &amp; Rate Movies &amp; TV Shows
          </h2>
          <p className="mt-2 text-sm leading-snug text-white/75">
            watchpapa brings films, shows, and people together — follow releases, build watchlists,
            and keep your watch life in one place.
          </p>
        </div>

        <FeatureStrip />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#111320]/80 to-transparent" />
      </div>
    </section>
  );
}

export default HeroBanner;
