import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { usePersonData } from "../../features/person/hooks/usePersonData.js";
import InjectingBanner from "../../components/detail/InjectingBanner.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

const TMDB_IMG_PROFILE = "https://image.tmdb.org/t/p/w342";
const TMDB_IMG_POSTER = "https://image.tmdb.org/t/p/w185";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}


function ProfilePicture({ name, profilePath }) {
  const imgSrc = profilePath ? `${TMDB_IMG_PROFILE}${profilePath}` : null;
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
  const imgSrc = credit.posterPath ? `${TMDB_IMG_POSTER}${credit.posterPath}` : null;
  const key = credit.mediaSlug ?? credit.mediaId;
  const to = credit.type === "movie" ? `/movies/${key}` : `/shows/${key}`;

  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-[#1a1f3a] bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]">
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
        <p className="font-semibold text-white leading-tight line-clamp-1">{credit.title}</p>
        <p className="text-xs text-[#6868b8]">
          {credit.role ? `as ${credit.role}` : credit.job ?? ""}
          {credit.department && credit.job !== "Actor" ? ` · ${credit.department}` : ""}
        </p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${credit.type === "movie" ? "bg-[#1a1d35] text-[#8888c8]" : "bg-[#1d1a35] text-[#a088c8]"}`}>
        {credit.type === "movie" ? "Movie" : "Show"}
      </span>
    </Link>
  );
}

function PersonPage({ session, showAdult }) {
  const { slug } = useParams();
  const { person, knownForDepartment, nicknames, movieCredits, showCredits, isLoading, error } = usePersonData(slug, showAdult);

  const breadcrumbs = person ? [{ label: "People", to: "/people" }, { label: person.name }] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage withFollow={false} /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!person) return null;

  const personOgImage = person.profile_path ? `${TMDB_IMG_PROFILE}${person.profile_path}` : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    ...(person.biography && { description: person.biography.slice(0, 500) }),
    ...(person.profile_path && { image: `${TMDB_IMG_PROFILE}${person.profile_path}` }),
    ...(person.birthday && { birthDate: person.birthday }),
    ...(person.place_of_birth && { birthPlace: { "@type": "Place", name: person.place_of_birth } }),
    ...(knownForDepartment && { jobTitle: knownForDepartment }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(person.tmdb_id) },
  };

  const allCredits = [...movieCredits, ...showCredits];
  const uniqueCredits = Array.from(new Map(allCredits.map((c) => [c.id, c])).values());

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={person.name}
        description={person.biography ? person.biography.slice(0, 155) : `Discover ${person.name}'s filmography on watchpapa.`}
        image={personOgImage}
        path={`/people/${person.slug ?? slug}`}
        jsonLd={jsonLd}
      />
      <div className="mb-6"><InjectingBanner type="person" id={person.id} /></div>
      <DetailPageLayout
        title={person.name}
        sidebarTop={<ProfilePicture name={person.name} profilePath={person.profile_path} />}
        sidebarBottom={
          <ul className="space-y-1.5 text-xs">
            {[
              ["Name", fmt(person.name)],
              ["Birthday", fmtDate(person.birthday)],
              ["Popularity", person.popularity?.toFixed(1) ?? "—"],
            ].map(([k, v]) => (
              <li key={k}><span className="font-bold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
            ))}
          </ul>
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

        {uniqueCredits.length > 0 && (
          <ContentPanel label="Filmography">
            <div className="space-y-2">
              {uniqueCredits.map((c) => <FilmographyCard key={c.id} credit={c} />)}
            </div>
          </ContentPanel>
        )}
      </DetailPageLayout>
    </AppLayout>
  );
}

export default PersonPage;
