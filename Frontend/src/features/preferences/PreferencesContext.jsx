// Central home for the user's content preferences: show-adult-content, content
// language + title mode, country, watch regions, and watch providers. Replaces
// the old single `showAdult` prop drilled through App.jsx to 12 routes, and fixes
// the bug where changing the adult toggle in Settings didn't take effect until a
// reload — every writer goes through `update()`, which updates this context (and
// therefore every consumer) immediately.
//
// Used by:
// - Frontend/src/App.jsx (provider, wraps the route tree)
// - Frontend/src/pages/app/SettingsPage.jsx (reads + writes every field here)
// - Any page/hook that previously received `showAdult` as a prop can now call
//   usePreferences() directly instead.
import { createContext, useContext, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { setContentLocale, getContentLocaleKey } from "../../lib/api.js";

// profile column -> preferences field
const COLUMNS = {
  showAdult: "setting_display_adult_content",
  language: "setting_language",
  titleMode: "setting_title_mode",
  region: "setting_region",
  watchRegions: "setting_watch_regions",
  watchProviders: "setting_watch_providers",
  homeRowOrder: "setting_home_row_order",
  homeHiddenRows: "setting_home_hidden_rows",
  blurNsfw: "setting_blur_nsfw_posters",
  showAdultTab: "setting_show_adult_tab",
};

export const DEFAULT_PREFERENCES = {
  showAdult: false,
  language: "en-US",
  titleMode: "translated", // "translated" | "native_original"
  region: null,
  watchRegions: [],
  watchProviders: [],
  homeRowOrder: [], // empty = app default order, see lib/homeRows.js
  homeHiddenRows: [],
  // Blurs a card's poster wherever an nsfw-flagged title shows up alongside
  // regular content (only relevant once showAdult is on). Defaults to true —
  // see migration 036.
  blurNsfw: true,
  // The hidden "Adult" header tab + /adult page. Separate opt-in on top of
  // showAdult (which only controls nsfw titles appearing inline) — the tab is
  // never shown unless BOTH are on. See migration 037.
  showAdultTab: false,
};

const ANON_REGION_KEY = "wp:watchRegion";

function readAnonRegion() {
  try {
    return localStorage.getItem(ANON_REGION_KEY) || null;
  } catch {
    return null;
  }
}

const PreferencesContext = createContext(null);

// `session` + `initial` (profile row mapped to DEFAULT_PREFERENCES shape) come from
// App.jsx, which already blocks first render on the profile fetch — so `initial` is
// always the right starting value the first time this mounts for a given user. App
// remounts the provider (via a `key`) when the signed-in user changes.
export function PreferencesProvider({ session, initial, children }) {
  const [state, setState] = useState(initial ?? DEFAULT_PREFERENCES);
  const [anonRegion, setAnonRegionState] = useState(readAnonRegion);

  const uid = session?.user?.id ?? null;

  const locale = useMemo(() => {
    if (state.titleMode === "native_original" && state.language !== "en-US") {
      return { lang: "en-US", region: state.region, native: state.language.slice(0, 2) };
    }
    return { lang: state.language, region: state.region, native: null };
  }, [state.titleMode, state.language, state.region]);

  // Synchronous, not an effect: this must run during render, before any child's
  // effects fire their first content fetch, or the first paint would go out under
  // the previous (or default) locale. setContentLocale() is a cheap idempotent
  // module-state write, safe to call every render.
  setContentLocale(locale);
  const localeKey = getContentLocaleKey();

  const effectiveWatchRegions = state.watchRegions.length > 0
    ? state.watchRegions
    : state.region
      ? [state.region]
      : [];

  async function update(partial) {
    const prev = state;
    setState((s) => ({ ...s, ...partial }));
    if (!uid) return { error: null }; // guest: local-only, nothing to persist

    const patch = {};
    for (const [field, value] of Object.entries(partial)) {
      if (COLUMNS[field]) patch[COLUMNS[field]] = value;
    }
    const { error } = await supabase
      .from("profile")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", uid);
    if (error) {
      setState(prev);
      return { error };
    }
    return { error: null };
  }

  function setAnonRegion(region) {
    setAnonRegionState(region);
    try {
      if (region) localStorage.setItem(ANON_REGION_KEY, region);
      else localStorage.removeItem(ANON_REGION_KEY);
    } catch {
      /* private-mode browsers: in-memory only for this session */
    }
  }

  const value = {
    ...state,
    isAuthenticated: Boolean(uid),
    locale,
    localeKey,
    effectiveWatchRegions,
    anonRegion,
    setAnonRegion,
    update,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}
