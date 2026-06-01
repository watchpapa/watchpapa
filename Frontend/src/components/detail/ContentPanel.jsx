function ContentPanel({ label, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-[#2a3570]/50 bg-[#141728]/70 p-5 backdrop-blur-sm ${className}`}>
      {label && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c084fc]">{label}</p>
      )}
      {children}
    </div>
  );
}

export default ContentPanel;
