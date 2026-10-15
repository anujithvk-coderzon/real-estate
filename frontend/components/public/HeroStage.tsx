"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import MapPlate from "@/components/public/MapPlate";
import SearchBar from "@/components/public/SearchBar";
import { authReady, isSignedIn } from "@/lib/api";
import {
  LISTING_TYPES,
  PROPERTY_TYPES,
  TYPE_COLOUR,
  categoryPhoto,
} from "@/lib/listing";

// The hero: a circular plate with the search at its centre, the property types
// scattered in orbit around it, and a scroll that gathers them into the row they
// live in for the rest of the page.
//
// Built to the reference's own numbers: 280px of scroll, a sticky stage, cards
// that straighten out of a tilt, captions that fade as they tidy up, and the
// dashed orbit ring fading back as the cards leave it.
//
// The implementation is inverted from the reference's, on purpose. There, the
// scattered position is measured and the row is computed every frame from
// offsetLeft/offsetTop — which forces a layout recalculation on each scroll
// event. Here the ROW is the cards' natural CSS position and the orbit is a
// transform away from it, so the scroll handler only ever writes transforms and
// the browser never has to re-lay out the page. Measuring happens once per
// resize.

// A true ring: seven cards evenly spaced, the first straight up and the rest
// every 360/7 around. Nothing is at the very bottom, which is where the row
// forms, because 90° falls between two of them.
//
// This replaced two shallow arcs on the flanks. Those were what the reference
// actually does — I measured its six satellites at 144°, 172°, 200° and 8°,
// 36°, 340°, every one within 36° of horizontal — but two arcs are not a ring,
// and a ring is what was asked for.
//
// The cost is vertical room: a card directly above the plate needs 180px of
// clear space over it, which is why the plate is smaller than it was and why
// the stage carries that much top padding.
const ORBIT_DEGREES = Array.from(
  { length: 7 },
  (_, index) => 270 + index * (360 / 7),
);
// Their alternating tilt, so the ring looks placed by hand rather than plotted.
// Straightens to zero as the cards settle into the row.
const ORBIT_TILT = [-5, 7, 5, -6, -7, 6, -4];
// A card at its orbiting size (118 x 122 at 1.08) — its nearest CORNER is what
// has to clear the plate, not its centre. Testing the centre is what let four of
// seven sit on top of the drawing in the previous version.
const ORBIT_SCALE = 1.08;
const CARD_HALF_W = (118 * ORBIT_SCALE) / 2;
const CARD_HALF_H = (122 * ORBIT_SCALE) / 2;
const CARD_HALF_DIAGONAL = Math.hypot(CARD_HALF_W, CARD_HALF_H);
// Clearance between the plate's edge and a card's nearest corner.
const PLATE_GAP = 22;
// How far the gather takes, in pixels of scroll. Theirs is 280.
const TRAVEL = 280;
// Below this stage width there is nowhere outside the circle for a card to be,
// so the cards simply start where they belong and nothing animates. The ring is
// about 707px across, plus a card's half width on each side.
const MIN_STAGE_WIDTH = 740;

// Where a node sits inside `root`, walking offsetParents.
//
// Deliberately NOT getBoundingClientRect(): a rect includes the element's
// transform, and by the time anything re-measures, the cards are usually
// mid-flight carrying the very transform this file is trying to compute. The
// orbit position then goes back in as the row slot, dx works out to 0 at every
// t, and the cards sit in the row for good. offsetLeft/offsetTop are layout
// only, so they report the slot whatever the card is currently doing.
const offsetWithin = (node: HTMLElement, root: HTMLElement) => {
  let x = 0;
  let y = 0;
  let step: HTMLElement | null = node;
  while (step && step !== root) {
    x += step.offsetLeft;
    y += step.offsetTop;
    step = step.offsetParent as HTMLElement | null;
  }
  return { x, y };
};

// Everything needed to put a card anywhere along its arc, stored relative to the
// ring's centre so it survives the stage being scrolled.
type Orbit = {
  // Where the card's own slot in the row is, as a vector from the ring centre.
  vx: number;
  vy: number;
  // Polar form of the ring point it starts from, and of the slot it ends at.
  r0: number;
  r1: number;
  a0: number;
  // Signed sweep from a0 to the slot's angle, by the shorter way round.
  sweep: number;
};

const HeroStage = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const propertyType = searchParams.get("propertyType") ?? "";
  const listingType = searchParams.get("listingType") ?? "";
  // Empty means the API's default of 10 km, which is what the ring must show.
  const radiusKm = Number(searchParams.get("radius")) || 10;

  const stage = useRef<HTMLDivElement>(null);
  // The positioned ancestor of both the plate and the row, so one offsetParent
  // walk puts them in the same coordinate space.
  const column = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);

  // null until the sign-in check settles, so neither version of the copy
  // flashes before the other. The same pattern PublicFrame uses.
  const [visitor, setVisitor] = useState<boolean | null>(null);
  const [orbits, setOrbits] = useState<Orbit[]>([]);
  const [progress, setProgress] = useState(1);
  const [ready, setReady] = useState(false);

  const href = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === searchParams.get(name)) next.delete(name);
    else next.set(name, value);
    next.delete("page");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  useEffect(() => {
    authReady.then(() => setVisitor(!isSignedIn()));
  }, []);

  // One layout read per resize. Everything after this is transforms.
  const measure = useCallback(() => {
    const ring = plate.current;
    const root = column.current;
    if (!ring || !root) return;

    const host = stage.current;
    const stageWidth = host?.clientWidth ?? ring.offsetWidth;

    // The orbit needs room for the plate PLUS a card either side of it.
    if (stageWidth < MIN_STAGE_WIDTH) {
      setOrbits([]);
      setReady(true);
      return;
    }

    const centre = offsetWithin(ring, root);
    const cx = centre.x + ring.offsetWidth / 2;
    const cy = centre.y + ring.offsetHeight / 2;
    const plateRadius = ring.offsetWidth / 2;

    // A circle, not an ellipse, and the radius carries the card's half-diagonal
    // so its nearest corner lands PLATE_GAP outside the plate at every angle.
    // An ellipse was the mistake here: squashing it vertically to dodge the
    // headline pulled the upper cards back over the drawing.
    const radius = plateRadius + PLATE_GAP + CARD_HALF_DIAGONAL;

    // A card past the stage edge is clipped, and a clipped card looks broken
    // rather than scattered. If there is not room for the full radius there is
    // no room for an orbit — no orbit beats cards sitting on the map.
    if (radius + CARD_HALF_W + 8 > stageWidth / 2) {
      setOrbits([]);
      setReady(true);
      return;
    }

    // One missing ref would mean one card with a dead orbit sitting in the row
    // while six fly. No orbit at all is the better failure: ready stays true so
    // the row is still visible rather than held at opacity 0.
    if (cards.current.length < PROPERTY_TYPES.length) {
      setOrbits([]);
      setReady(true);
      return;
    }

    const next: Orbit[] = [];
    for (const [index, card] of cards.current.entries()) {
      if (!card) {
        setOrbits([]);
        setReady(true);
        return;
      }
      const slot = offsetWithin(card, root);
      // The card's slot in the row, as a vector from the ring's centre. Stored
      // relative so it stays correct however far the stage has been scrolled.
      const vx = slot.x + card.offsetWidth / 2 - cx;
      const vy = slot.y + card.offsetHeight / 2 - cy;

      const a0 = ((ORBIT_DEGREES[index] ?? 0) * Math.PI) / 180;
      const a1 = Math.atan2(vy, vx);
      // The shorter way round, so no card takes the long path home.
      let sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;

      next.push({ vx, vy, r0: radius, r1: Math.hypot(vx, vy), a0, sweep });
    }

    setOrbits(next);
    setReady(true);
  }, []);

  useEffect(() => {
    measure();

    // The stage for width, the column for the row wrapping or growing under it.
    const observer = new ResizeObserver(measure);
    if (stage.current) observer.observe(stage.current);
    if (column.current) observer.observe(column.current);

    // The display face swaps in after first paint and the cards change height
    // with it, which moves every slot. Cheap to measure again; wrong not to.
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) measure();
    });

    return () => {
      live = false;
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onScroll = () => {
      const host = stage.current;
      if (!host) return;
      const top = host.getBoundingClientRect().top;
      const next = Math.max(0, Math.min(1, (16 - top) / TRAVEL));
      // Their behaviour for reduced motion: snap, do not travel.
      setProgress(reduced.matches ? (next > 0.45 ? 1 : 0) : next);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const orbiting = orbits.length > 0;

  // Each card runs its own window of the scroll, 6% apart, so they arrive in
  // sequence instead of all landing on the same frame. Seven cards moving in
  // perfect unison read as a mechanism resetting, not as things gathering.
  const STAGGER = 0.06;
  const span = 1 - STAGGER * (PROPERTY_TYPES.length - 1);
  const cardProgress = (index: number) => {
    if (!orbiting) return 1;
    const local = (progress - index * STAGGER) / span;
    const clamped = Math.max(0, Math.min(1, local));
    // Eased, so a card slows as it arrives rather than stopping dead.
    return 1 - Math.pow(1 - clamped, 3);
  };

  // The ring's own opacity still follows the overall scroll, not any one card.
  const eased = orbiting ? 1 - Math.pow(1 - progress, 3) : 1;

  // ---------- signed in ----------
  // No plate, no ring, no gather. The orbit is a first-impression device: it
  // says "this site sells homes, plots, offices and rooms" to somebody who has
  // never been here. A returning user already knows, and making them scroll
  // 1080px of sticky stage past it to reach their listings is a tax.
  //
  // So they get the same controls, flat and compact: say where, say what, see
  // results. Nothing moves except what answers a press.
  if (visitor === false) {
    return (
      <section
        aria-labelledby="home-heading"
        className="border-b border-line bg-ground/40"
      >
        <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-10 lg:py-7">
          <h1
            id="home-heading"
            className="font-display text-[22px] leading-tight"
          >
            Where are you looking?
          </h1>

          <div className="mt-4 max-w-2xl">
            <SearchBar variant="compact" />
          </div>

          {/* One row, wrapping: the mode on the left, the types after it. Both
              write the same URL the filter bar below does. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-panel p-1 ring-1 ring-line">
              {LISTING_TYPES.map((mode) => {
                const selected = mode.value === listingType;
                return (
                  <Link
                    key={mode.value}
                    href={href("listingType", mode.value)}
                    scroll={false}
                    aria-pressed={selected}
                    className={`flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? "bg-accent text-white"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {mode.value === "SALE"
                      ? "Buy"
                      : mode.value === "RENT"
                        ? "Rent"
                        : "PG"}
                  </Link>
                );
              })}
            </div>

            <span
              aria-hidden="true"
              className="hidden h-6 w-px bg-line sm:block"
            />

            <ul className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((type) => {
                const selected = type.value === propertyType;
                return (
                  <li key={type.value}>
                    <Link
                      href={href("propertyType", type.value)}
                      scroll={false}
                      aria-pressed={selected}
                      className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        selected
                          ? "bg-accent-soft text-ink ring-accent"
                          : "bg-panel text-ink ring-line hover:ring-accent/50"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        style={{ background: TYPE_COLOUR[type.value] }}
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                      />
                      {type.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="home-heading" className="border-b border-line">
      <div className="mx-auto w-full max-w-7xl px-5 pt-10 text-center sm:pt-14 lg:px-10">
        <p className="annot inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-accent/60"
          />
          Your neighbourhood. Your next move.
        </p>
        <h1
          id="home-heading"
          className="mx-auto mt-3.5 max-w-3xl font-display text-[34px] leading-[1.05] sm:text-[44px] lg:text-[52px]"
        >
          Find your next home.{" "}
          <em className="not-italic text-accent">Right nearby.</em>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted">
          Homes, plots and rooms across India. Search a locality, set how far
          you will travel, and see every match on a map.
        </p>
      </div>

      {/* ---------- the stage ---------- */}
      {/* Tall enough to scroll the gather through while the plate stays put.
          overflow-clip, not hidden: the orbiting cards reach outside the content
          column and must not create a horizontal scrollbar on the way. */}
      <div
        ref={stage}
        className="relative h-[520px] overflow-clip min-[420px]:h-[620px] sm:h-[700px] lg:h-[1080px]"
      >
        <div className="sticky top-4">
          <div
            ref={column}
            className="relative mx-auto w-full max-w-7xl px-5 pt-3 lg:px-10 lg:pt-[180px]"
          >
            <div className="flex justify-center">
              <div className="relative w-[min(86vw,22rem)]">
                {/* The dashed orbit, fading back as the cards leave it — their
                    opacity curve, 1 down to 0.15. */}
                <div
                  aria-hidden="true"
                  style={{ opacity: 1 - eased * 0.85 }}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[116%] w-[132%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-line"
                />
                <div
                  ref={plate}
                  className="relative aspect-square overflow-hidden rounded-full bg-ground ring-[9px] ring-panel"
                >
                  <MapPlate radiusKm={radiusKm} />
                  {/* Both first questions at the centre of the map: where, then
                      what for. Half a page apart they read as two unrelated
                      controls; together they read as one search. */}
                  <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 space-y-2.5 sm:inset-x-9">
                    {/* The mode and type are not fields in here; they are
                        the hero's own controls, held in the URL. Passed in so
                        the form submits the choice instead of dropping it. */}
                    <SearchBar
                      variant="compact"
                      initialValues={{ listingType, propertyType }}
                    />
                    <div className="flex justify-center">
                      {/* Needs its own surface: a segmented control sitting
                          straight on the map would be unreadable over roads. */}
                      <div className="flex gap-1 rounded-xl bg-panel/95 p-1 shadow-[0_8px_24px_-12px_rgba(48,32,68,0.3)] ring-1 ring-line backdrop-blur-sm">
                        {LISTING_TYPES.map((mode) => {
                          const selected = mode.value === listingType;
                          return (
                            <Link
                              key={mode.value}
                              href={href("listingType", mode.value)}
                              scroll={false}
                              aria-pressed={selected}
                              className={`flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4 sm:text-[14px] ${
                                selected
                                  ? "bg-accent text-white"
                                  : "text-muted hover:text-ink"
                              }`}
                            >
                              {mode.value === "SALE"
                                ? "Buy"
                                : mode.value === "RENT"
                                  ? "Rent"
                                  : "PG"}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* The row. This is where the cards belong; the orbit above is this
                same row, translated. */}
            <ul className="mt-7 flex flex-wrap justify-center gap-2 sm:gap-3.5">
              {PROPERTY_TYPES.map((type, index) => {
                const orbit = orbits[index];
                const selected = type.value === propertyType;
                const t = cardProgress(index);
                const away = 1 - t;

                // The card travels along an ARC, not a straight line: the angle
                // sweeps round the ring while the radius shrinks to the slot.
                // A straight lerp from a ring point is a radial implosion, and
                // the card at the top of the ring would pass straight through
                // the map on its way down.
                let dx = 0;
                let dy = 0;
                if (orbit && t < 1) {
                  const angle = orbit.a0 + orbit.sweep * t;
                  const r = orbit.r0 + (orbit.r1 - orbit.r0) * t;
                  dx = Math.cos(angle) * r - orbit.vx;
                  dy = Math.sin(angle) * r - orbit.vy;
                }
                // Scattered cards are a little larger, and shrink in. scale, not
                // width: a transform, so it costs no layout.
                const scale = 1 + (ORBIT_SCALE - 1) * away;
                return (
                  <li
                    key={type.value}
                    ref={(element) => {
                      cards.current[index] = element;
                    }}
                    style={{
                      transform: orbit
                        ? `translate3d(${dx}px, ${dy}px, 0) rotate(${(ORBIT_TILT[index] ?? 0) * away}deg) scale(${scale})`
                        : undefined,
                      // Hidden for the first frame only, before measuring: the
                      // row would otherwise flash before the orbit snaps out.
                      opacity: ready ? 1 : 0,
                      // A card still travelling sits above one that has landed.
                      zIndex: orbit ? (t < 1 ? 7 : 6) : undefined,
                    }}
                    className="will-change-transform"
                  >
                    <Link
                      href={href("propertyType", type.value)}
                      scroll={false}
                      aria-pressed={selected}
                      className={`group plinth relative flex w-[118px] flex-col items-stretch gap-1.5 rounded-2xl bg-panel p-2 text-left ring-1 transition-shadow hover:shadow-[0_12px_32px_-18px_rgba(121,71,198,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-[140px] ${
                        selected ? "ring-2 ring-accent" : "ring-line"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={categoryPhoto(type.value)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="plinth-solid h-[62px] w-full rounded-xl object-cover sm:h-[70px]"
                      />
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold leading-tight text-ink sm:text-[13px]">
                        <span
                          aria-hidden="true"
                          style={{ background: TYPE_COLOUR[type.value] }}
                          className="h-[7px] w-[7px] shrink-0 rounded-full"
                        />
                        {type.label}
                      </span>
                      {/* Their caption, fading as the cards tidy up. Absolutely
                          positioned and opacity-only: animating its height
                          forced a layout every frame and made the row's height
                          change while cards were still arriving. */}
                      <span
                        aria-hidden={away < 0.5}
                        style={{ opacity: away }}
                        className="pointer-events-none absolute left-0 right-0 top-full pt-1 text-center text-[10px] leading-snug text-muted"
                      >
                        Browse {type.label.toLowerCase()} &#8599;
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroStage;
