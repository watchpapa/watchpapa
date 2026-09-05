import { useEffect, useState } from "react";
import { useStaff } from "../../features/admin/hooks/useStaff.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";

const ROLE_LABEL = { 3: "Moderator", 4: "Admin" };
const ROLE_VARIANT = { 3: "info", 4: "brand" };

function StaffRow({ member, currentUserId, onRoleChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isSelf = member.id === currentUserId;
  const role = Number(member.role);

  const change = async (newRole) => {
    const who = `@${member.username ?? member.email}`;
    if (!window.confirm(newRole === 0 ? `Remove staff access from ${who}?` : `Change ${who} to ${ROLE_LABEL[newRole]}?`)) return;
    setBusy(true);
    setError(null);
    try { await onRoleChange(member.id, newRole); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">@{member.username ?? "—"}</p>
            <Badge variant={ROLE_VARIANT[role] ?? "neutral"}>{ROLE_LABEL[role] ?? `Role ${role}`}</Badge>
            {isSelf && <Badge size="xs">you</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-text-dim">{member.email}</p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-text-faint">{member.id}</p>
          <p className="mt-0.5 text-[10px] text-text-faint">Joined {new Date(member.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        {!isSelf && (
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {role === 3 && <Button variant="secondary" size="xs" onClick={() => change(4)} loading={busy}>Promote to Admin</Button>}
            {role === 4 && <Button variant="secondary" size="xs" onClick={() => change(3)} loading={busy}>Demote to Moderator</Button>}
            <Button variant="danger" size="xs" onClick={() => change(0)} loading={busy}>Revoke access</Button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-300">{error}</p>}
    </div>
  );
}

function StaffPage() {
  const { staff, isLoading, error, fetchStaff, setRole } = useStaff();
  const { userId } = useCurrentUser();

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleRoleChange = async (id, role) => {
    await setRole(id, role);
    await fetchStaff();
  };

  const admins = staff.filter((m) => Number(m.role) === 4);
  const moderators = staff.filter((m) => Number(m.role) === 3);

  return (
    <div>
      <PageHeader size="sm" title="Staff" subtitle="Accounts with elevated roles — admins (role 4) and moderators (role 3)." />
      {isLoading && <div className="space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {!isLoading && !error && (
        <div className="space-y-6">
          {[["Admins", admins], ["Moderators", moderators]].map(([label, list]) => list.length > 0 && (
            <section key={label}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-faint">{label} — {list.length}</p>
              <div className="space-y-3">
                {list.map((m) => <StaffRow key={m.id} member={m} currentUserId={userId} onRoleChange={handleRoleChange} />)}
              </div>
            </section>
          ))}
          {admins.length === 0 && moderators.length === 0 && <EmptyState compact title="No staff accounts found." />}
        </div>
      )}
    </div>
  );
}

export default StaffPage;
