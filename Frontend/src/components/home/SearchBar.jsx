function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#5a5a9a]">
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder=""
        className="w-full rounded-2xl border border-[#2a2d50] bg-[#141728] py-3 pl-11 pr-4 text-sm text-white placeholder-[#4a4a7a] outline-none transition focus:border-[#5050a0] focus:ring-1 focus:ring-[#5050a0]"
      />
    </div>
  );
}

export default SearchBar;
