import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import Avatar from "../ui/Avatar.jsx";

// A single user row (search results, observer/observing lists).
// Uses the observe_status returned by the RPC so no per-row fetch is needed.
export function UserResultRow({ user, session }) {
  const uid = session?.user?.id ?? null;
  const isSelf = uid && uid === user.id;
  const [status, setStatus] = useState(user.observe_status ?? null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = async () => {
    if (!uid || isSelf || busy) return;
    setBusy(true);
    if (status === "accepted" || status === "pending") {
      const prev = status;
      setStatus(null);
      const { error } = await supabase
        .from("user_observe")
        .delete()
        .eq("observer_id", uid)
        .eq("observed_id", user.id);
      if (error) setStatus(prev);
    } else {
      const { data, error } = await supabase
        .from("user_observe")
        .insert({ observer_id: uid, observed_id: user.id })
        .select("status")
        .single();
      if (!error && data) setStatus(data.status);
    }
    setBusy(false);
  };

  let label;
  let primary = false;
  if (status === "accepted") label = hover ? "Unobserve" : "Observing";
  else if (status === "pending") label = hover ? "Cancel" : "Requested";
  else { label = user.is_private ? "Request" : "Observe"; primary = true; }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] px-3 py-2.5">
      <Link to={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          username={user.username}
          avatarType={user.avatar_type}
          avatarPosterPath={user.avatar_poster_path}
          avatarUploadPath={user.avatar_upload_path}
          size="row"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-white">{user.username}</p>
            {user.is_private && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5050a0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Private account">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </div>
          {user.bio && <p className="truncate text-xs text-[#5050a0]">{user.bio}</p>}
        </div>
      </Link>

      {!isSelf && (
        <button
          onClick={toggle}
          disabled={busy}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            primary
              ? "border border-[#7070d0] bg-[#3a3a8a] text-white hover:bg-[#4a4aaa]"
              : "border border-[#3a3a7a] bg-[#1a1d35] text-[#a0a0e8] hover:border-[#aa5a5a] hover:text-white"
          }`}
        >
          {label}
        </button>
      )}
    </div>
  );
}
