// Used by:
// - Frontend/src/pages/app/SettingsPage.jsx
// - Frontend/src/components/detail/WhereToWatch.jsx
//
// Thin wrappers over the Worker's locale/watch-provider config endpoints. These
// are public, edge-cached, language-only (no per-user data), so a plain
// useContent() call is enough — no extra hook state needed.
import { useContent } from "../../content/hooks/useContent.js";

// { languages: ["en-US", "pl-PL", ...], countries: [{code,name,nativeName}] }
export function useLocaleCatalog() {
  const { data, loading } = useContent("/api/content/config/locales");
  return { languages: data?.languages ?? [], countries: data?.countries ?? [], loading };
}

// [{code,name,nativeName}]
export function useWatchRegionCatalog() {
  const { data, loading } = useContent("/api/content/watch/regions");
  return { regions: data?.regions ?? [], loading };
}

// [{id,name,logo_path,priority}] for one region — pass null/undefined to skip.
export function useWatchProviderList(region) {
  const { data, loading } = useContent(region ? `/api/content/watch/providers?type=all&region=${region}` : null);
  return { providers: data?.providers ?? [], loading };
}

// Human label for a TMDB primary-translation code like "pl-PL" or "en-GB".
// TMDB's primary_translations list has many region variants of the same
// language (en-US, en-GB, en-AU, es-ES, es-MX, ...) — the region must be in
// the label or the picker shows a long run of indistinguishable "English"s.
// Always rendered in English regardless of `code` so the whole list reads
// consistently (the Settings page itself isn't localized).
export function languageLabel(code) {
  try {
    const [lang, region] = code.split("-");
    const langName = new Intl.DisplayNames(["en"], { type: "language" }).of(lang);
    const regionName = region ? new Intl.DisplayNames(["en"], { type: "region" }).of(region) : null;
    const capped = langName ? langName.charAt(0).toUpperCase() + langName.slice(1) : code;
    return regionName ? `${capped} (${regionName})` : capped;
  } catch {
    return code;
  }
}
