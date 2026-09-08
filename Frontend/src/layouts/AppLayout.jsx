import { useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/layout/Navbar.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import Footer from "../components/layout/Footer.jsx";
import BottomTabBar from "../components/layout/BottomTabBar.jsx";
import MobileDrawer from "../components/layout/MobileDrawer.jsx";
import { AccountMenuContent } from "../components/layout/AccountMenu.jsx";
import AuthPromptModal from "../components/AuthPromptModal.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import EarlyAdopterBanner from "../components/subscription/EarlyAdopterBanner.jsx";
import TierRewardModal from "../components/subscription/TierRewardModal.jsx";

// Main app shell. Owns the chrome overlays (drawer, "You" account sheet,
// sign-in prompt) so both the header and the phone tab bar can open them.
function AppLayout({ session, children, breadcrumbs }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const { pathname } = useLocation();

  // Close chrome overlays on navigation (state adjusted during render, per
  // React's "adjusting state when a prop changes" pattern — no effect needed).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setDrawerOpen(false);
    setAccountOpen(false);
  }

  return (
    <div className="flex min-h-svh flex-col bg-bg pb-tabbar text-white md:pb-0 landscape-short:pb-0">
      <Navbar session={session} onOpenDrawer={() => setDrawerOpen(true)} onAuthPrompt={() => setAuthPrompt(true)} />
      <EarlyAdopterBanner session={session} />
      <TierRewardModal session={session} />
      <Breadcrumbs items={breadcrumbs} />
      <main className="flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8">{children}</main>
      <Footer />

      <BottomTabBar
        onOpenBrowse={() => setDrawerOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
        onAuthPrompt={() => setAuthPrompt(true)}
      />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onAuthPrompt={() => setAuthPrompt(true)} />
      <Sheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Account" maxHeight="90svh">
        <AccountMenuContent onNavigate={() => setAccountOpen(false)} />
      </Sheet>
      {authPrompt && <AuthPromptModal onClose={() => setAuthPrompt(false)} />}
    </div>
  );
}

export default AppLayout;
