import { useState } from "react";
import { isValidProviderIds, isValidRegionList } from "../../../lib/validate.js";
import { isProTier } from "../../../lib/tier.js";
import { tmdbImg } from "../../../lib/tmdbImage.js";
import { JUSTWATCH_ATTRIBUTION_URL } from "../../../lib/constants.js";
import { useWatchProviderList, useWatchRegionCatalog } from "../../preferences/hooks/useWatchProviderCatalog.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Select from "../../../components/ui/Select.jsx";
import Input from "../../../components/ui/Input.jsx";
import Button from "../../../components/ui/Button.jsx";
import { LockIcon, XIcon } from "../../../components/icons/index.jsx";
import { cn } from "../../../lib/cn.js";

// Up to 5 selected region chips + a select to add another.
function RegionChips({ regions, catalog, onChange, disabled }) {
  const available = catalog.filter((r) => !regions.includes(r.code));
  return (
    <div className="flex w-full flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {regions.length === 0 && <span className="text-xs text-text-faint">None selected</span>}
        {regions.map((code) => {
          const r = catalog.find((c) => c.code === code);
          return (
            <span key={code} className="flex h-9 items-center gap-1 rounded-full border border-border-strong bg-surface-3 pl-3 pr-1 text-xs text-text">
              {r?.name ?? code}
              <button
                type="button"
                onClick={() => onChange(regions.filter((c) => c !== code))}
                disabled={disabled}
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-dim transition hover:bg-surface-2 hover:text-white"
                aria-label={`Remove ${r?.name ?? code}`}
              >
                <XIcon size={13} />
              </button>
            </span>
          );
        })}
      </div>
      {regions.length < 5 && available.length > 0 && (
        <Select
          size="sm"
          value=""
          onChange={(code) => { if (code) onChange([...regions, code]); }}
          options={[{ value: "", label: "+ Add a region" }, ...available.map((r) => ({ value: r.code, label: r.name }))]}
          disabled={disabled}
          className="w-full sm:w-56"
        />
      )}
    </div>
  );
}

// Filterable grid of streaming-provider logos; tap to toggle.
function ProviderGrid({ providers, selectedIds, onToggle, disabled }) {
  const [filter, setFilter] = useState("");
  const visible = providers.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="w-full">
      <Input size="md" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter services…" className="mb-3" aria-label="Filter services" />
      <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6">
        {visible.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(p.id)}
              title={p.name}
              aria-pressed={selected}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 transition disabled:opacity-50",
                selected ? "border-brand bg-surface-3 ring-2 ring-brand/60" : "border-border/50 bg-surface hover:border-border-strong",
              )}
            >
              <div className="h-10 w-10 overflow-hidden rounded-lg">
                {p.logo_path ? (
                  <img src={tmdbImg(p.logo_path, "w92")} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-3 text-[10px] text-text-dim">{p.name.slice(0, 2)}</div>
                )}
              </div>
              <span className="line-clamp-1 max-w-full text-center text-[10px] text-text-muted">{p.name}</span>
            </button>
          );
        })}
        {visible.length === 0 && <p className="col-span-full py-4 text-center text-xs text-text-faint">No matching services.</p>}
      </div>
      <p className="mt-2 text-[11px] text-text-faint">
        {selectedIds.length} selected · Streaming availability data by{" "}
        <a href={JUSTWATCH_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">JustWatch</a>
      </p>
    </div>
  );
}

function StreamingSection({ prefs, updatePref, prefsBusy, tier }) {
  const { regions: watchRegionCatalog } = useWatchRegionCatalog();
  const providersRegion = prefs.effectiveWatchRegions[0] ?? null;
  const { providers: providerCatalog } = useWatchProviderList(providersRegion);

  return (
    <SettingsSection id="streaming" title="Streaming" description="Where to watch tabs on every title use these regions.">
      <SettingsRow label="Watch regions" hint="Up to 5 countries." stack>
        <RegionChips regions={prefs.watchRegions} catalog={watchRegionCatalog} onChange={(next) => isValidRegionList(next) && updatePref({ watchRegions: next })} disabled={prefsBusy} />
      </SettingsRow>
      <SettingsRow
        label="My streaming services"
        hint={
          !isProTier(tier)
            ? 'Anyone can browse "Where to watch" — choosing which services are yours (highlighted, plus the "· On Your Services" rows and My Services page) needs Pro.'
            : "Highlighted on every title, and they power the \"· On Your Services\" rows and the My Services page."
        }
        stack
      >
        {!isProTier(tier) ? (
          <Button to="/subscription" variant="outline" size="sm" icon={LockIcon} className="w-fit">Upgrade to Pro to pick your services</Button>
        ) : providersRegion ? (
          <ProviderGrid
            providers={providerCatalog}
            selectedIds={prefs.watchProviders}
            onToggle={(id) => {
              const next = prefs.watchProviders.includes(id) ? prefs.watchProviders.filter((x) => x !== id) : [...prefs.watchProviders, id];
              if (isValidProviderIds(next)) updatePref({ watchProviders: next });
            }}
            disabled={prefsBusy}
          />
        ) : (
          <span className="text-xs text-text-faint">Pick a watch region or country first.</span>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

export default StreamingSection;
