"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TypeGlyph from "@/components/public/TypeGlyph";
import { formatDate, formatNumber, formatRupeesShort } from "@/lib/format";
import { TYPE_COLOUR, isRental, labelOf } from "@/lib/listing";
import { BADGE_TONE, reraBadge } from "@/lib/rera";
import type { PublicListingSummary } from "@/lib/types";

type Props = {
  listing: PublicListingSummary;
  // Search results already say "for sale" in the heading, so the badge would repeat it.
  showMode?: boolean;
  // Search results: the card whose pin is hovered or selected on the map.
  highlighted?: boolean;
  // Search results: tell the map which card the pointer is on.
  onHoverChange?: (hovered: boolean) => void;
};

// "650 m" or "2.4 km"
const formatDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`;

// A listing as buyers see it: photograph, what it is, where, what it has, what
// it costs. The colour dot before the type is the same colour the property's pin
// takes on the map, so a card and its pin are recognisably the same thing.
// How many of a listing's photographs the hover reel runs through. Ten would
// be a long loop nobody watches to the end, and ten images per card on a page
// of twenty cards is 200 requests.
const REEL_MAX = 5;

// Long enough to take a room in — which is the point of the reel, not getting
// through the set. Two photographs still go by in the time a cursor rests on a
// card while the eye moves to the price.
const REEL_MS = 1700;

// The frame the photograph has to live in. Keep in step with the aspect class
// on the media box below; this is the number the fit is judged against.
const FRAME = 16 / 10;

// How much of a photograph may be cut away to fill that frame. Filling costs
// 1 - min(photo, frame) / max(photo, frame) of the picture:
//
//   3:2  1.50 →  6%     square 1.00 → 37%
//   16:9 1.78 → 10%     3:4    0.75 → 53%
//   4:3  1.33 → 17%
//
// so 12% keeps the full-bleed look for the shapes that nearly fit and spares
// everything else. A one-sided "is it portrait" test was not enough: 4:3 is
// what most phone cameras shoot, and it was quietly losing a sixth of its
// height off the top and bottom.
const MAX_CROP = 0.12;

// One photograph in the strip, fitted to the frame on its own terms.
//
// Filling is what a property card wants — a cropped photo reads as a
// photograph of a place, where a contained one reads as a screenshot of one —
// but a portrait photo filling a landscape frame loses nearly half of itself,
// which is a worse lie than a letterbox. So the shape of the file decides, and
// only the photos that cannot fill get the blurred copy behind them.
const ReelFrame = ({ src }: { src: string }) => {
  const [whole, setWhole] = useState(false);

  return (
    <div className="relative h-full w-full shrink-0 overflow-hidden">
      {whole && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        // naturalWidth/Height are the file's real dimensions, known only once
        // the browser has the image. Until then it fills, which is right for
        // the overwhelming majority of listing photographs.
        onLoad={(event) => {
          const image = event.currentTarget;
          if (!image.naturalWidth || !image.naturalHeight) return;
          const shape = image.naturalWidth / image.naturalHeight;
          // Works in both directions: a wide photo loses width, a tall one
          // loses height, and this is the share either one would lose.
          const loss = 1 - Math.min(shape, FRAME) / Math.max(shape, FRAME);
          if (loss > MAX_CROP) setWhole(true);
        }}
        className={`relative h-full w-full ${
          whole ? "object-contain" : "object-cover"
        }`}
      />
    </div>
  );
};

// Everything that promises the card opens. Applied only when it does.
const OPENABLE =
  "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_32px_-16px_rgba(48,32,68,0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const PublicListingCard = ({
  listing,
  showMode = true,
  highlighted = false,
  onHoverChange,
}: Props) => {
  const cover = listing.listingImages?.[0]?.path;
  // Every photograph the feed already sends, capped. /list/all selects
  // listingImages with no take, so this costs no request and no API change.
  const reel = (listing.listingImages ?? [])
    .map((image) => image.path)
    .slice(0, REEL_MAX);

  // Which photograph is showing, and whether the ones after the first have
  // been put in the DOM yet. They are added on first hover, not at render: a
  // grid of twenty cards would otherwise ask the CDN for a hundred images
  // nobody has looked at.
  const [frame, setFrame] = useState(0);
  const [reelLoaded, setReelLoaded] = useState(false);
  // Drives the progress segments. On a phone nothing hovers, so group-hover
  // cannot be what reveals them.
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const card = useRef<HTMLElement>(null);
  const count = reel.length;

  const stopReel = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
    setFrame(0);
  }, []);

  const beginReel = useCallback(() => {
    if (count < 2 || timer.current) return;
    setReelLoaded(true);
    setRunning(true);
    timer.current = setInterval(
      () => setFrame((at) => (at + 1) % count),
      REEL_MS,
    );
  }, [count]);

  // A touch screen has no cursor to answer, so the card runs its reel while it
  // is the thing being looked at: a phone shows one card at a time, which
  // makes "in view" as good a signal as hover is on a laptop.
  //
  // Not on a pointer device — there the cursor decides, and both running at
  // once would start reels on cards nobody has pointed at. Not under reduced
  // motion either: hover is something the visitor did, while coming into view
  // is not, and unrequested looping motion is exactly what that setting asks
  // us to stop.
  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = card.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) beginReel();
        else stopReel();
      },
      // Most of the card, not a sliver of it: a reel starting while the card
      // is one line tall at the bottom of the screen is motion in the corner
      // of the eye of somebody reading the card above it.
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      stopReel();
    };
  }, [count, beginReel, stopReel]);

  // A card can be scrolled out, or the list refiltered, while the pointer is
  // still on it — and an interval left running would hold a reference to a
  // component nobody is looking at.
  useEffect(() => stopReel, [stopReel]);

  // The three figures people line up across cards, on their own ruled row.
  const details = [
    typeof listing.bedrooms === "number" && `${listing.bedrooms} beds`,
    typeof listing.bathrooms === "number" && `${listing.bathrooms} baths`,
    listing.areaValue &&
      `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit).toLowerCase()}`,
  ].filter(Boolean) as string[];

  const place = [listing.locality, listing.city].filter(Boolean).join(", ");

  // Only ever set for a broker or a builder, and only where the registration
  // is actually material — see lib/rera.
  const badge = reraBadge({
    postedBy: listing.postedBy,
    listingType: listing.listingType,
    status: listing.owner?.agentReraStatus,
  });

  // No slug, no public page — Listing.slug is null for rows older than slugs,
  // and the title below renders as plain text for those. Everything that says
  // "this opens" is tied to this: a card that rises toward the cursor and
  // shows a go-arrow while doing nothing is the worst lie an interface can
  // tell, because the visitor concludes the site is broken rather than that
  // this one card is.
  const openable = Boolean(listing.slug);

  return (
    <article
      ref={card}
      onMouseEnter={() => {
        onHoverChange?.(true);
        // Pointer devices only. A tap on a phone can fire mouseenter, and a
        // reel started that way would animate under a thumb that was trying
        // to open the listing — with no "leave" coming to stop it.
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches)
          beginReel();
      }}
      onMouseLeave={() => {
        onHoverChange?.(false);
        stopReel();
      }}
      // Lifts 4px on approach with the shadow directly beneath it. No scale: a
      // photograph that grows on hover crops itself, and the price moves.
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl bg-panel ring-1 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent ${
        openable ? OPENABLE : ""
      } ${
        highlighted
          ? "shadow-[0_14px_32px_-16px_rgba(48,32,68,0.28)] ring-2 ring-accent"
          : "ring-line"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ground">
        {cover ? (
          // Fills the frame, cropping what does not fit. It was the banner's
          // treatment before — the whole photo kept inside a blurred copy of
          // itself — which guarantees nothing is lost but makes a portrait
          // phone photo sit small inside a halo, and a card of that reads as a
          // screenshot of a photograph rather than a photograph.
          //
          // A banner earns the uncropped version because it is artwork with
          // words on it, where a crop can cut the message. A property photo
          // has no message to cut: the subject is in the middle, and the first
          // thing a buyer wants is to see the place, large.
          //
          // The gallery on the listing page still shows every photo whole,
          // which is where "nothing is lost" actually matters.
          <>
            {/* A filmstrip, moved by whole frames. transform only — no width,
                no scroll position, nothing the browser has to re-lay out — so
                a row of cards cycling at once stays on the compositor. */}
            <div
              aria-hidden="true"
              className="pointer-events-none flex h-full w-full transition-transform duration-700 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${frame * 100}%)` }}
            >
              {reel.map((src, index) =>
                index === 0 || reelLoaded ? (
                  <ReelFrame key={src} src={src} />
                ) : (
                  // Holds the frame's place in the strip until it is wanted,
                  // so the transform lands on the right offset either way.
                  <div key={src} className="h-full w-full shrink-0" />
                ),
              )}
            </div>

            {reel.length > 1 && (
              // Which photograph, and how many. Appears with the hover that
              // started the reel, because a progress bar over a still image
              // would be a control that does nothing.
              <div
                className={`pointer-events-none absolute inset-x-3 bottom-2.5 flex gap-1 transition-opacity motion-reduce:transition-none ${
                  running ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {reel.map((src, index) => (
                  <span
                    key={src}
                    className={`h-0.5 flex-1 rounded-full transition-colors ${
                      index === frame ? "bg-white" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center gap-1">
            <div
              aria-hidden="true"
              className="survey-grid pointer-events-none absolute inset-0"
            />
            <TypeGlyph
              type={listing.propertyType}
              className="relative h-14 w-14 text-muted"
            />
            <span className="relative text-[12px] text-muted">
              No photographs
            </span>
          </div>
        )}
        {showMode && (
          <span className="absolute left-3 top-3 rounded-lg bg-panel/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink backdrop-blur-sm">
            {listing.listingType === "SALE"
              ? "For sale"
              : listing.listingType === "PG"
                ? "PG"
                : "For rent"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* The type, with the colour its pin wears on the map. */}
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
          <span
            aria-hidden="true"
            style={{ background: TYPE_COLOUR[listing.propertyType] }}
            className="h-[7px] w-[7px] shrink-0 rounded-full"
          />
          {labelOf(listing.propertyType)}
        </p>

        <h3 className="mt-2 truncate text-[15px] font-semibold text-ink">
          {listing.slug ? (
            // The link's overlay makes the whole card clickable.
            <Link
              href={`/property/${listing.slug}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
              title={listing.title}
            >
              {listing.title}
            </Link>
          ) : (
            listing.title
          )}
        </h3>

        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
          <span aria-hidden="true">&#8982;</span>
          <span className="min-w-0 truncate">{place}</span>
          {typeof listing.distanceKm === "number" && (
            <span className="shrink-0 tabular-nums">
              &middot; {formatDistance(listing.distanceKm)}
              <span className="sr-only"> from the searched place</span>
            </span>
          )}
        </p>

        {details.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-b border-line pb-3 text-[12px] text-muted">
            {details.map((item) => (
              <span key={item} className="tabular-nums">
                {item}
              </span>
            ))}
          </p>
        )}

        {/* Who listed it and when: buyers use both to judge how fresh it is —
            and, for an agent, whether anyone has checked their registration. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <p className="text-[11px] text-muted">
            {labelOf(listing.postedBy)} &middot;{" "}
            <time dateTime={listing.createdAt} className="tabular-nums">
              {formatDate(listing.createdAt)}
            </time>
          </p>
          {badge && (
            <span
              title={badge.detail}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${BADGE_TONE[badge.tone]}`}
            >
              {badge.tick && (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {badge.label}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <p className="text-[19px] font-bold leading-none tabular-nums text-ink">
            {formatRupeesShort(listing.price)}
            {isRental(listing.listingType) && (
              <span className="text-[12px] font-normal text-muted">
                {" "}
                /month
              </span>
            )}
          </p>
          {/* Not a second link — the card is already one. A visual affordance
              that the card opens, which slides on approach. Absent when there
              is nothing to open. */}
          {openable && (
            // A bare glyph in a box is the ambiguous middle: it looks like a
            // button, cannot be pressed on its own, and sat there unchanged
            // while the cursor was over it. A word says what it is, and the
            // fill answers the cursor, so the whole card reads as one thing
            // you press. aria-hidden because the title above is already the
            // link; this is its visible promise, not a second one.
            <span
              aria-hidden="true"
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-accent-soft px-2.5 text-[12.5px] font-semibold text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white motion-reduce:transition-none"
            >
              View
              <span className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none">
                &#8599;
              </span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default PublicListingCard;
