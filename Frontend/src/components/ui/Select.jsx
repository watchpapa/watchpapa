// Minimal styled <select> — the app had no select/dropdown component before;
// this mirrors the ad hoc select markup already used on ProfileRatingsPage /
// ManageFollowsModal so language/country/region pickers look consistent.
function Select({ value, onChange, options, disabled = false, className = "" }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`rounded-lg border border-[#3a3a7a] bg-[#1a1d35] px-3 py-2 text-sm text-white transition hover:border-[#5a5aaa] disabled:opacity-50 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default Select;
