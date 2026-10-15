"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Keyhole from "@/components/Keyhole";
import SignInForm from "@/components/SignInForm";
import { authReady, isSignedIn } from "@/lib/api";

// The landing page IS the login page. No separate /login route: a staff tool
// with one door should not have two addresses for it.
//
// A split, not a card floating in the middle of a tinted page. The card is the
// default every login screen reaches for; a split gives the page a left and a
// right, which is room to say what this is without crowding the form. On a
// phone the dark side becomes a slim band at the top, so the form still starts
// near the thumb.
const Page = () => {
  const router = useRouter();
  // null until AuthBootstrap has traded the refresh cookie for a token, so the
  // form is never shown to somebody who is already signed in.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    authReady.then(() => setSignedIn(isSignedIn()));
  }, []);

  // Someone with a live session is sent straight through. The role is checked
  // on the other side by the shell, so this page never has to know about roles.
  useEffect(() => {
    if (signedIn) router.replace("/home");
  }, [signedIn, router]);

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ---------- the dark side ---------- */}
      <aside className="relative isolate flex flex-col justify-between overflow-hidden bg-ink px-6 py-7 text-white lg:order-last lg:px-12 lg:py-12">
        <div
          aria-hidden="true"
          className="plan-grid pointer-events-none absolute inset-0 -z-10"
        />

        <p className="font-display text-[20px] leading-none">
          Properties<span className="text-accent">.</span>
        </p>

        {/* Hidden on a phone, where it would push the form below the fold for
            the sake of a picture. */}
        <div className="hidden lg:block">
          <Keyhole className="h-44 w-44 text-white/70" />
          <h2 className="mt-8 max-w-sm font-display text-[26px] leading-tight">
            The side of the marketplace buyers never see.
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/60">
            Listings, sellers and the records behind them. Everything here
            changes what the public site shows, so it is kept behind one door.
          </p>
        </div>

        <p className="mt-6 text-[12px] text-white/40 lg:mt-0">
          Operator access only
        </p>
      </aside>

      {/* ---------- the form side ---------- */}
      <div className="flex items-center justify-center px-6 py-12 lg:px-12">
        {signedIn === null ? (
          // One blank beat while the refresh completes. Deliberately empty:
          // a spinner here would flash on every load for no information.
          <div className="min-h-[420px]" aria-hidden="true" />
        ) : signedIn ? (
          // Redirecting. Same blank beat rather than a flash of a panel the
          // operator is about to be moved off.
          <div className="min-h-[420px]" aria-hidden="true" />
        ) : (
          <SignInForm onSignedIn={() => router.replace("/home")} />
        )}
      </div>
    </main>
  );
};

export default Page;
