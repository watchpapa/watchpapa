// Used by:
// - Frontend/src/main.jsx
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase.js";
import { PreferencesProvider, usePreferences } from "./features/preferences/PreferencesContext.jsx";
import { CurrentUserProvider } from "./features/profile/CurrentUserContext.jsx";
import { notifyProfileUpdated } from "./features/profile/profileEvents.js";
import { isAdult } from "./lib/validate.js";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage.jsx";
import CompleteUsernamePage from "./pages/auth/CompleteUsernamePage.jsx";
import AppHomePage from "./pages/app/AppHomePage.jsx";
import SearchPage from "./pages/app/SearchPage.jsx";
import MoviesPage from "./pages/app/MoviesPage.jsx";
import ShowsPage from "./pages/app/ShowsPage.jsx";
import PeoplePage from "./pages/app/PeoplePage.jsx";
import MoviePage from "./pages/app/MoviePage.jsx";
import ShowPage from "./pages/app/ShowPage.jsx";
import SeasonPage from "./pages/app/SeasonPage.jsx";
import EpisodePage from "./pages/app/EpisodePage.jsx";
import PersonPage from "./pages/app/PersonPage.jsx";
import CollectionsPage from "./pages/app/CollectionsPage.jsx";
import CollectionPage from "./pages/app/CollectionPage.jsx";
import MyServicesPage from "./pages/app/MyServicesPage.jsx";
import AdultPage from "./pages/app/AdultPage.jsx";
import TmdbRedirect from "./components/TmdbRedirect.jsx";
import CookieConsentBanner from "./components/ui/CookieConsentBanner.jsx";
import ReportBugButton from "./components/ui/ReportBugButton.jsx";
import ReleasesCalendarPage from "./pages/app/ReleasesCalendarPage.jsx";
import SubscriptionPage from "./pages/app/SubscriptionPage.jsx";
import SettingsPage from "./pages/app/SettingsPage.jsx";
import UpdatesPage from "./pages/app/UpdatesPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import RewardCodesPage from "./pages/admin/RewardCodesPage.jsx";
import TierRewardsPage from "./pages/admin/TierRewardsPage.jsx";
import AnnouncementsPage from "./pages/admin/AnnouncementsPage.jsx";
import EarlyAdoptersPage from "./pages/admin/EarlyAdoptersPage.jsx";
import StatsPage from "./pages/admin/StatsPage.jsx";
import UserLookupPage from "./pages/admin/UserLookupPage.jsx";
import ReferralLeaderboardPage from "./pages/admin/ReferralLeaderboardPage.jsx";
import AuditLogPage from "./pages/admin/AuditLogPage.jsx";
import AdminRoute from "./components/auth/AdminRoute.jsx";
import StaffPage from "./pages/admin/StaffPage.jsx";
import CatalogStatsPage from "./pages/admin/CatalogStatsPage.jsx";
import WatchlistsPage from "./pages/app/WatchlistsPage.jsx";
import ProfilePage from "./pages/app/ProfilePage.jsx";
import ProfileRatingsPage from "./pages/app/ProfileRatingsPage.jsx";
import EditProfilePage from "./pages/app/EditProfilePage.jsx";
import FollowsPage from "./pages/app/FollowsPage.jsx";
import ImportPage from "./pages/app/ImportPage.jsx";
import UserSearchPage from "./pages/app/UserSearchPage.jsx";
import ActivityFeedPage from "./pages/app/ActivityFeedPage.jsx";
import ObserveRequestsPage from "./pages/app/ObserveRequestsPage.jsx";
import NotificationsPage from "./pages/app/NotificationsPage.jsx";
import ObserveListPage from "./pages/app/ObserveListPage.jsx";
import {
  AboutPage,
  ContactPage,
  HelpPage,
  PrivacyPage,
  TermsPage,
  CertificationsInfoPage,
} from "./pages/app/static/StaticInfoPages.jsx";

// Redirect signed-in users away from auth-only pages.
function PublicOnlyRoute({ session, needsUsernameSetup, children }) {
  if (session) {
    return <Navigate to={needsUsernameSetup ? "/complete-username" : "/"} replace />;
  }
  return children;
}

// Protect app routes and enforce username setup flow.
function ProtectedRoute({
  session,
  needsUsernameSetup,
  allowUsernameSetup = false,
  children,
}) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (needsUsernameSetup && !allowUsernameSetup) {
    return <Navigate to="/complete-username" replace />;
  }
  if (!needsUsernameSetup && allowUsernameSetup) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Allow public routes while still handling setup redirects.
function PublicRoute({ session, needsUsernameSetup, children }) {
  if (session && needsUsernameSetup) {
    return <Navigate to="/complete-username" replace />;
  }
  return children;
}

// Boot the app shell, auth state, profile data, and route tree.
function App() {
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [initialUsername, setInitialUsername] = useState("");
  const [initialPrefs, setInitialPrefs] = useState(null); // null until the profile fetch resolves
  const [initialProfile, setInitialProfile] = useState(null); // seed for CurrentUserProvider (role/avatar/referral)

  useEffect(() => {
    let isMounted = true;

    // Read current auth session from Supabase Auth.
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const nextSession = data.session ?? null;

      if (!nextSession) {
        if (!isMounted) return;
        setSession(null);
        setIsSessionLoading(false);
        return;
      }

      // Validate user record with Supabase Auth before using session.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        await supabase.auth.signOut({ scope: "local" });
        if (!isMounted) return;
        setSession(null);
        setIsSessionLoading(false);
        return;
      }

      if (!isMounted) return;
      setSession(nextSession);
      setIsSessionLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!session?.user?.id) {
      setNeedsUsernameSetup(false);
      setInitialUsername("");
      setInitialPrefs(null);
      setInitialProfile(null);
      setIsProfileLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsProfileLoading(true);
    // Read profile settings for the signed-in user.
    supabase
      .from("profile")
      .select(
        "username, is_adult, date_of_birth, setting_display_adult_content, setting_language, setting_title_mode, setting_region, setting_watch_regions, setting_watch_providers, setting_home_row_order, setting_home_hidden_rows, setting_blur_nsfw_posters, setting_show_adult_tab, setting_bottom_tab_middle, role, avatar_type, avatar_poster_path, avatar_upload_path, referral_code, is_private",
      )
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
      if (!isMounted) return;
      // Neither "the fetch failed" nor "no row came back" means "this account
      // has no username" — treating them that way trapped existing users:
      // PublicRoute redirects to /complete-username whenever
      // needsUsernameSetup is true, so a transient network/RLS hiccup here
      // (or a row not yet visible right after sign-up) sent a real user into
      // a redirect they could never leave, since every other route bounces
      // them straight back. On either failure, leave the setup flag alone
      // (default false) and let them use the app; a genuinely new account
      // will still hit this correctly once the fetch succeeds.
      if (error) {
        console.error("Failed to load profile:", error);
        setIsProfileLoading(false);
        return;
      }
      if (!data) {
        console.error("Profile fetch returned no row for a signed-in user:", session.user.id);
        setIsProfileLoading(false);
        return;
      }

      const nextUsername = data?.username?.trim() ?? "";
      setInitialUsername(nextUsername);
      setNeedsUsernameSetup(nextUsername.length === 0);
      setInitialProfile(data ?? null);
      setInitialPrefs({
        showAdult: data?.setting_display_adult_content ?? false,
        language: data?.setting_language ?? "en-US",
        titleMode: data?.setting_title_mode ?? "translated",
        region: data?.setting_region ?? null,
        watchRegions: data?.setting_watch_regions ?? [],
        watchProviders: data?.setting_watch_providers ?? [],
        homeRowOrder: data?.setting_home_row_order ?? [],
        homeHiddenRows: data?.setting_home_hidden_rows ?? [],
        blurNsfw: data?.setting_blur_nsfw_posters ?? true,
        showAdultTab: data?.setting_show_adult_tab ?? false,
        bottomTabMiddle: data?.setting_bottom_tab_middle ?? "services",
      });
      setIsProfileLoading(false);

      if (data && !data.is_adult && isAdult(data.date_of_birth)) {
        // Persist adult eligibility (turned 18 since sign-up) back to the profile.
        supabase
          .from("profile")
          .update({ is_adult: true, updated_at: new Date().toISOString() })
          .eq("id", session.user.id)
          .then(() => {});
      }
      });

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  if (isSessionLoading || (session && isProfileLoading)) {
    return null;
  }

  return (
    <PreferencesProvider session={session} initial={initialPrefs} key={session?.user?.id ?? "anon"}>
      <CurrentUserProvider session={session} initialProfile={initialProfile}>
        <RouteTree
          session={session}
          needsUsernameSetup={needsUsernameSetup}
          initialUsername={initialUsername}
          onUsernameCompleted={(nextUsername) => {
            const normalizedUsername = nextUsername?.trim() ?? "";
            setInitialUsername(normalizedUsername);
            setNeedsUsernameSetup(normalizedUsername.length === 0);
            notifyProfileUpdated();
          }}
        />
      </CurrentUserProvider>
    </PreferencesProvider>
  );
}

// The actual route tree. Split out from App() so it can read live preferences
// (showAdult etc.) via usePreferences() — App() renders the PreferencesProvider
// that wraps this component, so App() itself cannot consume that context.
function RouteTree({ session, needsUsernameSetup, initialUsername, onUsernameCompleted }) {
  const { showAdult } = usePreferences();

  return (
    <>
    <CookieConsentBanner />
    <ReportBugButton />
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/verify-email"
        element={
          <PublicOnlyRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <VerifyEmailPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/complete-username"
        element={
          <ProtectedRoute
            session={session}
            needsUsernameSetup={needsUsernameSetup}
            allowUsernameSetup
          >
            <CompleteUsernamePage
              session={session}
              initialUsername={initialUsername}
              onCompleted={onUsernameCompleted}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <AppHomePage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/search"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <SearchPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      {/* Not linked anywhere unless showAdult is on (Navbar) — AdultPage also
          self-guards (redirects to "/" if showAdult is off), since a direct
          URL visit skips the Navbar entirely. */}
      <Route
        path="/adult"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <AdultPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/movies"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <MoviesPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/movies/:id"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <MoviePage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/shows"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ShowsPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/shows/:id"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ShowPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/shows/:id/seasons/:seasonNumber"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <SeasonPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/shows/:id/seasons/:seasonNumber/episodes/:episodeNumber"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <EpisodePage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/collections"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <CollectionsPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/collections/:id"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <CollectionPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/my-services"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <MyServicesPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/people"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <PeoplePage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/people/:id"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <PersonPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route path="/movies/tmdb/:tmdbId" element={<TmdbRedirect kind="movies" />} />
      <Route path="/shows/tmdb/:tmdbId" element={<TmdbRedirect kind="shows" />} />
      <Route path="/people/tmdb/:tmdbId" element={<TmdbRedirect kind="people" />} />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ReleasesCalendarPage session={session} showAdult={showAdult} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/about"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <AboutPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/help"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <HelpPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/terms"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <TermsPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/contact"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ContactPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/privacy"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <PrivacyPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/certifications"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <CertificationsInfoPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/updates"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <UpdatesPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <SubscriptionPage session={session} />
          </PublicRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <SettingsPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/watchlists"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <WatchlistsPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/follows"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <FollowsPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <UserSearchPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ActivityFeedPage session={session} showAdult={showAdult} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/observe-requests"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ObserveRequestsPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <NotificationsPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/u/:username"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ProfilePage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/u/:username/observers"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ObserveListPage session={session} kind="observers" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/u/:username/observing"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ObserveListPage session={session} kind="observing" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/u/:username/ratings"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ProfileRatingsPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <EditProfilePage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ImportPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute session={session}>
            <AdminPage session={session} />
          </AdminRoute>
        }
      >
        <Route index element={<StatsPage />} />
        <Route path="reward-codes" element={<RewardCodesPage />} />
        <Route path="tier-rewards" element={<TierRewardsPage />} />
        <Route path="early-adopters" element={<EarlyAdoptersPage />} />
        <Route path="users" element={<UserLookupPage />} />
        <Route path="referrals" element={<ReferralLeaderboardPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="catalog-stats" element={<CatalogStatsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
