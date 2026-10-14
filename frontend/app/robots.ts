import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Crawlers are most of how a property site is found, so what they may read is
// worth stating rather than leaving to a default.
const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: "*",
      allow: "/",
      // Nothing behind sign-in belongs in an index, and a crawler following
      // these would only collect redirects to the login page.
      disallow: ["/list/", "/auth/", "/verify/", "/welcome"],
    },
  ],
  sitemap: `${siteUrl}/sitemap.xml`,
});

export default robots;
