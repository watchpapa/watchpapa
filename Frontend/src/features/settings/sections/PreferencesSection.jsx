import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidBoolean } from "../../../lib/validate.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Switch from "../../../components/ui/Switch.jsx";

function PreferencesSection({ uid, profile, setProfile, prefs, updatePref, prefsBusy }) {
  const [marketingBusy, setMarketingBusy] = useState(false);

  const handleMarketingOptIn = async (val) => {
    if (marketingBusy || !isValidBoolean(val)) return;
    const prev = profile?.email_marketing_opt_in ?? false;
    setProfile((p) => ({ ...p, email_marketing_opt_in: val }));
    setMarketingBusy(true);
    const { error } = await supabase.from("profile").update({ email_marketing_opt_in: val, updated_at: new Date().toISOString() }).eq("id", uid);
    setMarketingBusy(false);
    if (error) setProfile((p) => ({ ...p, email_marketing_opt_in: prev }));
  };

  return (
    <SettingsSection id="preferences" title="Preferences">
      {profile?.is_adult && (
        <SettingsRow label="Show adult content" hint="Adult/erotica titles appear inline in browse, search and home rows." htmlFor="pref-adult">
          <Switch id="pref-adult" checked={prefs.showAdult} onChange={(v) => isValidBoolean(v) && updatePref({ showAdult: v })} disabled={prefsBusy} label="Show adult content" />
        </SettingsRow>
      )}
      {profile?.is_adult && prefs.showAdult && (
        <SettingsRow label="Adult tab in navigation" hint="Adds a dedicated Adult page (under More / in the drawer) — a browse of adult/erotica titles only, with categories and sorting." htmlFor="pref-adult-tab">
          <Switch id="pref-adult-tab" checked={prefs.showAdultTab} onChange={(v) => isValidBoolean(v) && updatePref({ showAdultTab: v })} disabled={prefsBusy} label="Adult tab in navigation" />
        </SettingsRow>
      )}
      {profile?.is_adult && prefs.showAdult && (
        <SettingsRow label="Blur NSFW posters" hint="Blurs the poster wherever an adult title turns up (tap to reveal one card). The Adult page itself is never blurred." htmlFor="pref-blur">
          <Switch id="pref-blur" checked={prefs.blurNsfw} onChange={(v) => isValidBoolean(v) && updatePref({ blurNsfw: v })} disabled={prefsBusy} label="Blur NSFW posters" />
        </SettingsRow>
      )}
      <SettingsRow label="Product updates & announcements" hint="Occasional emails about new features. Never marketing from third parties." htmlFor="pref-marketing">
        <Switch id="pref-marketing" checked={profile?.email_marketing_opt_in ?? false} onChange={handleMarketingOptIn} disabled={marketingBusy} label="Product updates & announcements" />
      </SettingsRow>
    </SettingsSection>
  );
}

export default PreferencesSection;
