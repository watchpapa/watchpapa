import Navbar from "../components/layout/Navbar.jsx";
import Footer from "../components/layout/Footer.jsx";

function AppLayout({ session, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#111320] text-white">
      <Navbar session={session} />
      <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  );
}

export default AppLayout;
