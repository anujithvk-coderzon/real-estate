"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import PublicHeader from "@/components/public/PublicHeader";
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
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      {signedIn === false && <PublicHeader />}
      {children}
    </div>
  );
};

export default PublicFrame;
