import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { usePersonData } from "../../features/person/hooks/usePersonData.js";
import { SORTS, sortCredits, filterCredits } from "../../features/person/lib/filmography.js";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ProfilePicture({ name, profilePath }) {
  const imgSrc = tmdbImg(profilePath, "w342");
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] aspect-[2/3] w-full">
      {imgSrc ? (
        <img src={imgSrc} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span className="text-center text-sm font-medium leading-tight text-[#3a3a7a] line-clamp-4">{name}</span>
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
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]">
      <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
        {imgSrc ? (
          <img src={imgSrc} alt={credit.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" /></svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white leading-tight line-clamp-1">
          {credit.title}
          {credit.year && <span className="ml-1.5 font-normal text-[#6868b8]">({credit.year})</span>}
        </p>
        <p className="text-xs text-[#6868b8] line-clamp-1">{subtitle}</p>
      </div>
      {showRating && (
        <span className="flex-shrink-0 rounded-full bg-[#1a1d35] px-2 py-0.5 text-[10px] font-bold text-[#e8c04a]">
          ★ {credit.voteAverage.toFixed(1)}
        </span>
      )}
      {credit.type === "show" && credit.episodeCount ? (
        <span className="flex-shrink-0 text-[10px] font-semibold text-[#6868b8]">{credit.episodeCount} eps</span>
      ) : null}
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${credit.type === "movie" ? "bg-[#1a1d35] text-[#8888c8]" : "bg-[#1d1a35] text-[#a088c8]"}`}>
        {credit.type === "movie" ? "Movie" : "Show"}
      </span>
    </Link>
  );
}

function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === opt.value
              ? "bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] text-white shadow-[0_4px_14px_-6px_rgba(111,111,220,0.8)]"
              : "text-[#8888c8] hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
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

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage withFollow={false} /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
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
        sidebarTop={<ProfilePicture name={person.name} profilePath={person.profile_path} />}
        sidebarBottom={
          <>
            <ul className="space-y-1.5 text-xs">
              {[
                ["Name", fmt(person.name)],
                ["Birthday", fmtDate(person.birthday)],
                ["Popularity", person.popularity?.toFixed(1) ?? "—"],
              ].map(([k, v]) => (
                <li key={k}><span className="font-bold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
              ))}
            </ul>
          </>
        }
      >
        <ContentPanel label="Details">
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {[
              ["Name", fmt(person.name)],
              ...(nicknames.length > 0 ? [["AKA", nicknames.join(", ")]] : []),
              ...(knownForDepartment ? [["Known for", knownForDepartment]] : []),
              ["Birthday", fmtDate(person.birthday)],
              ["Place of birth", fmt(person.place_of_birth)],
              ...(person.deathday ? [["Deathday", fmtDate(person.deathday)]] : []),
            ].map(([k, v]) => (
              <li key={k}><span className="font-semibold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
            ))}
          </ul>
        </ContentPanel>

        {person.biography && (
          <ContentPanel label="Bio">
            <p className="text-sm leading-relaxed text-[#c0c0e8] whitespace-pre-line">{person.biography}</p>
          </ContentPanel>
        )}

        {credits.length > 0 && (
          <ContentPanel label="Filmography">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <PillGroup
                options={[
                  { value: "all", label: `All (${credits.length})` },
                  { value: "movie", label: `Movies (${movieCount})` },
                  { value: "show", label: `Shows (${showCount})` },
                ]}
                value={kind}
                onChange={setKind}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-[#3a3a7a] bg-[#1a1d35] px-3 py-2 text-sm text-white transition hover:border-[#5a5aaa]"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {departments.length > 1 && (
              <div className="mb-4">
                <PillGroup
                  options={[{ value: "all", label: "All roles" }, ...departments.map((d) => ({ value: d, label: d }))]}
                  value={department}
                  onChange={setDepartment}
                />
              </div>
            )}

            {filmography.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#6868b8]">Nothing matches this filter.</p>
            ) : (
              <div className="space-y-2">
                {filmography.map((c) => <FilmographyCard key={c.key} credit={c} />)}
              </div>
            )}
          </ContentPanel>
        )}
      </DetailPageLayout>
    </AppLayout>
  );
}

export default PersonPage;
