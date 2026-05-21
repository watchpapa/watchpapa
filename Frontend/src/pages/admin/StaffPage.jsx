import { useEffect, useState } from "react";
import { useStaff } from "../../features/admin/hooks/useStaff.js";
import { supabase } from "../../lib/supabase.js";

const ROLE_LABEL = { 3: "Moderator", 4: "Admin" };
const ROLE_COLORS = {
  3: "border-sky-700/50 bg-sky-900/30 text-sky-400",
  4: "border-violet-700/50 bg-violet-900/30 text-violet-400",
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[role] ?? ""}`}>
      {ROLE_LABEL[role] ?? `Role ${role}`}
    </span>
  );
}

function StaffRow({ member, currentUserId, onRoleChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isSelf = member.id === currentUserId;

  const change = async (newRole) => {
    if (!window.confirm(
      newRole === 0
        ? `Remove staff access from @${member.username ?? member.email}?`
        : `Change @${member.username ?? member.email} to ${ROLE_LABEL[newRole]}?`
    )) return;
    setBusy(true);
    setError(null);
    try {
      await onRoleChange(member.id, newRole);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-[#1e244a] bg-[#0e1128] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              @{member.username ?? "—"}
            </p>
            <RoleBadge role={member.role} />
            {isSelf && (
              <span className="rounded-full border border-[#2a3570] px-2 py-0.5 text-[10px] text-[#5a5a78]">you</span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[#6868b8]">{member.email}</p>
          <p className="mt-0.5 font-mono text-[10px] text-[#4a4a8a]">{member.id}</p>
          <p className="mt-0.5 text-[10px] text-[#4a4a8a]">
            Joined {new Date(member.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {!isSelf && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {Number(member.role) === 3 && (
              <button
                onClick={() => change(4)}
                disabled={busy}
                className="rounded-lg border border-violet-700/50 px-3 py-1.5 text-[12px] font-semibold text-violet-400 transition hover:bg-violet-900/20 disabled:opacity-50"
              >
                {busy ? "…" : "Promote to Admin"}
              </button>
            )}
            {Number(member.role) === 4 && (
              <button
                onClick={() => change(3)}
                disabled={busy}
                className="rounded-lg border border-sky-700/50 px-3 py-1.5 text-[12px] font-semibold text-sky-400 transition hover:bg-sky-900/20 disabled:opacity-50"
              >
                {busy ? "…" : "Demote to Moderator"}
              </button>
            )}
            <button
              onClick={() => change(0)}
              disabled={busy}
              className="rounded-lg border border-red-700/50 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition hover:bg-red-900/20 disabled:opacity-50"
            >
              {busy ? "…" : "Revoke access"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-[12px] font-semibold text-pink-300">{error}</p>}
    </div>
  );
}

function StaffPage() {
  const { staff, isLoading, error, fetchStaff, setRole } = useStaff();
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchStaff();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setCurrentUserId(session.user.id);
    });
  }, [fetchStaff]);

  const handleRoleChange = async (id, role) => {
    await setRole(id, role);
    await fetchStaff();
  };

  const admins = staff.filter((m) => Number(m.role) === 4);
  const moderators = staff.filter((m) => Number(m.role) === 3);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[20px] font-extrabold text-white">Staff</h1>
        <p className="mt-1 text-[12px] text-[#5a5a78]">
          Accounts with elevated roles — admins (role 4) and moderators (role 3).
        </p>
      </div>

      {isLoading && <p className="text-sm text-[#5a5a78]">Loading...</p>}
      {error && <p className="text-sm font-semibold text-pink-300">{error}</p>}

      {!isLoading && !error && (
        <div className="space-y-6">
          {admins.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
                Admins — {admins.length}
              </p>
              <div className="space-y-3">
                {admins.map((m) => (
                  <StaffRow key={m.id} member={m} currentUserId={currentUserId} onRoleChange={handleRoleChange} />
                ))}
              </div>
            </section>
          )}

          {moderators.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
                Moderators — {moderators.length}
              </p>
              <div className="space-y-3">
                {moderators.map((m) => (
                  <StaffRow key={m.id} member={m} currentUserId={currentUserId} onRoleChange={handleRoleChange} />
                ))}
              </div>
            </section>
          )}

          {admins.length === 0 && moderators.length === 0 && (
            <p className="text-sm text-[#5a5a78]">No staff accounts found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default StaffPage;
