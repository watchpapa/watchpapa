function ReportBugButton() {
  return (
    <a
      href="https://forms.gle/VeLj9nSa2zNfxfCYA"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-[9000] flex items-center gap-2 rounded-full border border-[#6f6fdc] bg-gradient-to-b from-[rgba(8,11,46,0.92)] to-[rgba(14,19,66,0.96)] px-4 py-2.5 text-[13px] font-extrabold text-[#8383e7] shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-[10px] transition hover:text-[#a0a0f7] hover:shadow-[0_4px_20px_rgba(131,131,231,0.25)]"
      aria-label="Report a bug"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 6h8M8 6a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4" />
        <path d="M10 6V4a2 2 0 1 1 4 0v2" />
        <path d="M4 11H2M22 11h-2M12 15v4M8 19h8" />
      </svg>
      Report a bug
    </a>
  );
}

export default ReportBugButton;
