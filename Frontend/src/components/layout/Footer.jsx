import { Link } from "react-router-dom";
import { TMDB_ATTRIBUTION_URL } from "../../lib/constants.js";
import tmdbLogo from "../../assets/branding/tmdb-blue-short.svg";
import watchpapaLogo from "../../assets/branding/watchpapa-banner.svg";

const ALL_LINKS = [
  { label: "About", to: "/about" },
  { label: "Updates", to: "/updates" },
  { label: "Subscriptions", to: "/subscription" },
  { label: "Help", to: "/help" },
  { label: "Certifications", to: "/certifications" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

function Footer() {
  return (
    <footer className="relative border-t border-[#2a3570]/30 bg-[#0a0c14] px-4 py-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#6f6fdc]/40 to-transparent" aria-hidden />
      <div className="mx-auto max-w-[1588px] space-y-3">

        {/* Top row: logo + links */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link to="/" className="mr-2 shrink-0">
            <img src={watchpapaLogo} alt="watchpapa" className="h-5 w-auto" />
          </Link>
          {ALL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-xs text-[#6a6a9a] transition hover:text-[#c084fc]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bottom row: copyright + TMDB */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[11px] text-[#2e3048]">
            &copy; 2026 watchpapa.tv
          </p>
          <span className="text-[11px] text-[#1e2035]">&mdash;</span>
          <a
            href={TMDB_ATTRIBUTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 opacity-40 transition hover:opacity-70"
            aria-label="Film and TV data provided by The Movie Database"
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-[#5c5f75]">
              Data by
            </span>
            <img src={tmdbLogo} alt="TMDB" className="h-[9px] w-auto" />
          </a>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
