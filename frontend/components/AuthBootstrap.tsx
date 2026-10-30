"use client";
import { api, setAccessToken, setAuthReady } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { takeGoogleReturn } from "@/lib/returnTo";

export const AuthBootStrap = () => {
  const done = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    api
      .post("/auth/refresh")
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        // Signing in with Google leaves the site entirely, so the ?next on the
        // login page cannot survive it: the backend's callback redirects to
        // FRONTEND_URL and knows nothing about where the visitor started. This
        // finishes the journey from the browser's side.
        //
        // Only on that landing page, and only for a journey a Google button
        // started, so an ordinary visit home can never be redirected.
        if (pathname !== "/") return;
        const back = takeGoogleReturn();
        if (back && back !== "/") router.replace(back);
      })
      .catch(() => {})
      .finally(setAuthReady);
    // Runs once per load; the two router values are read inside, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

export default AuthBootStrap;
