// Floating "report a bug" link. Sits above the phone tab bar and below every
// sheet/modal (z-60 < Sheet z-90 < Modal z-100). Icon-only on small phones.
function ReportBugButton() {
  return (
    <a
      href="https://forms.gle/VeLj9nSa2zNfxfCYA"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-3 z-[60] flex h-10 items-center gap-2 rounded-full border border-brand bg-gradient-to-b from-[rgba(8,11,46,0.92)] to-[rgba(14,19,66,0.96)] px-3 text-[13px] font-extrabold text-heading shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-[10px] transition hover:text-[#a0a0f7] hover:shadow-[0_4px_20px_rgba(131,131,231,0.25)] sm:right-5 sm:px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-5 landscape-short:bottom-3"
      aria-label="Report a bug"
      title="Report a bug"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h8M8 6a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4" />
        <path d="M10 6V4a2 2 0 1 1 4 0v2" />
        <path d="M4 11H2M22 11h-2M12 15v4M8 19h8" />
      </svg>
      <span className="hidden sm:inline">Report a bug</span>
    </a>
  );
}

export default ReportBugButton;
