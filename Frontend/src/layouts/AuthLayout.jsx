import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer.jsx";
import PosterBackground from "../components/layout/PosterBackground.jsx";
import watchpapaBanner from "../assets/branding/watchpapa-banner.svg";

function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col text-[#8383e7]">
      <PosterBackground />
      <main className="mx-auto flex w-full flex-1 flex-col items-center px-4 pb-3 pt-[clamp(12px,3.5vh,34px)] sm:px-8">
        <Link
          to="/"
          className="mb-[clamp(10px,3vh,28px)]"
          style={{ animation: "authFormIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          <img
            src={watchpapaBanner}
            alt="watchpapa"
            className="w-full max-w-[85vw] drop-shadow-[0_9.59px_9.59px_rgba(0,0,0,0.25)] sm:max-w-[min(700px,58vw)]"
          />
        </Link>
        <div
          className="flex w-full justify-center"
          style={{ animation: "authFormIn 0.6s 0.08s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default AuthLayout;
