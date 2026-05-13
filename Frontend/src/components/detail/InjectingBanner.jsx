import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 180; // 5 minutes

async function isInjectionDone(type, id) {
  if (type === "movie") {
    const { data } = await supabase.from("movie").select("status").eq("id", id).single();
    return !!data?.status;
  }
  if (type === "show") {
    const { data } = await supabase.from("show").select("status").eq("id", id).single();
    return !!data?.status;
  }
  // person
  const { data } = await supabase.from("person").select("known_for_department").eq("id", id).single();
  return data?.known_for_department != null;
}

function InjectingBanner({ type, id }) {
  const { state } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!state?.injecting || dismissed || !type || !id) return;

    const timer = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      try {
        const done = await isInjectionDone(type, id);
        if (done) {
          clearInterval(timer);
          window.history.replaceState({}, "", window.location.href);
          window.location.reload();
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [state?.injecting, dismissed, type, id]);

  if (!state?.injecting || dismissed) return null;

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#3a3a20] bg-[#1e1e0a] px-5 py-4 text-sm text-[#c8b86a]">
      <div className="flex items-start gap-3">
        {timedOut ? (
          <svg className="mt-0.5 flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
        ) : (
          <svg className="mt-0.5 flex-shrink-0 animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        <p>
          {timedOut
            ? "Processing is taking longer than expected — all details should be available within an hour. You can refresh the page then to see full cast, crew and metadata."
            : "This title was just added and is being processed in the background — cast, crew, genres and all metadata are loading. The page will refresh automatically when ready."}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="flex-shrink-0 text-[#7a6a30] hover:text-[#c8b86a] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default InjectingBanner;
