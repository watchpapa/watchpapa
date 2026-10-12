import { Helmet } from "react-helmet-async";

const SITE_NAME = "watchpapa";
const DEFAULT_DESC = "Discover and track films, shows, and people. Browse popular movies and TV shows, explore cast and crew, check upcoming releases — all in one place.";
const DEFAULT_IMAGE = "https://watchpapa.tv/og-default.png";
const BASE_URL = "https://watchpapa.tv";

export function PageHead({ title, description, image, path, type = "website", noindex = false, jsonLd }) {
  const fullTitle = !title ? SITE_NAME : title.endsWith(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  const desc = (description || DEFAULT_DESC).slice(0, 200);
  const img = image || DEFAULT_IMAGE;
  const url = path ? `${BASE_URL}${path}` : BASE_URL;
  const jsonLdList = [].concat(jsonLd ?? []).filter(Boolean);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      {jsonLdList.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}
