import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SettingsNav from "../../components/settings/SettingsNav.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { usePreferences } from "../../features/preferences/PreferencesContext.jsx";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { useSettingsData } from "../../features/settings/hooks/useSettingsData.js";
import ProfileSection from "../../features/settings/sections/ProfileSection.jsx";
import PreferencesSection from "../../features/settings/sections/PreferencesSection.jsx";
import ContentRegionSection from "../../features/settings/sections/ContentRegionSection.jsx";
import StreamingSection from "../../features/settings/sections/StreamingSection.jsx";
import HomeRowsSection from "../../features/settings/sections/HomeRowsSection.jsx";
import PrivacySection from "../../features/settings/sections/PrivacySection.jsx";
import PlanSection from "../../features/settings/sections/PlanSection.jsx";
import DataSection from "../../features/settings/sections/DataSection.jsx";
import AccountSection from "../../features/settings/sections/AccountSection.jsx";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "content", label: "Content & region" },
  { id: "streaming", label: "Streaming" },
  { id: "home", label: "Home page" },
  { id: "privacy", label: "Privacy" },
  { id: "plan", label: "Plan & rewards" },
  { id: "data", label: "Your data" },
  { id: "account", label: "Account", danger: true },
];

// Settings: a sticky section nav (chips on phones, side rail on desktop) and
// one card per section. Each section owns its own state and writes.
function SettingsPage({ session }) {
  const { uid, profile, setProfile, blocked, setBlocked, expiresAt, loading, reload } = useSettingsData(session);
  const me = useCurrentUser();
  const prefs = usePreferences();
  const [prefsBusy, setPrefsBusy] = useState(false);
  const updatePref = async (partial) => {
    setPrefsBusy(true);
    await prefs.update(partial);
    setPrefsBusy(false);
  };

  const breadcrumbs = [{ label: "Settings", to: "/settings" }];

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title="Settings" path="/settings" noindex />
      <PageContainer width="standard">
        <PageHeader title="Settings" subtitle="Your profile, content preferences, privacy and plan." />
        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <div className="lg:w-48 lg:shrink-0">
            <SettingsNav sections={SECTIONS} />
          </div>
          <div className="min-w-0 flex-1 space-y-5">
            {loading ? (
              <>
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-56 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </>
            ) : (
              <>
                <ProfileSection session={session} uid={uid} profile={profile} setProfile={setProfile} />
                <PreferencesSection uid={uid} profile={profile} setProfile={setProfile} prefs={prefs} updatePref={updatePref} prefsBusy={prefsBusy} tier={me.tier} />
                <ContentRegionSection prefs={prefs} updatePref={updatePref} prefsBusy={prefsBusy} />
                <StreamingSection prefs={prefs} updatePref={updatePref} prefsBusy={prefsBusy} tier={me.tier} />
                <HomeRowsSection prefs={prefs} updatePref={updatePref} prefsBusy={prefsBusy} />
                <PrivacySection uid={uid} profile={profile} setProfile={setProfile} blocked={blocked} setBlocked={setBlocked} />
                <PlanSection profile={profile} tier={me.tier} isEarlyAdopter={me.isEarlyAdopter} expiresAt={expiresAt} onClaimed={() => { reload(); me.refresh(); }} />
                <DataSection session={session} />
                <AccountSection />
              </>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

export default SettingsPage;
