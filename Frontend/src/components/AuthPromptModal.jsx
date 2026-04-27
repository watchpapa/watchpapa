import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AuthPromptModal({ onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#2a2d60] bg-[#0d0f1e] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-extrabold text-white">Create a free account</h2>
        <p className="mb-6 text-sm text-[#8888c8]">
          Sign up to follow titles and get a personalised releases calendar.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate("/register")}
            className="w-full rounded-xl border border-[#5050b0] bg-[#2a2d60] py-2.5 text-sm font-bold text-white transition hover:bg-[#3a3d80]"
          >
            Create account
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-full rounded-xl border border-[#3a3a7a] bg-transparent py-2.5 text-sm font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
          >
            Sign in
          </button>
          <button
            onClick={onClose}
            className="mt-1 text-xs text-[#4a4a7a] transition hover:text-[#8888c8]"
          >
            Continue without an account
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthPromptModal;
