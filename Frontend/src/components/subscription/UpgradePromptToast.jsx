import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";

function UpgradePromptToast({ message, onDismiss, session }) {
  const [referralCode, setReferralCode] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profile")
      .select("referral_code")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.referral_code) setReferralCode(data.referral_code); });
  }, [session?.user?.id]);

  const referralUrl = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : null;

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard?.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!referralUrl) return;
    navigator.share?.({ title: "Join watchpapa", url: referralUrl });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md px-4"
        style={{ animation: "fadeScaleIn 0.2s ease-out forwards", transform: "translate(-50%, -50%)" }}
      >
        <div className="rounded-2xl border border-amber-600/60 bg-[#1a1200] shadow-2xl shadow-black/70">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-amber-800/40 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-amber-300">Follow limit reached</p>
              <p className="mt-0.5 text-sm text-amber-200/70">
                {message ?? "You've hit the follow limit for your current plan."}
              </p>
            </div>
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-amber-600 transition hover:bg-amber-900/40 hover:text-amber-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <p className="text-sm text-amber-100/60">
              Upgrade your plan to follow more shows and movies. Invite a friend with your referral link and you both unlock a higher limit for free.
            </p>

            {/* Referral link */}
            {referralUrl && (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">Your referral link</p>
                <div className="flex items-center gap-2 rounded-xl border border-amber-800/50 bg-amber-950/60 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-amber-300">
                    {referralUrl}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={handleCopy}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-400 transition hover:bg-amber-800/40 hover:text-amber-200"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    {typeof navigator !== "undefined" && navigator.share && (
                      <button
                        onClick={handleShare}
                        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-400 transition hover:bg-amber-800/40 hover:text-amber-200"
                      >
                        Share
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-amber-800/30 px-5 py-4">
            <Link
              to="/subscription"
              onClick={onDismiss}
              className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-center text-sm font-bold text-black transition hover:bg-amber-400"
            >
              See Plans
            </Link>
            <button
              onClick={onDismiss}
              className="rounded-xl border border-amber-800/50 px-4 py-2 text-sm font-semibold text-amber-500 transition hover:border-amber-600 hover:text-amber-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default UpgradePromptToast;
