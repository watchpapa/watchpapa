import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import SearchBar from "../../components/home/SearchBar.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import LoadMoreButton from "../../components/ui/LoadMoreButton.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { usePeoplePageData } from "../../features/people/hooks/usePeoplePageData.js";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { UserIcon } from "../../components/icons/index.jsx";

const GRID = "grid grid-cols-2 gap-3 xs:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-8";

function fmtYear(val) {
  return val ? new Date(val).getFullYear() : null;
}

function PersonCard({ person, rank }) {
  const born = fmtYear(person.birthday);
  const line = [person.known_for_department, born && `b. ${born}`].filter(Boolean).join(" · ");
  return (
    <Link
      to={`/people/${person.id}`}
      className="group flex flex-col gap-2 rounded-2xl border border-border/50 bg-surface/70 p-2 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_14px_30px_-16px_rgba(111,111,220,0.5)] sm:p-3"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface-4">
        {person.profile_path ? (
          <img src={tmdbImg(person.profile_path, "w342")} alt={person.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-border-strong"><UserIcon size={36} /></div>
        )}
        {rank != null && (
          <span className="absolute left-2 top-2 rounded-md bg-[#0a0c23]/85 px-1.5 py-0.5 text-[10px] font-bold text-text-muted backdrop-blur-sm">#{rank}</span>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{person.name}</p>
        {line && <p className="mt-0.5 line-clamp-1 text-[11px] text-text-dim">{line}</p>}
        {person.place_of_birth && <p className="line-clamp-1 text-[11px] text-text-faint">{person.place_of_birth}</p>}
      </div>
    </Link>
  );
}

function SkeletonCards({ count = 12 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="rounded-2xl border border-border/50 bg-surface/70 p-2 sm:p-3" aria-hidden>
      <Skeleton className="aspect-[3/4] rounded-xl" />
      <Skeleton className="mt-2 h-3.5 w-3/4" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
    </div>
  ));
}

function PeoplePage({ session, showAdult }) {
  const [search, setSearch] = useState("");
  const { people, isLoading, isLoadingMore, hasMore, loadMore, error } = usePeoplePageData(showAdult);

  return (
    <AppLayout session={session}>
      <PageHead title="People" description="Browse popular actors, directors and crew on watchpapa." path="/people" />
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Popular People" subtitle="Actors, directors and crew trending right now.">
          <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} maxWidthClass="max-w-[640px]" />
        </PageHeader>

        {error && <ErrorNote>Failed to load people: {error}</ErrorNote>}

        <div className={GRID}>
          {isLoading ? (
            <SkeletonCards />
          ) : (
            <>
              {people.map((person, i) => <PersonCard key={person.id} person={person} rank={i + 1} />)}
              {isLoadingMore && <SkeletonCards count={6} />}
            </>
          )}
        </div>

        {!isLoading && <LoadMoreButton onClick={loadMore} loading={isLoadingMore} hasMore={hasMore} />}
      </PageContainer>
    </AppLayout>
  );
}

export default PeoplePage;
