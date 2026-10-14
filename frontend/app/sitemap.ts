import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Only the routes that exist without data. Individual listings are not here on
// purpose: generating them means calling the API at build time, which couples a
// frontend deploy to the backend being up, and a listing that sells is then a
// dead URL in an index that outlives it. Those belong in a sitemap the backend
// serves from live data, which is a separate job.
const sitemap = (): MetadataRoute.Sitemap => [
  { url: siteUrl, changeFrequency: "hourly", priority: 1 },
  {
    url: `${siteUrl}/property/search`,
    changeFrequency: "hourly",
    priority: 0.8,
  },
  {
    url: `${siteUrl}/?listingType=SALE`,
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    url: `${siteUrl}/?listingType=RENT`,
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    url: `${siteUrl}/?listingType=PG`,
    changeFrequency: "daily",
    priority: 0.6,
  },
];

export default sitemap;
