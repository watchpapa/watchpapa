import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";

function TmdbResolvePage({ type, session }) {
  const { tmdbId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, tmdbId: Number(tmdbId) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.localId) { navigate("/", { replace: true }); return; }
        const path =
          type === "movie" ? `/movies/${data.localId}` :
          type === "show"  ? `/shows/${data.localId}`  :
                             `/people/${data.localId}`;
        navigate(path, { replace: true, state: { injecting: true } });
      })
      .catch(() => navigate("/", { replace: true }));
  }, [tmdbId, type, navigate]);

  return (
    <AppLayout session={session}>
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a2d50] border-t-[#5050a0]" />
      </div>
    </AppLayout>
  );
}

export default TmdbResolvePage;
