import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { usePersonData } from "../../features/person/hooks/usePersonData.js";
import { SORTS, sortCredits, filterCredits } from "../../features/person/lib/filmography.js";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Select from "../../components/ui/Select.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { ageFromDate } from "../../lib/validate.js";
import { FilmIcon, UserIcon } from "../../components/icons/index.jsx";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ProfilePicture({ name, profilePath }) {
  const imgSrc = tmdbImg(profilePath, "w342");
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
      {imgSrc ? (
        <img src={imgSrc} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-4 text-border-strong">
          <UserIcon size={40} />
          <span className="line-clamp-4 text-center text-sm font-medium leading-tight">{name}</span>
        </div>
      )}
    </div>
  );
}

function FilmographyCard({ credit }) {
  const imgSrc = tmdbImg(credit.posterPath, "w185");
  const to = credit.type === "movie" ? `/movies/${credit.mediaId}` : `/shows/${credit.mediaId}`;
  const roleText = credit.roles.length > 0 ? `as ${[...new Set(credit.roles)].join(" / ")}` : null;
  const jobText = credit.jobs.length > 0 ? [...new Set(credit.jobs.map((j) => j.job))].join(" · ") : null;
  const subtitle = [roleText, jobText].filter(Boolean).join(" · ") || "—";
  const showRating = credit.voteCount >= 20;

  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong hover:bg-surface-2">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-4">
        {imgSrc ? (
          <img src={imgSrc} alt={credit.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-border-strong"><FilmIcon size={14} /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-semibold leading-tight text-white">
          {credit.title}
          {credit.year && <span className="ml-1.5 font-normal text-text-dim">({credit.year})</span>}
        </p>
        <p className="line-clamp-1 text-xs text-text-dim">{subtitle}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
          <span className={credit.type === "movie" ? "text-text-muted" : "text-[#a088c8]"}>{credit.type === "movie" ? "Movie" : "Show"}</span>
          {credit.type === "show" && credit.episodeCount ? <span className="text-text-faint">· {credit.episodeCount} eps</span> : null}
        </p>
      </div>
      {showRating && (
        <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-[#e8c04a]">★ {credit.voteAverage.toFixed(1)}</span>
      )}
    </Link>
  );
}

function PersonPage({ session, showAdult }) {
  const { id } = useParams();
  const { person, knownForDepartment, nicknames, credits, departments, isLoading, error } = usePersonData(id, showAdult);
  const [sort, setSort] = useState("newest");
  const [kind, setKind] = useState("all");
  const [department, setDepartment] = useState("all");

  const filmography = useMemo(
    () => sortCredits(filterCredits(credits, { kind, department }), sort),
    [credits, kind, department, sort],
  );

  const breadcrumbs = person ? [{ label: "People", to: "/people" }, { label: person.name }] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><ErrorNote className="mt-12">{error}</ErrorNote></AppLayout>;
  if (!person) return null;

  const personOgImage = tmdbImg(person.profile_path, "w342");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    ...(person.biography && { description: person.biography.slice(0, 500) }),
    ...(person.profile_path && { image: tmdbImg(person.profile_path, "w342") }),
    ...(person.birthday && { birthDate: person.birthday }),
    ...(person.place_of_birth && { birthPlace: { "@type": "Place", name: person.place_of_birth } }),
    ...(knownForDepartment && { jobTitle: knownForDepartment }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(person.tmdb_id) },
  };

  const movieCount = credits.filter((c) => c.type === "movie").length;
  const showCount = credits.filter((c) => c.type === "show").length;
  const age = person.birthday && !person.deathday ? ageFromDate(person.birthday) : null;
  const meta = [
    knownForDepartment && <span key="k">{knownForDepartment}</span>,
    person.birthday && <span key="b">Born {fmtDate(person.birthday)}{age != null ? ` (${age})` : ""}</span>,
    person.deathday && <span key="d">Died {fmtDate(person.deathday)}</span>,
    person.place_of_birth && <span key="p">{person.place_of_birth}</span>,
  ];

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={person.name}
        description={person.biography ? person.biography.slice(0, 155) : `Discover ${person.name}'s filmography on watchpapa.`}
        image={personOgImage}
        path={`/people/${id}`}
        jsonLd={jsonLd}
      />
      <DetailPageLayout
        title={person.name}
        subtitle={nicknames.length > 0 ? `Also known as ${nicknames.slice(0, 3).join(", ")}` : undefined}
        meta={meta}
        poster={<ProfilePicture name={person.name} profilePath={person.profile_path} />}
      >
        {person.biography && (
          <ContentPanel label="Bio">
            <p className="whitespace-pre-line text-sm leading-relaxed text-text">{person.biography}</p>
          </ContentPanel>
        )}

        {credits.length > 0 && (
          <ContentPanel label="Filmography">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <PillTabs
                size="sm"
                aria-label="Filmography type"
                tabs={[
                  { value: "all", label: "All", count: credits.length },
                  { value: "movie", label: "Movies", count: movieCount },
                  { value: "show", label: "Shows", count: showCount },
                ]}
                value={kind}
                onChange={setKind}
                className="w-fit max-w-full"
              />
              <Select size="sm" value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} aria-label="Sort filmography" />
            </div>

            {departments.length > 1 && (
              <PillTabs
                size="sm"
                aria-label="Department"
                className="mb-4 w-fit max-w-full"
                tabs={[{ value: "all", label: "All roles" }, ...departments.map((d) => ({ value: d, label: d }))]}
                value={department}
                onChange={setDepartment}
              />
            )}

            {filmography.length === 0 ? (
              <EmptyState compact title="Nothing matches this filter." />
            ) : (
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {filmography.map((c) => <FilmographyCard key={c.key} credit={c} />)}
              </div>
            )}
          </ContentPanel>
        )}

        <ContentPanel label="Details">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Name", fmt(person.name)],
              ...(nicknames.length > 0 ? [["Also known as", nicknames.join(", ")]] : []),
              ...(knownForDepartment ? [["Known for", knownForDepartment]] : []),
              ["Birthday", fmtDate(person.birthday)],
              ["Place of birth", fmt(person.place_of_birth)],
              ...(person.deathday ? [["Died", fmtDate(person.deathday)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="shrink-0 font-semibold text-heading">{k}:</dt>
                <dd className="min-w-0 break-words text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </ContentPanel>
      </DetailPageLayout>
    </AppLayout>
  );
}

export default PersonPage;
