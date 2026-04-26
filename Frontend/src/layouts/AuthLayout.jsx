import Footer from "../components/layout/Footer.jsx";
import watchpapaBanner from "../assets/branding/watchpapa-banner.svg";

function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#181d35] to-[#111320] text-[#8383e7]">
      <main className="mx-auto flex w-full flex-1 flex-col items-center px-4 pb-6 pt-[clamp(12px,3.5vh,34px)] sm:px-8">
        <img
          src={watchpapaBanner}
          alt="watchpapa"
          className="mb-[clamp(12px,4vh,36px)] w-full max-w-[85vw] drop-shadow-[0_9.59px_9.59px_rgba(0,0,0,0.25)] sm:max-w-[min(700px,58vw)]"
        />
        <div className="flex w-full justify-center origin-top lg:scale-[0.82]">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default AuthLayout;
