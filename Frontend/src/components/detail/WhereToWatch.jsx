// "Where to watch" panel for a movie/show detail page — streaming providers by
// region (JustWatch data via TMDB, see worker/src/tmdb/normalize.js
// compactWatchProviders). Region tabs default to the user's watch-region
// preferences; a signed-out visitor (or a user with no regions set) falls back
// to a plain <select> over whatever regions the title actually has data for.
import { useMemo, useState } from "react";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
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

function WhereToWatch({ data }) {
  const { effectiveWatchRegions, watchProviders, anonRegion, setAnonRegion, isAuthenticated } = usePreferences();
  const availableRegions = useMemo(() => Object.keys(data?.regions ?? {}).sort(), [data]);

  const preferredRegions = (isAuthenticated ? effectiveWatchRegions : anonRegion ? [anonRegion] : []).filter((r) =>
    availableRegions.includes(r),
  );
  const [manualRegion, setManualRegion] = useState(null);
  const tabs = preferredRegions.length > 0 ? preferredRegions : availableRegions.slice(0, 1);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? null);
  const active = manualRegion ?? activeTab ?? tabs[0] ?? availableRegions[0] ?? null;

  if (!data || availableRegions.length === 0) return null;

  const regionData = active ? data.regions[active] : null;
  const providerName = (id) => data.providers[id]?.name ?? String(id);
  const providerLogo = (id) => data.providers[id]?.logo_path ?? null;

  return (
    <div>
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
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {regionData ? (
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
      ) : (
        <p className="text-sm text-[#5a5a78]">No streaming data for this region.</p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[#5a5a78]">
        {regionData?.link && (
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
    </div>
  );
}

export default WhereToWatch;
