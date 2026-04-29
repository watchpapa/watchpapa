import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase.js";
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
import TmdbResolvePage from "./pages/app/TmdbResolvePage.jsx";
import ReleasesCalendarPage from "./pages/app/ReleasesCalendarPage.jsx";
import {
  AboutPage,
  ContactPage,
  HelpPage,
  PrivacyPage,
  TermsPage,
} from "./pages/app/static/StaticInfoPages.jsx";

function PublicOnlyRoute({ session, needsUsernameSetup, children }) {
  if (session) {
    return <Navigate to={needsUsernameSetup ? "/complete-username" : "/"} replace />;
  }
  return children;
}

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

function PublicRoute({ session, needsUsernameSetup, children }) {
  if (session && needsUsernameSetup) {
    return <Navigate to="/complete-username" replace />;
  }
  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [initialUsername, setInitialUsername] = useState("");
  const [showAdult, setShowAdult] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      const nextSession = data.session ?? null;

      if (!nextSession) {
        if (!isMounted) return;
        setSession(null);
        setIsSessionLoading(false);
        return;
      }

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
      setShowAdult(false);
      setIsProfileLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsProfileLoading(true);
    supabase
      .from("profile")
      .select("username, is_adult, date_of_birth, setting_display_adult_content")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setNeedsUsernameSetup(false);
          setInitialUsername("");
          setIsProfileLoading(false);
          return;
        }

        const nextUsername = data?.username?.trim() ?? "";
        setInitialUsername(nextUsername);
        setNeedsUsernameSetup(nextUsername.length === 0);
        setShowAdult(data?.setting_display_adult_content ?? false);
        setIsProfileLoading(false);

        if (data && !data.is_adult && data.date_of_birth) {
          const dob = new Date(data.date_of_birth);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
          if (age >= 18) {
            supabase
              .from("profile")
              .update({ is_adult: true, updated_at: new Date().toISOString() })
              .eq("id", session.user.id)
              .then(() => {});
          }
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
        element={
          <PublicOnlyRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        }
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
              onCompleted={(nextUsername) => {
                const normalizedUsername = nextUsername?.trim() ?? "";
                setInitialUsername(normalizedUsername);
                setNeedsUsernameSetup(normalizedUsername.length === 0);
              }}
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
        path="/shows/:id/seasons/:seasonId"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <SeasonPage session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/shows/:id/seasons/:seasonId/episodes/:episodeId"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <EpisodePage session={session} showAdult={showAdult} />
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
      <Route
        path="/movies/tmdb/:tmdbId"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <TmdbResolvePage type="movie" session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/shows/tmdb/:tmdbId"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <TmdbResolvePage type="show" session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/people/tmdb/:tmdbId"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <TmdbResolvePage type="person" session={session} showAdult={showAdult} />
          </PublicRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <PublicRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ReleasesCalendarPage session={session} showAdult={showAdult} />
          </PublicRoute>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
