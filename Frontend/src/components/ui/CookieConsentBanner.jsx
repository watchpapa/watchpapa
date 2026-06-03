import { useState } from "react";
import { acceptCookies, declineCookies, hasMadeChoice } from "../../lib/cookieConsent.js";

function CookieConsentBanner() {
  const [dismissed, setDismissed] = useState(() => hasMadeChoice());

  if (dismissed) return null;

  const handleAccept = () => {
    acceptCookies();
    setDismissed(true);
  };

  const handleDecline = () => {
    declineCookies();
    setDismissed(true);
  };

  return (
    <>
    <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" />
    <div className="fixed bottom-0 left-0 right-0 z-[9999] border-t-2 border-[#4a4aaa] bg-[#0b0d1c] shadow-[0_-4px_32px_rgba(0,0,0,0.6)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex-1">
          <p className="mb-1 text-sm font-semibold text-white">Session storage</p>
          <p className="text-sm text-[#b0b0d8] leading-relaxed">
            Accept to keep you signed in across tabs and browser restarts. If you decline, your session will end
            when you close the tab.{" "}
            <a href="/privacy" className="text-[#8888e8] underline underline-offset-2 hover:text-white transition">
              Privacy policy
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={handleDecline}
            className="rounded-xl border border-[#3a3a7a] bg-[#12143a] px-5 py-2.5 text-sm font-semibold text-[#8888c8] transition hover:border-[#5a5aaa] hover:text-white"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="rounded-xl bg-[#4a4aaa] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#4a4aaa]/30 transition hover:bg-[#6060c8]"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

export default CookieConsentBanner;
