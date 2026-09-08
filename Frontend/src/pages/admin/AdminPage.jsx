import { NavLink, Outlet, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import { cn } from "../../lib/cn.js";

const NAV = [
  { section: "Overview", links: [{ to: "/admin", label: "Stats", end: true }, { to: "/admin/early-adopters", label: "Early Adopters" }] },
  { section: "Users", links: [{ to: "/admin/users", label: "User Lookup" }, { to: "/admin/referrals", label: "Referrals" }, { to: "/admin/staff", label: "Staff" }] },
  { section: "Rewards", links: [{ to: "/admin/reward-codes", label: "Reward Codes" }, { to: "/admin/tier-rewards", label: "Tier Rewards" }] },
  { section: "Content", links: [{ to: "/admin/catalog-stats", label: "Catalog Stats" }, { to: "/admin/announcements", label: "Announcements" }] },
  { section: "Logs", links: [{ to: "/admin/audit-log", label: "Audit Log" }] },
];

const linkClass = ({ isActive }) =>
  cn(
    "block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition",
    isActive ? "bg-surface-2 font-semibold text-white" : "text-text-muted hover:bg-surface-2 hover:text-white",
  );

// Admin shell: grouped sidebar from `lg`, a scrollable grouped chip strip below.
function AdminPage({ session }) {
  const { pathname } = useLocation();
  const current = NAV.flatMap((g) => g.links).find((l) => (l.end ? pathname === l.to : pathname.startsWith(l.to)));

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Admin", to: "/admin" }, ...(current && current.to !== "/admin" ? [{ label: current.label }] : [])]}>
      <PageContainer width="wide" className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        {/* <lg: grouped horizontal strip */}
        <nav aria-label="Admin sections" className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5 lg:hidden">
          {NAV.map(({ section, links }) => (
            <div key={section} className="flex shrink-0 items-center gap-1 rounded-xl border border-border/40 bg-surface p-1">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-text-faint">{section}</span>
              {links.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} className={linkClass}>{label}</NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* lg+: sidebar */}
        <nav aria-label="Admin sections" className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-20 space-y-5">
            {NAV.map(({ section, links }) => (
              <div key={section}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-text-faint">{section}</p>
                <ul className="space-y-0.5">
                  {links.map(({ to, label, end }) => (
                    <li key={to}><NavLink to={to} end={end} className={linkClass}>{label}</NavLink></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </PageContainer>
    </AppLayout>
  );
}

export default AdminPage;
