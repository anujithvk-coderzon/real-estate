"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, authReady, isSignedIn } from "@/lib/api";

// Sends a signed-in user to /welcome once, while their account has no type yet.
// Checked on the pages they land on after signing in; auth pages are left alone.
const OnboardingGate = () => {
  const router = useRouter();
  const pathname = usePathname();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    if (pathname !== "/" && !pathname.startsWith("/list")) return;

    checked.current = true; // once per page load, whatever the answer
    authReady.then(() => {
      if (!isSignedIn()) return;
      api
        .get("/auth/me")
        .then((response) => {
          if (!response.data.user?.accountType) router.replace("/welcome");
        })
        .catch(() => {
          // Not worth bothering anyone about; they can set it in settings.
        });
    });
  }, [pathname, router]);

  return null;
};

export default OnboardingGate;
