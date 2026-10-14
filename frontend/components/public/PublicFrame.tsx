"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import PublicHeader from "@/components/public/PublicHeader";
import SiteFooter from "@/components/public/SiteFooter";
import { authReady, isSignedIn } from "@/lib/api";

// Frame for pages anyone can open. Signed-in users get the same sidebar as the
// /list pages; visitors get the top bar with Sign in.
const PublicFrame = ({ children }: { children: React.ReactNode }) => {
  // null until the sign-in check finishes, so neither frame flashes up first.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    authReady.then(() => setSignedIn(isSignedIn()));
  }, []);

  if (signedIn) {
    return (
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Sidebar />
        {/* flex-col so the footer sits under the content rather than beside the
            rail, and the content keeps the height it needs. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {signedIn === false && <PublicHeader />}
      <div className="flex-1">{children}</div>
      {/* Only once the sign-in check has settled: a footer that appears, then
          jumps as the sidebar arrives, is worse than one that waits a tick. */}
      {signedIn === false && <SiteFooter />}
    </div>
  );
};

export default PublicFrame;
