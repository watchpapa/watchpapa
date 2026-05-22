import { NavLink, Outlet } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";

const NAV = [
  {
    section: "Overview",
    links: [
      { to: "/admin",               label: "Stats",        end: true },
      { to: "/admin/analytics",     label: "Analytics" },
      { to: "/admin/early-adopters",label: "Early Adopters" },
    ],
  },
  {
    section: "Users",
    links: [
      { to: "/admin/users",        label: "User Lookup" },
      { to: "/admin/referrals",    label: "Referrals" },
      { to: "/admin/staff",        label: "Staff" },
    ],
  },
  {
    section: "Codes",
    links: [
      { to: "/admin/reward-codes", label: "Reward Codes" },
    ],
  },
  {
    section: "Content",
    links: [
      { to: "/admin/announcements", label: "Announcements" },
      { to: "/admin/resync",        label: "Content Resync" },
    ],
  },
  {
    section: "Logs",
    links: [
      { to: "/admin/audit-log",    label: "Audit Log" },
      { to: "/admin/script-logs",  label: "Script Logs" },
    ],
  },
];

function AdminPage({ session }) {
  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Admin", to: "/admin" }]}>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">

        {/* Mobile: horizontal scrollable tab strip */}
        <nav className="flex overflow-x-auto gap-1 pb-1 sm:hidden">
          {NAV.flatMap(({ links }) => links).map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `shrink-0 rounded-xl px-3 py-2 text-sm transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#141728] font-semibold text-white"
                    : "text-[#8080a8] hover:bg-[#141728] hover:text-white"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop: vertical sidebar */}
        <nav className="hidden sm:block w-44 shrink-0 space-y-5">
          {NAV.map(({ section, links }) => (
            <div key={section}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
                {section}
              </p>
              <ul className="space-y-0.5">
                {links.map(({ to, label, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-[#141728] font-semibold text-white"
                            : "text-[#8080a8] hover:bg-[#141728] hover:text-white"
                        }`
                      }
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}

export default AdminPage;
