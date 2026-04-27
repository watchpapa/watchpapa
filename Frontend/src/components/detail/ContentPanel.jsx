function ContentPanel({ label, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-[#1a1f3a] bg-[#141728] p-5 ${className}`}>
      {label && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">{label}</p>
      )}
      {children}
    </div>
  );
}

export default ContentPanel;
