import { footerLinks } from "../../lib/constants.js";
import tmdbLogo from "../../assets/branding/tmdb-blue-short.svg";

function Footer() {
  return (
    <footer className="border-t border-[#1b1e30] bg-gradient-to-b from-[#0c0f1a] to-[#0a0c14] px-4 py-3 lg:px-[4.05%] lg:py-2">
      <ul className="mx-auto mb-2 flex max-w-[1588px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[15px] font-semibold tracking-[0.01em] text-[#7a7ae7] sm:text-[17px] lg:mb-1 lg:flex-nowrap lg:justify-between lg:gap-0 lg:text-[21px]">
        {footerLinks.map((label) => (
          <li key={label}>
            <a
              href="#"
              className="rounded px-1 py-0.5 transition hover:text-[#a3a3ff] hover:underline hover:decoration-[#6f6fdc]/70 hover:underline-offset-4"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-center text-[11px] font-medium leading-tight text-[#5c5f75] sm:text-xs lg:text-[14px]">
        Copyright &copy; 2026 watchpapa.tv. All rights reserved. Film and shows data
        from{" "}
        <img
          src={tmdbLogo}
          alt="TMDB"
          className="ml-1 inline-block h-[11px] w-auto align-[-1px] lg:h-[13px]"
        />
        .
      </p>
    </footer>
  );
}

export default Footer;
