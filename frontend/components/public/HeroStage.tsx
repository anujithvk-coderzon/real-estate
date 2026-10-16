"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import MapPlate from "@/components/public/MapPlate";
import SearchBar from "@/components/public/SearchBar";
import { authReady, isSignedIn } from "@/lib/api";
import {
  SEARCH_LISTING_TYPES,
  PROPERTY_TYPES,
  TYPE_COLOUR,
  categoryPhoto,
} from "@/lib/listing";

// The hero: a circular plate with the search at its centre, the property types
// scattered in orbit around it, and a scroll that gathers them into the row they
// live in for the rest of the page.
//
// Built to the reference's own numbers: 280px of scroll, a sticky stage, cards
// that straighten out of a tilt, and the
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
// How much larger a card is while it orbits. Its own width and height are
// measured rather than written down here: a card is 118px wide on a phone and
// 140 from sm up, so a radius built on a hardcoded size is wrong at one of them
// — either the cards overlap the drawing or they hang off the stage.
const ORBIT_SCALE = 1.08;
// Clearance between the plate's edge and a card's nearest corner.
const PLATE_GAP = 22;
// How far the gather takes, in pixels of scroll. Theirs is 280. This is also
// exactly how much taller than its content the stage has to be, since the hero
// is pinned while the gather runs — lower it and both shrink together.
const TRAVEL = 280;

// How hard the motion is pulled toward the scroll position, per second.
// Scroll arrives in lumps — a wheel notch is ~100px at once, a trackpad fires
// several events in one frame — so following it exactly makes the cards step.
// Chasing it with an exponential ease turns those lumps into one continuous
// line without lagging far enough behind to feel disconnected. 12 trails ~80ms.
const CHASE = 12;
// Below this the gap is invisible, so the loop stops rather than burning frames
// asymptotically approaching the target.
const SETTLED = 0.0004;
// Below this stage width there is nowhere outside the circle for a card to be,
// so the cards simply start where they belong and nothing animates. The ring is
// about 707px across, plus a card's half width on each side.
const MIN_STAGE_WIDTH = 740;

// Each card runs its own window of the scroll, 6% apart, so they arrive in
// sequence instead of all landing on the same frame. Seven cards moving in
// perfect unison read as a mechanism resetting, not as things gathering.
const STAGGER = 0.06;
const SPAN = 1 - STAGGER * (7 - 1);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
// Fast at the start, slow at the finish, so a card eases into its slot rather
// than stopping dead on arrival.
const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);

// useLayoutEffect on the client so the first transform is written in the same
// commit as the markup — otherwise the cards paint once in the row and jump
// out to the ring on the frame after. useEffect on the server, where there is
// no layout and React would warn.
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  const ring = useRef<HTMLDivElement>(null);


  // null until the sign-in check settles, so neither version of the copy
  // flashes before the other. The same pattern PublicFrame uses.
  const [visitor, setVisitor] = useState<boolean | null>(null);
  const [orbits, setOrbits] = useState<Orbit[]>([]);
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
    const plateEl = plate.current;
    const root = column.current;
    if (!plateEl || !root) return;

    const host = stage.current;
    const stageWidth = host?.clientWidth ?? plateEl.offsetWidth;

    // The orbit needs room for the plate PLUS a card either side of it.
    if (stageWidth < MIN_STAGE_WIDTH) {
      setOrbits([]);
      setReady(true);
      return;
    }

    // A card's nearest CORNER is what has to clear the plate, not its centre.
    // Testing the centre is what let four of seven sit on top of the drawing.
    // offsetWidth/offsetHeight are layout values, so the scale a card is
    // currently painted at does not skew them.
    let halfW = 0;
    let halfDiagonal = 0;
    for (const card of cards.current) {
      if (!card) continue;
      const w = (card.offsetWidth * ORBIT_SCALE) / 2;
      const h = (card.offsetHeight * ORBIT_SCALE) / 2;
      halfW = Math.max(halfW, w);
      halfDiagonal = Math.max(halfDiagonal, Math.hypot(w, h));
    }
    if (!halfDiagonal) {
      setOrbits([]);
      setReady(true);
      return;
    }

    const centre = offsetWithin(plateEl, root);
    const cx = centre.x + plateEl.offsetWidth / 2;
    const cy = centre.y + plateEl.offsetHeight / 2;
    const plateRadius = plateEl.offsetWidth / 2;

    // A circle, not an ellipse, and the radius carries the card's half-diagonal
    // so its nearest corner lands PLATE_GAP outside the plate at every angle.
    // An ellipse was the mistake here: squashing it vertically to dodge the
    // headline pulled the upper cards back over the drawing.
    const radius = plateRadius + PLATE_GAP + halfDiagonal;

    // A card past the stage edge is clipped, and a clipped card looks broken
    // rather than scattered. If there is not room for the full radius there is
    // no room for an orbit — no orbit beats cards sitting on the map.
    if (radius + halfW + 8 > stageWidth / 2) {
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

  useIsoLayoutEffect(() => {
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

  // ---------- the motion engine ----------
  // The gather follows the scroll: nothing moves until the visitor does, and
  // the cards are wherever their scroll position says they are.
  //
  // Everything below writes to the DOM directly, in one requestAnimationFrame
  // per frame. It is not React state, which would mean re-rendering the hero,
  // the map drawing and all seven cards for every scroll event — and scroll
  // events can arrive several times in a single frame.
  useIsoLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Where the scroll says the gather should be. This hero is the first thing
    // on the page, so how far the page has scrolled IS how far the hero has
    // travelled. It used to measure the stage reaching the top of the screen,
    // which only made sense while the hero was pinned there — unpinned, that
    // start point is ~180px of scroll too late and the cards would still be
    // arriving as they left the screen.
    const targetNow = () => {
      const raw = clamp01(window.scrollY / TRAVEL);
      // Their behaviour for reduced motion: snap, do not travel.
      return reduced.matches ? (raw > 0.45 ? 1 : 0) : raw;
    };

    const paint = (value: number) => {
      for (let index = 0; index < PROPERTY_TYPES.length; index += 1) {
        const card = cards.current[index];
        if (!card) continue;
        const orbit = orbits[index];

        if (!orbit) {
          // No room for an orbit: the cards simply live in their row.
          card.style.transform = "";
          card.style.zIndex = "";
          continue;
        }

        const t = easeOut(clamp01((value - index * STAGGER) / SPAN));
        const away = 1 - t;

        // The card travels along an ARC, not a straight line: the angle sweeps
        // round the ring while the radius shrinks to the slot. A straight lerp
        // from a ring point is a radial implosion, and the card at the top of
        // the ring would pass straight through the map on its way down.
        const angle = orbit.a0 + orbit.sweep * t;
        const radius = orbit.r0 + (orbit.r1 - orbit.r0) * t;
        const dx = Math.cos(angle) * radius - orbit.vx;
        const dy = Math.sin(angle) * radius - orbit.vy;

        // Scattered cards are a little larger and shrink in. scale, not width:
        // a transform, so it costs no layout.
        const scale = 1 + (ORBIT_SCALE - 1) * away;
        // Squared, so the tilt is gone before the card lands rather than
        // straightening right up to the last pixel.
        const tilt = (ORBIT_TILT[index] ?? 0) * away * away;

        card.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(
          2,
        )}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        // A card still travelling sits above one that has landed.
        card.style.zIndex = t < 1 ? "7" : "6";
      }

      // The ring's own fade follows the gather as a whole, not any one card.
      if (ring.current) {
        ring.current.style.opacity = orbits.length
          ? (1 - easeOut(value) * 0.85).toFixed(3)
          : "1";
      }
    };

    // will-change promotes each card to its own compositor layer. Worth it
    // while they move, wasteful while they sit: seven permanent layers is
    // memory a phone would rather spend on the page.
    const lift = (on: boolean) => {
      for (const card of cards.current) {
        if (card) card.style.willChange = on ? "transform" : "";
      }
    };

    let value = targetNow();
    let frame = 0;
    let last = 0;
    paint(value);

    const tick = (now: number) => {
      // Seconds since the previous frame, capped so a backgrounded tab does not
      // come back and jump the whole distance in one step. Deriving the ease
      // from real elapsed time keeps the motion identical on a 60Hz and a
      // 120Hz screen — a fixed per-frame fraction runs twice as fast on 120.
      const dt = last ? Math.min(0.064, (now - last) / 1000) : 1 / 60;
      last = now;

      const target = targetNow();
      value += (target - value) * (1 - Math.exp(-CHASE * dt));
      if (Math.abs(target - value) < SETTLED) value = target;
      paint(value);

      if (value === target) {
        frame = 0;
        last = 0;
        lift(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (frame) return;
      last = 0;
      lift(true);
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake, { passive: true });
    return () => {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      if (frame) cancelAnimationFrame(frame);
      lift(false);
    };
    // Re-made whenever the measurements change, so paint always closes over the
    // current orbits.
  }, [orbits]);

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
              {SEARCH_LISTING_TYPES.map((mode) => {
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
    <section aria-labelledby="home-heading">
      {/* Left-aligned on a phone: in a 280px column, centred text starts every
          line in a different place and reads slower. Centred from md, where the
          measure is wide enough to carry it. */}
      <div className="mx-auto w-full max-w-7xl px-5 pt-8 text-left md:pt-14 md:text-center lg:px-10">
        {/* The eyebrow is the first 30px of a phone screen spent on a line that
            adds nothing the headline does not already say. */}
        <p className="annot hidden items-center gap-2 md:inline-flex">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-accent/60"
          />
          Your neighbourhood. Your next move.
        </p>
        <h1
          id="home-heading"
          className="mx-auto max-w-3xl font-display text-[30px] leading-[1.08] md:mt-3.5 md:text-[44px] lg:text-[52px]"
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
      {/* From md up this is a tall, clipping box: tall enough to scroll the
          gather through while the plate stays put, clipping because the
          orbiting cards reach outside the content column and must not create a
          horizontal scrollbar on the way.
          Below md there is no orbit — no room for one — so the box is neither
          fixed nor clipping. It used to be both, and 739px of phone content was
          being cut off inside a 520px box, which is why the bottom rows of
          cards were missing. A height that does not depend on its content is
          only safe when the content cannot grow. */}
      <div
        ref={stage}
        // No pinning and no travel padding: the section is exactly as tall as
        // what is in it. The gather runs while the hero scrolls up the screen
        // rather than while it holds still, which costs the hold but means
        // there is no empty room under it for the scroll to pass through.
        // overflow-clip stays: the cards reach outside the content column on
        // their way in and must not widen the page.
        className="relative md:overflow-clip"
      >
        <div>
          <div
            ref={column}
            // Enough room under the last row that the section breathes into
            // the next one. It carries the whole separation now that there is
            // no rule along the bottom, so it is a little more generous on a
            // wide screen than on a phone.
            className="relative mx-auto w-full max-w-7xl px-5 pb-10 pt-4 md:pb-16 md:pt-[180px] lg:px-10"
          >
            <div className="flex justify-center">
              {/* The phone stacks map, then controls, then types. From md the
                  controls move onto the middle of the map and the types go
                  into orbit around it. */}
              <div className="relative w-full md:w-[min(86vw,22rem)]">
                {/* The dashed orbit, fading back as the cards leave it — their
                    opacity curve, 1 down to 0.15. */}
                <div
                  ref={ring}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[116%] w-[132%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-line md:block"
                />
                {/* The drawing is the product's promise — we look around a
                    point — so on a phone it belongs BEHIND the control that
                    does the looking, as the ground the search card sits on.
                    As a 220px circle above the card it was a second object
                    competing for the first screen and saying nothing. Bleeds
                    past the column's padding to both screen edges; back to a
                    circle from md, where there is room for both. */}
                <div
                  ref={plate}
                  className="absolute -left-5 -right-5 top-0 h-[230px] overflow-hidden bg-ground md:relative md:left-auto md:right-auto md:mx-auto md:aspect-square md:h-auto md:w-full md:rounded-full md:ring-[9px] md:ring-panel"
                >
                  <MapPlate radiusKm={radiusKm} />
                  {/* Fades the drawing into the page, so the card's own edge
                      stays the strongest line on the screen. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-b from-ground/10 via-ground/30 to-ground md:hidden"
                  />
                </div>
                {/* Both first questions together: where, then what for. Half a
                    page apart they read as two unrelated controls; together
                    they read as one search.
                    A sibling of the map rather than a child of it, so the phone
                    can put them underneath in normal flow — inside, the circle
                    would clip them. From md they sit over the middle of it. */}
                {/* One card, so mode, place, distance and the button read as
                    one task rather than four separate controls stacked up.
                    From md it goes back to two transparent objects floating at
                    the centre of the circle. */}
                <div className="relative mt-[118px] flex flex-col gap-2 rounded-2xl bg-panel p-2 shadow-[0_18px_44px_-22px_rgba(48,32,68,0.5)] ring-1 ring-line md:absolute md:inset-x-9 md:top-1/2 md:mt-0 md:-translate-y-1/2 md:gap-2.5 md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:ring-0">
                    {/* The mode and type are not fields in here; they are
                        the hero's own controls, held in the URL. Passed in so
                        the form submits the choice instead of dropping it. */}
                    <SearchBar
                      variant="compact"
                      initialValues={{ listingType, propertyType }}
                    />
                    <div className="order-first md:order-none md:flex md:justify-center">
                      {/* Three equal columns on a phone: a segmented control
                          that does not fill its line reads as three loose
                          buttons. From md it needs its own surface, because
                          sitting straight on the map it would be unreadable
                          over the roads. */}
                      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ground p-1 md:inline-flex md:bg-panel/95 md:shadow-[0_8px_24px_-12px_rgba(48,32,68,0.3)] md:ring-1 md:ring-line md:backdrop-blur-sm">
                        {SEARCH_LISTING_TYPES.map((mode) => {
                          const selected = mode.value === listingType;
                          return (
                            <Link
                              key={mode.value}
                              href={href("listingType", mode.value)}
                              scroll={false}
                              aria-pressed={selected}
                              className={`flex h-10 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-9 md:px-4 md:text-[14px] ${
                                selected
                                  ? "bg-accent text-white"
                                  : "text-muted hover:text-ink"
                              }`}
                            >
                              {mode.value === "SALE" ? "Buy" : "Rent"}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            {/* The types. On a phone these are chips: the photograph is what
                makes them 100px tall each, and seven of those wrap into four
                rows that eat 424px of screen before anything else is reached.
                The label and its colour are the information — the colour is
                the same one the map pins use — so the picture is what goes.
                From md, where there is room, they become the photo cards the
                orbit gathers into. */}
            <p className="mt-7 text-[12.5px] font-semibold text-muted md:hidden">
              Or browse by type
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5 md:mt-7 md:justify-center md:gap-3.5">
              {PROPERTY_TYPES.map((type, index) => {
                const selected = type.value === propertyType;
                return (
                  <li
                    key={type.value}
                    ref={(element) => {
                      cards.current[index] = element;
                    }}
                    // Position, tilt, scale and stacking are written straight
                    // to this node by the engine above, never as props: a
                    // transform in JSX is a React render per scroll event.
                    style={{
                      // Hidden for the first frame only, before measuring: the
                      // row would otherwise flash before the orbit snaps out.
                      opacity: ready ? 1 : 0,
                    }}
                  >
                    <Link
                      href={href("propertyType", type.value)}
                      scroll={false}
                      aria-pressed={selected}
                      className={`group plinth relative flex h-9 items-center gap-1.5 rounded-full bg-panel px-3 text-left text-[12.5px] ring-1 transition-shadow hover:shadow-[0_12px_32px_-18px_rgba(121,71,198,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-auto md:w-[140px] md:flex-col md:items-stretch md:gap-1.5 md:rounded-2xl md:px-2 md:py-2 md:text-[13px] ${
                        selected ? "ring-2 ring-accent" : "ring-line"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={categoryPhoto(type.value)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="plinth-solid hidden w-full rounded-xl object-cover md:block md:h-[70px]"
                      />
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[inherit] font-semibold leading-tight text-ink md:items-start md:whitespace-normal">
                        <span
                          aria-hidden="true"
                          style={{ background: TYPE_COLOUR[type.value] }}
                          className="h-[7px] w-[7px] shrink-0 rounded-full md:mt-[5px]"
                        />
                        {type.label}
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
