import { createClient } from "@supabase/supabase-js";
import { hasAccepted } from "./cookieConsent.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Auth calls will fail until you set them in Frontend/.env",
  );
}

const consentAwareStorage = {
  getItem(key) {
    return (hasAccepted() ? localStorage : sessionStorage).getItem(key);
  },
  setItem(key, value) {
    (hasAccepted() ? localStorage : sessionStorage).setItem(key, value);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: consentAwareStorage,
  },
});
