import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import AppLayout from "../../layouts/AppLayout.jsx";

function TmdbResolvePage({ type, session }) {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    if (!session?.access_token) {
      setError("This title is not in watchpapa yet.");
      return;
    }

    fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, tmdbId: Number(tmdbId) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.localId) { setError("Could not load this content. Please try again."); return; }
        const path =
          type === "movie" ? `/movies/${data.localId}` :
          type === "show"  ? `/shows/${data.localId}`  :
                             `/people/${data.localId}`;
        navigate(path, { replace: true, state: { injecting: true } });
      })
      .catch(() => setError("Could not load this content. Please try again."));
  }, [tmdbId, type, session?.access_token, navigate]);

  return (
    <AppLayout session={session}>
      <div className="flex h-64 items-center justify-center">
        {error
          ? (
            <div className="text-center text-[#a0a0e8]">
              <p className="text-2xl font-bold">{error.split("\n")[0]}</p>
              <p>
                <button
                  type="button"
                  onClick={() => setShowAuthPrompt(true)}
                  className="font-semibold underline decoration-[#a0a0e8]/70 underline-offset-2 transition hover:text-white"
                >
                  Sign in
                </button>
                {" and we will automatically add it so you can view the details."}
              </p>
              <p>While logged out, you can only view titles that are already in watchpapa.</p>
            </div>
          )
          : <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a2d50] border-t-[#5050a0]" />
        }
      </div>
      {showAuthPrompt ? <AuthPromptModal onClose={() => setShowAuthPrompt(false)} /> : null}
    </AppLayout>
  );
}

export default TmdbResolvePage;
