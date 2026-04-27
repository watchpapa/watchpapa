import Navbar from "../components/layout/Navbar.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import Footer from "../components/layout/Footer.jsx";

function AppLayout({ session, children, breadcrumbs }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#111320] text-white">
      <Navbar session={session} />
      <Breadcrumbs items={breadcrumbs} />
      <main className="flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  );
}

export default AppLayout;
