"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, authReady, isSignedIn } from "@/lib/api";

// Keeps a signed-in user on /welcome until their account has a type. Signing up
// and verifying an email are left alone, and signed-out visitors browse freely.
const FREE_PATHS = ["/welcome", "/auth", "/verify"];

const OnboardingGate = () => {
  const router = useRouter();
  const pathname = usePathname();
  // An account cannot lose its type, so once one is seen the check is over.
  const hasType = useRef(false);

  useEffect(() => {
    if (hasType.current) return;
    if (FREE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return;

    authReady.then(() => {
      if (!isSignedIn()) return;
      api
        .get("/auth/me")
        .then((response) => {
          // Only a type ends the check: answering "none" and walking away must
          // send them back, otherwise the screen is skippable by navigating.
          if (response.data.user?.accountType) hasType.current = true;
          else router.replace("/welcome");
        })
        .catch(() => {
          // A failed check must not lock anyone out of the site.
        });
    });
  }, [pathname, router]);

  return null;
};

export default OnboardingGate;
