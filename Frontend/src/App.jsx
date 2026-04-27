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
import MoviePage from "./pages/app/MoviePage.jsx";
import ShowPage from "./pages/app/ShowPage.jsx";
import SeasonPage from "./pages/app/SeasonPage.jsx";
import EpisodePage from "./pages/app/EpisodePage.jsx";
import PersonPage from "./pages/app/PersonPage.jsx";
import ReleasesCalendarPage from "./pages/app/ReleasesCalendarPage.jsx";

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

function App() {
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [initialUsername, setInitialUsername] = useState("");

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
      setIsProfileLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsProfileLoading(true);
    supabase
      .from("profile")
      .select("username")
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
        setIsProfileLoading(false);
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
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <AppHomePage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/movies/:id"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <MoviePage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shows/:id"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ShowPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shows/:id/seasons/:seasonId"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <SeasonPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shows/:id/seasons/:seasonId/episodes/:episodeId"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <EpisodePage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/people/:id"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <PersonPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute session={session} needsUsernameSetup={needsUsernameSetup}>
            <ReleasesCalendarPage session={session} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={session ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
