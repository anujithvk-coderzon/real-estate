"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import MapPlate from "@/components/public/MapPlate";
import NearbyButton from "@/components/public/NearbyButton";
import SearchBar, { FIELD_LABEL } from "@/components/public/SearchBar";
import { authReady, isSignedIn } from "@/lib/api";
import {
  NO_BEDROOMS,
  RADIUS_OPTIONS,
  SEARCH_LISTING_TYPES,
  SEARCH_PROPERTY_TYPES,
  TYPE_COLOUR,
  categoryPhoto,
  listingTypeOptions,
  propertyTypeOptions,
} from "@/lib/listing";

// The hero: a circular plate with the controls on it — looking to, property
// type, distance, where, search — and the property types scattered in orbit
// around it, gathered into a row by the scroll.
//
// The cards are decoration. They were links, and a photograph of a villa that
// filters when pressed is a control you cannot tell is a control, sitting on
// the same screen as the select that asks the same question. So the orbit
// stays and the pressing does not: aria-hidden, pointer-events-none, and the
// accent ring still following the chosen type because reflecting an answer is
// information rather than interaction.
//
// The implementation is inverted from the reference's, on purpose. There, the
// scattered position is measured and the row is computed every frame from
// offsetLeft/offsetTop — which forces a layout recalculation on each scroll
// event. Here the ROW is the cards' natural CSS position and the orbit is a
// transform away from it, so the scroll handler only ever writes transforms
// and the browser never has to re-lay out the page. Measuring happens once
// per resize.

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
// One angle per card, spread evenly. Derived from the list rather than written
// as 7, so folding Office into Commercial re-spaces the ring instead of
// leaving a gap where the seventh card used to be.
//
// 270 is straight up, and with SEVEN cards 90° — straight down, where the row
// forms and the line about it now sits — fell between two of them. With SIX it
// lands exactly on one, so an even count starts half a step round and keeps the
// bottom of the ring clear.
const ORBIT_STEP = 360 / SEARCH_PROPERTY_TYPES.length;
const ORBIT_DEGREES = Array.from(
  { length: SEARCH_PROPERTY_TYPES.length },
  (_, index) =>
    270 +
    (SEARCH_PROPERTY_TYPES.length % 2 === 0 ? ORBIT_STEP / 2 : 0) +
    index * ORBIT_STEP,
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
const SPAN = 1 - STAGGER * (SEARCH_PROPERTY_TYPES.length - 1);

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

// The card's two selects. A field, not a button: sunken fill, hairline ring,
// and the browser's own chevron doing the "this opens" work.
const HERO_SELECT =
  "h-11 w-full rounded-lg bg-ground px-2 text-[15px] font-medium text-ink ring-1 ring-line focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-10 md:bg-panel/95 md:backdrop-blur-sm";

const HeroStage = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const propertyType = searchParams.get("propertyType") ?? "";
  const listingType = searchParams.get("listingType") ?? "";
  // Empty means the API's default of 10 km, which is what the ring must show.
  const radius = searchParams.get("radius") ?? "";

  const stage = useRef<HTMLDivElement>(null);
  // The positioned ancestor of both the plate and the row, so one offsetParent
  // walk puts them in the same coordinate space.
  const column = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const ring = useRef<HTMLDivElement>(null);

  // The visitor card's own three answers. Local, NOT the URL: this card is a
  // form with a Search button, and a form field that fires a request the
  // moment you touch it is a field that has taken the decision off you. Every
  // one of them used to write the URL, which refetched the grid below before
  // you had finished saying what you wanted.
  //
  // Seeded once from the URL so arriving at /?propertyType=VILLA shows Villa,
  // and deliberately not kept in step with it afterwards: the filter bar below
  // narrows THIS page, while this card starts a new search on another one.
  const [mode, setMode] = useState(listingType);
  const [kind, setKind] = useState(propertyType);
  const [km, setKm] = useState(radius);

  // null until the sign-in check settles, so neither version of the copy
  // flashes before the other. The same pattern PublicFrame uses.
  const [visitor, setVisitor] = useState<boolean | null>(null);
  const [orbits, setOrbits] = useState<Orbit[]>([]);
  const [ready, setReady] = useState(false);

  // Writes one choice into the URL — and drops anything already there that
  // cannot be true alongside it. The rules are not invented here: they are the
  // same lib/listing helpers the filter bar obeys. Without this the hero can
  // write combinations the catalogue has no answer for — Rent + Plot or land
  // is the obvious one, since a plot is never let — and the visitor gets an
  // empty page with nothing on screen explaining why.
  const href = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    // An empty value means "any", which is the absence of the parameter — not
    // ?propertyType= with nothing after it. Choosing the current value again
    // clears it too, so every chip is also its own off switch.
    if (!value || value === searchParams.get(name)) next.delete(name);
    else next.set(name, value);
    next.delete("page");

    const mode = next.get("listingType") ?? "";
    const kind = next.get("propertyType") ?? "";

    if (name === "listingType") {
      // Renting while Plot is selected: the type is the one that goes, because
      // the mode is what was just asked for.
      if (kind && !propertyTypeOptions(mode).some((o) => o.value === kind))
        next.delete("propertyType");
      // A ceiling picked for monthly rents means nothing against sale prices.
      next.delete("maxPrice");
    }

    if (name === "propertyType") {
      // The mirror of the above: ask for plots while Rent is on and the MODE
      // is what cannot hold, so that is what is dropped. Clearing it beats
      // silently switching them to Buy, which would answer a question they
      // did not ask.
      if (mode && !listingTypeOptions(kind).some((o) => o.value === mode))
        next.delete("listingType");
      // Commercial, office and plots have no bedrooms to filter on.
      if (NO_BEDROOMS.includes(kind)) next.delete("beds");
    }

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
    if (!plateEl || !root) {
      setReady(true);
      return;
    }

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
    if (cards.current.length < SEARCH_PROPERTY_TYPES.length) {
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
      for (let index = 0; index < SEARCH_PROPERTY_TYPES.length; index += 1) {
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
  // No drawing: it is a first-impression device, saying "this site sells
  // homes, plots, offices and rooms" to somebody who has never been here. A
  // returning user already knows, and a 230px illustration between them and
  // their listings is a tax.
  //
  // So they get the same questions in a flat row — where, what, how far — and
  // keep the type chips, which here are a one-line filter bar over their own
  // page rather than a second answer to the card above. Nothing moves except
  // what answers a press.
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
            {/* The same reason the visitor hero passes these: compact renders
                neither control, so without them the form submits an empty mode
                and type and the Buy / Rent choice made right below is dropped
                on the way to the results page. */}
            <SearchBar
              variant="compact"
              initialValues={{ listingType, propertyType }}
            />
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
                    aria-current={selected ? "true" : undefined}
                    className={`flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? "bg-accent-soft text-accent ring-1 ring-accent"
                        : "bg-panel text-ink shadow-[0_1px_1px_rgba(48,32,68,0.06)] ring-1 ring-line hover:ring-accent/60"
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
              {SEARCH_PROPERTY_TYPES.map((type) => {
                const selected = type.value === propertyType;
                return (
                  <li key={type.value}>
                    <Link
                      href={href("propertyType", type.value)}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
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
          Search any locality in India, set how far you will travel, and see
          every match on a map.
        </p>
      </div>

      {/* ---------- the stage ---------- */}
      {/* The 180px of top padding below is clearance for the card that orbits
          directly above the plate; the clip is because the ones on the flanks
          reach outside the content column on their way in and must not widen
          the page. Neither applies on a phone, where there is no room for an
          orbit and the row is hidden. */}
      <div
        ref={stage}
        // overflow-clip: the cards reach outside the content column on their
        // way in and must not widen the page.
        className="relative md:overflow-clip"
      >
        <div>
          <div
            ref={column}
            // Enough room underneath that the section breathes into the next
            // one. It carries the whole separation, there being no rule along
            // the bottom, so it is a little more generous on a wide screen.
            className="relative mx-auto w-full max-w-7xl px-5 pb-10 pt-4 md:pb-16 md:pt-[180px] lg:px-10"
          >
            <div className="flex justify-center">
              {/* A phone puts the drawing behind the card; from md the card
                  sits on the middle of it. */}
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
                  {/* The ring is the card's distance drawn, so it reads the
                      card's state. It answers the select immediately, which is
                      the feedback that control used to buy with a request. */}
                  <MapPlate radiusKm={Number(km) || 10} />
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
                <div className="relative mt-[118px] flex flex-col gap-1.5 rounded-2xl bg-panel p-2 shadow-[0_18px_44px_-22px_rgba(48,32,68,0.5)] ring-1 ring-line md:absolute md:inset-x-9 md:top-1/2 md:mt-0 md:-translate-y-1/2 md:gap-2.5 md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:ring-0">
                  {/* Buy / Rent sits first in the DOM because on a phone it
                        sits first on the screen. It used to be second here and
                        first visually, via order-first — so a thumb read mode,
                        place, distance while a keyboard and a screen reader got
                        place, distance, mode. Tab order that disagrees with the
                        layout is the kind of confusion nobody can point at.
                        From md the card opens out and the search goes back on
                        top, which is an ordering of the same two things, so
                        the explicit 1-2-3 below says it once. */}
                  <div className="md:flex md:justify-center">
                    {/* Two buttons with neither of them on does not read as a
                        choice at all — which is exactly how it read. The
                        caption says what the pair is for. sr-only from md,
                        where it floats on the map and a caption over a
                        two-button control would be noise. */}
                    <p id="hero-mode-label" className={FIELD_LABEL}>
                      Looking to
                    </p>
                    {/* Equal columns on a phone, one per mode: a segmented
                          control that does not fill its line reads as loose
                          buttons. It said grid-cols-3 from when PG was a third
                          choice here — with two modes that left an empty third
                          of the row, which is what made the pair look stranded.
                          From md it needs its own surface, because
                          sitting straight on the map it would be unreadable
                          over the roads. */}
                    <div
                      role="group"
                      aria-labelledby="hero-mode-label"
                      className="grid grid-cols-2 gap-1 rounded-xl bg-ground p-1 md:inline-flex md:bg-panel/95 md:shadow-[0_8px_24px_-12px_rgba(48,32,68,0.3)] md:ring-1 md:ring-line md:backdrop-blur-sm"
                    >
                      {SEARCH_LISTING_TYPES.map((option) => {
                        const selected = option.value === mode;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            // Pressing the chosen one again clears it, so "any"
                            // stays reachable without a third button.
                            onClick={() =>
                              setMode(selected ? "" : option.value)
                            }
                            aria-pressed={selected}
                            className={`flex h-10 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-9 md:px-4 md:text-[14px] ${
                              selected
                                ? "bg-accent-soft text-accent ring-1 ring-accent"
                                : "bg-panel text-ink shadow-[0_1px_1px_rgba(48,32,68,0.06)] ring-1 ring-line hover:ring-accent/60"
                            }`}
                          >
                            {option.value === "SALE" ? "Buy" : "Rent"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Two-up: both are one-word questions with short answers,
                      so a row each was height spent on nothing.
                      
                      These are what answers the type question now — the
                      orbiting cards below are decoration. A grid of pictures
                      is a browse list, not a filter: no selected state once it
                      has scrolled past, and a second control for something
                      this card already asks.

                      Both are plain form fields: they change this card and
                      nothing else until Search is pressed. The distance still
                      shows its work immediately, because the ring behind the
                      card is drawn from it. */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="min-w-0">
                      <label htmlFor="hero-type" className={FIELD_LABEL}>
                        Property type
                      </label>
                      <select
                        id="hero-type"
                        value={kind}
                        onChange={(event) => setKind(event.target.value)}
                        className={HERO_SELECT}
                      >
                        <option value="">Any type</option>
                        {propertyTypeOptions(mode, SEARCH_PROPERTY_TYPES).map(
                          (option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="hero-radius" className={FIELD_LABEL}>
                        Distance
                      </label>
                      <select
                        id="hero-radius"
                        value={km}
                        onChange={(event) => setKm(event.target.value)}
                        className={HERO_SELECT}
                      >
                        {/* Bare numbers: the caption above already says what is
                            being measured, so "Within" on every line was the
                            same word four times in a 150px control. */}
                        <option value="">10 km</option>
                        {RADIUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* The mode and type are not fields in here; they are
                        the hero's own controls, held in the URL. Passed in so
                        the form submits the choice instead of dropping it. */}
                  <div>
                    <SearchBar
                      variant="compact"
                      initialValues={{
                        listingType: mode,
                        propertyType: kind,
                        radius: km,
                      }}
                    />
                  </div>

                  {/* The phone is the device that has a GPS chip, so this is
                        the one control that belongs to it first. */}
                  <div className="md:flex md:justify-center">
                    <NearbyButton />
                  </div>
                </div>
              </div>
            </div>
            {/* The types, in orbit. Decoration, not controls: the drawing
                and these cards are the first-impression device — "this site
                sells homes, plots, offices and rooms" — while the filtering is
                the select in the card above. They were links, which is what
                made a picture of a villa read as a button you press to filter,
                and put two controls for one question on one screen.

                pointer-events-none and aria-hidden, so there is nothing to
                press and nothing announced twice. The accent ring still tracks
                the chosen type, because reflecting the answer is information,
                not interaction. Desktop only — on a phone the row is 2 of
                screen spent on something you cannot use. */}
            {/* Why the cards are there. A statement, never an invitation:
                "browse by type" or "pick one" would promise the press that was
                deliberately taken away from them. It also answers the question
                a decorative row raises on its own — what are these for — and
                says the one thing visitors get wrong about the search, that
                leaving the type alone returns all of them rather than none. */}
            <div className="mt-12 hidden text-center md:block">
              <h2 className="font-display text-[20px] leading-tight">
                Every kind of property, in one search
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted">
                Apartments and houses, villas, land, shops and single rooms.
                Leave the type alone above and the search returns all of them.
              </p>
            </div>

            <ul
              aria-hidden="true"
              className="mt-6 hidden flex-wrap justify-center gap-3.5 md:flex"
            >
              {SEARCH_PROPERTY_TYPES.map((type, index) => {
                const selected = type.value === kind;
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
                    <div
                      className={`plinth pointer-events-none relative flex w-[140px] flex-col items-stretch gap-1.5 rounded-2xl bg-panel px-2 py-2 text-left text-[13px] ring-1 ${
                        selected ? "ring-2 ring-accent" : "ring-line"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={categoryPhoto(type.value)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="plinth-solid h-[70px] w-full rounded-xl object-cover"
                      />
                      <span className="flex items-start gap-1.5 text-[inherit] font-semibold leading-tight text-ink">
                        <span
                          aria-hidden="true"
                          style={{ background: TYPE_COLOUR[type.value] }}
                          className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
                        />
                        {type.label}
                      </span>
                    </div>
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
