// "Where to watch" panel for a movie/show detail page — streaming providers by
// region (JustWatch data via TMDB, see worker/src/tmdb/normalize.js
// compactWatchProviders). Region tabs default to the user's watch-region
// preferences; a signed-out visitor (or a user with no regions set) falls back
// to a plain <select> over whatever regions the title actually has data for.
// When none of the user's chosen regions have data, an "other countries" popup
// lets them page (arrows) or search through the regions that do.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { useWatchRegionCatalog } from "../../features/preferences/hooks/useWatchProviderCatalog.js";
import { JUSTWATCH_ATTRIBUTION_URL, TMDB_ATTRIBUTION_URL } from "../../lib/constants.js";

const BUCKETS = [
  { key: "flatrate", label: "Stream" },
  { key: "free", label: "Free" },
  { key: "ads", label: "Free with ads" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
];

function ProviderTile({ provider, mine }) {
  const imgSrc = tmdbImg(provider.logo_path, "w92");
  return (
    <div
      title={provider.name}
      className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${
        mine ? "border-[#c084fc] ring-2 ring-[#c084fc]/50" : "border-[#2a3570]/50"
      }`}
    >
      <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#12163a]">
        {imgSrc ? (
          <img src={imgSrc} alt={provider.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-[#6868b8]">
            {provider.name.slice(0, 2)}
          </div>
        )}
      </div>
      <span className="line-clamp-1 max-w-[4.5rem] text-center text-[10px] text-[#8888c8]">{provider.name}</span>
    </div>
  );
}

// The Stream/Free/Rent/Buy buckets for one region. Shared by the main panel
// and the other-countries popup so both render identically.
function RegionBuckets({ regionData, data, watchProviders }) {
  if (!regionData) return <p className="text-sm text-[#5a5a78]">No streaming data for this region.</p>;
  const providerName = (id) => data.providers[id]?.name ?? String(id);
  const providerLogo = (id) => data.providers[id]?.logo_path ?? null;
  return (
    <div className="space-y-3">
      {BUCKETS.map(({ key, label }) => {
        const ids = regionData[key];
        if (!ids || ids.length === 0) return null;
        const sorted = [...ids].sort((a, b) => (watchProviders.includes(b) ? 1 : 0) - (watchProviders.includes(a) ? 1 : 0));
        return (
          <div key={key}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#5a5a78]">{label}</p>
            <div className="flex flex-wrap gap-2">
              {sorted.map((id) => (
                <ProviderTile
                  key={id}
                  provider={{ name: providerName(id), logo_path: providerLogo(id) }}
                  mine={watchProviders.includes(id)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {watchProviders.some((id) => Object.values(regionData).flat().includes(id)) && (
        <p className="text-xs text-[#8383e7]">Highlighted: services you have in Settings.</p>
      )}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// Popup over every region the title has data for: ←/→ (buttons or arrow keys)
// step through them, the search box jumps to a specific country by name/code.
// Portaled to <body>: the panel it's opened from sits inside a ContentPanel
// with backdrop-blur, which makes that panel the containing block for
// position:fixed — rendered in place, the overlay was clipped to the panel and
// sat underneath the sections below it.
function OtherCountriesModal(props) {
  return createPortal(<OtherCountriesDialog {...props} />, document.body);
}

function OtherCountriesDialog({ regions, regionName, data, watchProviders, onClose }) {
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const code = regions[index];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return regions.filter((r) => r.toLowerCase() === q || regionName(r).toLowerCase().includes(q)).slice(0, 8);
  }, [query, regions, regionName]);

  const prev = () => setIndex((i) => (i - 1 + regions.length) % regions.length);
  const next = () => setIndex((i) => (i + 1) % regions.length);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.target?.tagName === "INPUT") return; // don't hijack caret movement in the search box
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, regions.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-[#2a2d60] bg-[#0d0f1e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Availability in other countries"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#2a3570]/50 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-white">Available in other countries</h2>
            <p className="text-[11px] text-[#5a5a78]">{regions.length} countries have streaming options</p>
          </div>
          <button type="button" onClick={onClose} className="text-xs text-[#6868b8] transition hover:text-white" aria-label="Close">
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a country…"
              autoFocus
              className="w-full rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white placeholder-[#4a4a8a] outline-none transition focus:border-[#6868b8]"
            />
            {matches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[#2a3570] bg-[#141728] shadow-2xl">
                {matches.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setIndex(regions.indexOf(r)); setQuery(""); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white transition hover:bg-[#1e2240]"
                  >
                    <span>{regionName(r)}</span>
                    <span className="text-[10px] font-bold tracking-widest text-[#4a4a7a]">{r}</span>
                  </button>
                ))}
              </div>
            )}
            {query.trim() && matches.length === 0 && (
              <p className="mt-1.5 text-[11px] text-[#5a5a78]">No country matching &ldquo;{query.trim()}&rdquo; has this title.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] p-1">
            <button type="button" onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8888c8] transition hover:bg-[#1a1d35] hover:text-white" aria-label="Previous country">
              <ChevronLeft />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold text-white">{regionName(code)}</p>
              <p className="text-[10px] tracking-widest text-[#4a4a7a]">{code} · {index + 1} / {regions.length}</p>
            </div>
            <button type="button" onClick={next} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8888c8] transition hover:bg-[#1a1d35] hover:text-white" aria-label="Next country">
              <ChevronRight />
            </button>
          </div>

          <RegionBuckets regionData={data.regions[code]} data={data} watchProviders={watchProviders} />

          {data.regions[code]?.link && (
            <a href={data.regions[code].link} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-[#5a5a78] underline hover:text-white">
              All options for {regionName(code)} on {new URL(TMDB_ATTRIBUTION_URL).hostname}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function WhereToWatch({ data }) {
  const { effectiveWatchRegions, watchProviders, anonRegion, setAnonRegion, isAuthenticated } = usePreferences();
  const { regions: regionCatalog } = useWatchRegionCatalog();
  const availableRegions = useMemo(() => Object.keys(data?.regions ?? {}).sort(), [data]);

  const regionName = useMemo(() => {
    const byCode = new Map(regionCatalog.map((r) => [r.code, r.name]));
    return (code) => {
      if (byCode.has(code)) return byCode.get(code);
      try {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
      } catch {
        return code;
      }
    };
  }, [regionCatalog]);

  const chosenRegions = isAuthenticated ? effectiveWatchRegions : anonRegion ? [anonRegion] : [];
  const preferredRegions = chosenRegions.filter((r) => availableRegions.includes(r));
  const [manualRegion, setManualRegion] = useState(null);
  const [showOthers, setShowOthers] = useState(false);
  const tabs = preferredRegions.length > 0 ? preferredRegions : availableRegions.slice(0, 1);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? null);
  const active = manualRegion ?? activeTab ?? tabs[0] ?? availableRegions[0] ?? null;

  if (!data || availableRegions.length === 0) return null;

  const regionData = active ? data.regions[active] : null;
  // The user picked regions but this title has data in none of them.
  const unavailableInChosen = chosenRegions.length > 0 && preferredRegions.length === 0;
  const otherRegions = availableRegions.filter((r) => !preferredRegions.includes(r));

  return (
    <div>
      {unavailableInChosen ? (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-300">
            Not available in {chosenRegions.map(regionName).join(", ")}
          </p>
          <p className="mt-0.5 text-xs text-[#8888c8]">
            It is streaming in {availableRegions.length} other {availableRegions.length === 1 ? "country" : "countries"}.
          </p>
          <button
            type="button"
            onClick={() => setShowOthers(true)}
            className="mt-2 rounded-lg border border-amber-500/50 bg-[#141728] px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:border-amber-400 hover:text-white"
          >
            See where it&rsquo;s available
          </button>
        </div>
      ) : (
        <>
          {tabs.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] p-1">
              {tabs.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setActiveTab(r); setManualRegion(null); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active === r ? "bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] text-white" : "text-[#8888c8] hover:text-white"
                  }`}
                  title={regionName(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {preferredRegions.length === 0 && (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-xs text-[#6868b8]">Region:</label>
              <select
                value={active ?? ""}
                onChange={(e) => { setManualRegion(e.target.value); if (!isAuthenticated) setAnonRegion(e.target.value); }}
                className="rounded-lg border border-[#3a3a7a] bg-[#1a1d35] px-2 py-1 text-xs text-white"
              >
                {availableRegions.map((r) => (
                  <option key={r} value={r}>{regionName(r)} ({r})</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {!unavailableInChosen && <RegionBuckets regionData={regionData} data={data} watchProviders={watchProviders} />}

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[#5a5a78]">
        {!unavailableInChosen && otherRegions.length > 0 && (
          <>
            <button type="button" onClick={() => setShowOthers(true)} className="underline hover:text-white">
              Other countries ({otherRegions.length})
            </button>
            <span>·</span>
          </>
        )}
        {!unavailableInChosen && regionData?.link && (
          <>
            <a href={regionData.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              All options on {new URL(TMDB_ATTRIBUTION_URL).hostname}
            </a>
            <span>·</span>
          </>
        )}
        <span>
          Streaming availability powered by{" "}
          <a href={JUSTWATCH_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            JustWatch
          </a>
        </span>
      </p>

      {showOthers && (
        <OtherCountriesModal
          regions={unavailableInChosen ? availableRegions : otherRegions}
          regionName={regionName}
          data={data}
          watchProviders={watchProviders}
          onClose={() => setShowOthers(false)}
        />
      )}
    </div>
  );
}

export default WhereToWatch;
