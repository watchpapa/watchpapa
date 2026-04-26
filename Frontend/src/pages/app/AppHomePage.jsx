import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import MediaRow from "../../components/home/MediaRow.jsx";
import { useHomeData } from "../../features/home/hooks/useHomeData.js";

function SkeletonRow() {
  return (
    <section>
      <div className="mb-3 h-6 w-32 animate-pulse rounded bg-[#1e2240]" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-[130px] flex-shrink-0 sm:w-[150px]">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#1e2240]" />
            <div className="mt-2 h-3 animate-pulse rounded bg-[#1e2240]" />
            <div className="mt-1.5 mx-auto h-5 w-16 animate-pulse rounded-full bg-[#1e2240]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function AppHomePage({ session }) {
  const [search, setSearch] = useState("");
  const { popular, movieItems, showItems, isLoading, error } = useHomeData(session);

  const sections = [
    { title: "Popular", items: popular },
    { title: "Movies", items: movieItems },
    { title: "Shows", items: showItems },
  ];

  return (
    <AppLayout session={session}>
      <div className="mx-auto max-w-[1600px] space-y-8">
        <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} />

        {error && (
          <p className="text-center text-sm text-red-400">
            Failed to load content: {error}
          </p>
        )}

        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          sections.map(({ title, items }) => (
            <MediaRow key={title} title={title} items={items} />
          ))
        )}
      </div>
    </AppLayout>
  );
}

export default AppHomePage;
