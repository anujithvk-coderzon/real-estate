import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import AuthBootStrap from "@/components/AuthBootstrap";
import OnboardingGate from "@/components/OnboardingGate";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Property location",
  description: "Set the exact location of a property listing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions add their own attributes to <html> and to form controls
    // before React hydrates, which React reports as a mismatch. Nothing here can
    // prevent that, so these elements are excused from the attribute check.
    <html
      lang="en"
      className={`${instrumentSans.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-ground font-sans text-ink">
        <AuthBootStrap/>
        <OnboardingGate />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
