import { NavLink, Outlet } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";

function AdminPage({ session }) {
  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Admin", to: "/admin" }]}>
      <div className="flex gap-8">
        <nav className="w-44 shrink-0">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#4a4a8a]">Admin</p>
          <ul className="space-y-1">
            <li>
              <NavLink
                to="/admin/reward-codes"
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-[#141728] font-semibold text-white"
                      : "text-[#8080a8] hover:bg-[#141728] hover:text-white"
                  }`
                }
              >
                Reward Codes
              </NavLink>
            </li>
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}

export default AdminPage;
