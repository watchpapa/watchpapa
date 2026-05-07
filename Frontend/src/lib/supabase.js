// Used by:
// - Frontend/src/App.jsx
// - Frontend/src/components/detail/InjectingBanner.jsx
// - Frontend/src/components/layout/ProfileMenu.jsx
// - Frontend/src/features/auth/components/CompleteUsernameForm.jsx
// - Frontend/src/features/auth/components/ResetPasswordForm.jsx
// - Frontend/src/features/auth/hooks/useAuth.js
// - Frontend/src/features/calendar/hooks/useCalendarData.js
// - Frontend/src/features/episode/hooks/useEpisodeData.js
// - Frontend/src/features/home/hooks/useHomeData.js
// - Frontend/src/features/movie/hooks/useMovieData.js
// - Frontend/src/features/movies/hooks/useMoviesPageData.js
// - Frontend/src/features/people/hooks/usePeoplePageData.js
// - Frontend/src/features/person/hooks/usePersonData.js
// - Frontend/src/features/search/hooks/useSearch.js
// - Frontend/src/features/season/hooks/useSeasonData.js
// - Frontend/src/features/show/hooks/useShowData.js
// - Frontend/src/features/show/hooks/useShowFollow.js
// - Frontend/src/features/shows/hooks/useShowsPageData.js
import { createClient } from "@supabase/supabase-js";
import { hasAccepted } from "./cookieConsent.js";

// Read Supabase project URL and public key for database/auth requests.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Auth calls will fail until you set them in Frontend/.env",
  );
}

// Route auth session storage between local/session storage by cookie consent.
const consentAwareStorage = {
  // Return the persisted auth value from the selected browser storage.
  getItem(key) {
    return (hasAccepted() ? localStorage : sessionStorage).getItem(key);
  },
  // Save the auth value to the selected browser storage.
  setItem(key, value) {
    (hasAccepted() ? localStorage : sessionStorage).setItem(key, value);
  },
  // Clear auth value from both storages to fully remove session data.
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

// Create the shared Supabase client used for database and auth access.
export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: consentAwareStorage,
  },
});
