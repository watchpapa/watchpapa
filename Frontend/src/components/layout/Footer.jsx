import { Link } from "react-router-dom";
import { TMDB_ATTRIBUTION_URL } from "../../lib/constants.js";
import tmdbLogo from "../../assets/branding/tmdb-blue-short.svg";
import watchpapaLogo from "../../assets/branding/watchpapa-banner.svg";

const ALL_LINKS = [
  { label: "About", to: "/about" },
  { label: "Updates", to: "/updates" },
  { label: "Plans", to: "/subscription" },
  { label: "Help", to: "/help" },
  { label: "Certifications", to: "/certifications" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

function Footer() {
  return (
    <footer className="relative border-t border-border/30 bg-[#0a0c14] px-4 py-5 pb-safe sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" aria-hidden />
      <div className="mx-auto max-w-[1600px] space-y-4 3xl:max-w-[1920px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <Link to="/" className="shrink-0 sm:mr-2">
            <img src={watchpapaLogo} alt="watchpapa" className="h-5 w-auto" />
          </Link>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-2 xs:grid-cols-4 sm:flex sm:flex-wrap sm:gap-x-6">
            {ALL_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="min-h-6 text-xs text-[#6a6a9a] transition hover:text-accent">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[11px] text-[#3a3c58]">&copy; 2026 watchpapa.tv</p>
          <span className="text-[11px] text-[#1e2035]">&mdash;</span>
          <a href={TMDB_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 opacity-50 transition hover:opacity-80" aria-label="Film and TV data provided by The Movie Database">
            <span className="text-[10px] font-medium uppercase tracking-widest text-[#5c5f75]">Data by</span>
            <img src={tmdbLogo} alt="TMDB" className="h-[9px] w-auto" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
