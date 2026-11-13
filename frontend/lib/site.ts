// The brand name and the site's own origin, in one place.
//
// Both were repeated: "Properties" five times in app/layout.tsx and the origin
// three times (layout, robots, sitemap), each with its own localhost fallback.
// A name spelled out in six places is a name that eventually disagrees with
// itself — and one of those six is now a message buyers send to sellers.
export const SITE_NAME = "PropsNear";

// Absolute, because WhatsApp previews, OG images, robots.txt and the sitemap all
// reject a relative URL. Set NEXT_PUBLIC_SITE_URL per environment; the fallback
// only keeps a local build working. The trailing slash is stripped so callers
// can append a pathname without producing a double slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
