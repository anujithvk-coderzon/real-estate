"use client";

import { useEffect, useState } from "react";
import NewPromotion from "@/components/NewPromotion";
import { api } from "@/lib/api";
import { primaryButton, secondaryButton } from "@/lib/ui";

// One banner the seller has submitted. GET /promotion/my sends listingId OR
// projectId, never both and never neither, so which key is present is what
// tells us what the banner points at.
type Promotion = {
  id: string;
  isActive: boolean;
  listingId?: string;
  projectId?: string;
  image: string;
  createdAt: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// What the seller is waiting to hear: is it up yet. isActive defaults to false
// in the database, so everything new reads as in review until an operator
// turns it on.
const status = (promotion: Promotion) =>
  promotion.isActive
    ? { label: "Live", chip: "bg-accent/12 text-accent" }
    : { label: "In review", chip: "bg-line text-muted" };

// The response carries only the id of the thing promoted, not its title, so
// this is all we can honestly say about the target for now.
const target = (promotion: Promotion) =>
  promotion.listingId ? "Property" : promotion.projectId ? "Project" : "—";

const Promotions = () => {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by Try again, so asking a second time is a new request and not a
  // no-op on an unchanged dependency list. Try again also clears the two
  // states above: resetting them here, inside the effect, would be a setState
  // in an effect body, which cascades a second render on every load.
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    api.get("/promotion/my").then(
      ({ data }) => {
        if (live) setPromotions(data.promotions ?? []);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      // The seller asked again before this answered; its result is stale.
      live = false;
    };
  }, [attempt]);

  const reload = () => {
    setFailed(false);
    setPromotions(null);
    setAttempt((n) => n + 1);
  };

  const live = promotions?.filter((promotion) => promotion.isActive).length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      {/* ---------- heading ---------- */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[30px] leading-none sm:text-[40px] lg:text-[48px]">
            Promotions
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {promotions === null
              ? "Loading your banners…"
              : promotions.length === 0
                ? "Banners you submit for the home page appear here."
                : `${promotions.length} ${promotions.length === 1 ? "banner" : "banners"}, ${live} live`}
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={primaryButton}
          >
            New promotion
          </button>
        )}
      </header>

      {creating && (
        <NewPromotion
          onCreated={() => {
            setCreating(false);
            reload(); // the new banner belongs in the list below
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {failed ? (
        /* ---------- failed ---------- */
        <div className="mt-10 rounded-2xl bg-panel p-6 text-center ring-1 ring-line sm:p-10">
          <h2 className="font-display text-[18px]">
            Your promotions could not be loaded
          </h2>
          <p className="mt-2 text-[15px] text-muted">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={reload}
            className={`mt-5 ${secondaryButton}`}
          >
            Try again
          </button>
        </div>
      ) : promotions === null ? (
        /* ---------- first load ---------- */
        <ul
          className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading your promotions</span>
          {Array.from({ length: 2 }, (_, index) => (
            <li
              key={index}
              className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line"
            >
              <div className="aspect-[3/1] animate-pulse bg-line/60" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-line" />
                <div className="h-4 w-40 animate-pulse rounded bg-line" />
              </div>
            </li>
          ))}
        </ul>
      ) : promotions.length === 0 ? (
        /* ---------- nothing submitted yet ---------- */
        <div className="mt-10 rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
          <h2 className="font-display text-[30px] leading-tight">
            No promotions yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
            A promotion is a banner for one of your properties, shown to buyers
            browsing the site. Every banner is checked by our team before it
            goes live.
          </p>
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={`mt-6 ${primaryButton}`}
            >
              Create your first promotion
            </button>
          )}
        </div>
      ) : (
        /* ---------- the banners ---------- */
        <ul className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {promotions.map((promotion) => {
            const state = status(promotion);
            return (
              <li
                key={promotion.id}
                className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line"
              >
                {/* A banner is wide, so the frame is wide too. object-contain
                    keeps whatever the seller uploaded uncropped, with a
                    blurred copy of it filling the gaps. */}
                <div className="relative aspect-[3/1] overflow-hidden bg-ground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={promotion.image}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
                  />
                  {/* The banner is the content of this card, not decoration,
                      so it keeps a real alt. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={promotion.image}
                    alt={`Banner submitted on ${when(promotion.createdAt)}`}
                    className="relative h-full w-full object-contain"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${state.chip}`}
                  >
                    {state.label}
                  </span>
                  <span className="text-[14px]">{target(promotion)}</span>
                  <span className="ml-auto text-[13px] tabular-nums text-muted">
                    Submitted {when(promotion.createdAt)}
                  </span>
                </div>

                {!promotion.isActive && (
                  <p className="border-t border-line px-4 py-3 text-[13px] leading-relaxed text-muted">
                    Our team is checking this banner. It starts showing to
                    buyers as soon as it is approved.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};

export default Promotions;
