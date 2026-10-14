import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import AuthBootStrap from "@/components/AuthBootstrap";
import OnboardingGate from "@/components/OnboardingGate";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// 800 carries every heading; 700 is there for the eyebrow labels.
const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["700", "800"],
  subsets: ["latin"],
});

// The site's own URL, needed before Next can turn a relative OG image path into
// the absolute one WhatsApp and Google require. Set NEXT_PUBLIC_SITE_URL in
// Vercel; the fallback only keeps local builds working.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // A template, so every page appends rather than replaces. Without it each
  // route has to restate the brand, and most forget.
  title: {
    default: "Properties — homes, plots and rooms across India",
    template: "%s — Properties",
  },
  description:
    "Search homes, plots, villas, offices and PG rooms across India. Filter by budget, bedrooms and seller, and see every match on a map.",
  applicationName: "Properties",
  // Listings are shared on WhatsApp far more than they are found on Google, and
  // a link with no preview card looks like spam.
  openGraph: {
    type: "website",
    siteName: "Properties",
    locale: "en_IN",
    url: siteUrl,
    title: "Properties — homes, plots and rooms across India",
    description:
      "Search homes, plots, villas, offices and PG rooms across India, and see every match on a map.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions add their own attributes to <html> and to form controls
    // before React hydrates, which React reports as a mismatch. Nothing here can
    // prevent that, so these elements are excused from the attribute check.
    <html
      lang="en"
      className={`${dmSans.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-panel font-sans text-ink">
        <AuthBootStrap />
        <OnboardingGate />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
