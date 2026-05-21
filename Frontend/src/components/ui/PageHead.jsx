import { Helmet } from "react-helmet-async";

const SITE_NAME = "watchpapa";
const DEFAULT_DESC = "Discover and track films, shows, and talent. Browse popular movies and TV shows, explore cast and crew, check upcoming releases — all in one place.";
const DEFAULT_IMAGE = "https://watchpapa.tv/logo_v3.1.svg";
const BASE_URL = "https://watchpapa.tv";

export function PageHead({ title, description, image, path, type = "website", noindex = false, jsonLd }) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const desc = (description || DEFAULT_DESC).slice(0, 155);
  const img = image || DEFAULT_IMAGE;
  const url = path ? `${BASE_URL}${path}` : BASE_URL;

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
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
