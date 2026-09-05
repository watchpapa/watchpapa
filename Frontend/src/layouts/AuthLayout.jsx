import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer.jsx";
import PosterBackground from "../components/layout/PosterBackground.jsx";
import watchpapaBanner from "../assets/branding/watchpapa-banner.svg";

// Minimal shell for auth pages: poster wall, logo, one centred card.
function AuthLayout({ children }) {
  return (
    <div className="flex min-h-svh flex-col text-text">
      <PosterBackground />
      <main className="mx-auto flex w-full flex-1 flex-col items-center px-4 pb-6 pt-6 sm:px-8 sm:pt-10 landscape-short:pt-3">
        <Link to="/" className="mb-5 animate-auth-form-in sm:mb-8 landscape-short:mb-3" aria-label="watchpapa home">
          <img
            src={watchpapaBanner}
            alt="watchpapa"
            className="w-[200px] drop-shadow-[0_8px_10px_rgba(0,0,0,0.35)] sm:w-[260px] lg:w-[300px] landscape-short:w-[160px]"
          />
        </Link>
        <div className="flex w-full animate-auth-form-in justify-center [animation-delay:80ms]">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export default AuthLayout;
