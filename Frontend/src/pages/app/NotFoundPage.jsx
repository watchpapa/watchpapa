import { useState } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import Button from "../../components/ui/Button.jsx";
import { CompassIcon } from "../../components/icons/index.jsx";

// Catch-all route element. The Cloudflare Pages Function (functions/_middleware.js)
// also serves this same SPA shell with a real HTTP 404 status for URLs it doesn't
// recognize — this component is what actually renders in that case.
function NotFoundPage({ session }) {
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");

  return (
    <AppLayout session={session}>
      <PageHead noindex title="Page not found" path={pathname} />
      <PageContainer width="narrow" className="space-y-8">
        <EmptyState
          icon={CompassIcon}
          title="Page not found"
          description="That page doesn't exist or may have moved. Try searching, or head back home."
        />
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap justify-center gap-3">
          <Button to="/" variant="primary">Go home</Button>
          <Button to="/movies" variant="outline">Movies</Button>
          <Button to="/shows" variant="outline">Shows</Button>
          <Button to="/people" variant="outline">People</Button>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

export default NotFoundPage;
