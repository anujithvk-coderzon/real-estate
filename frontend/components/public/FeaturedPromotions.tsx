"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

// One live banner, exactly as GET /promotion/active sends it: the kind, the
// slug of the thing promoted, and the CDN url of the artwork.
//
// Both are optional in the type because both can be missing in the data. The
// service spreads type and slug in together only when the row has a listing
// or a project, and Listing.slug / Project.slug are String? in the schema — so
// a row whose slug was never generated arrives with slug: undefined. Either
// way there is no URL to build, and the banner renders as an image alone.
type ActivePromotion = {
  path: string;
  type?: "Listing" | "Project";
  slug?: string | null;
};

// The API returns every active banner with no limit and no order. The carousel
// hides the cost of extra banners in scroll rather than screen height, but a
// visitor still will not sit through fifty, and each one is a network request.
const MAX = 6;

// Long enough to read a banner, short enough that the second one is seen
// before the visitor scrolls past. Only ever runs while nobody is touching it.
const INTERVAL = 5_000;

// Asked at the moment of scrolling, not stored: someone can change this
// setting while the page is open, and the next scroll should respect it.
const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FeaturedPromotions = () => {
  // [] not null: nothing here has a loading state. A buyer who sees the hero
  // and then has the page jump as banners arrive is worse off than one who
  // never sees them, so the section is absent until there is something in it.
  const [promotions, setPromotions] = useState<ActivePromotion[]>([]);
  // Which slide is in view. Derived from the scroll position rather than
  // commanded, so a thumb swipe and an arrow press update the dots the same
  // way and nothing can disagree about where we are.
  const [index, setIndex] = useState(0);
  // The explicit control. interacting is the implicit one — a pointer over the
  // strip or a focused link inside it — and both stop the timer.
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let live = true;
    api.get("/promotion/active").then(
      ({ data }) => {
        if (!live) return;
        setPromotions(data.promotions ?? []);
        // Set here rather than in an effect: this is the moment the carousel
        // first has something to move, and a visitor who has asked their OS
        // to stop animations should not have to catch it moving once first.
        // The Pause button becomes a Play button for them, so the control is
        // still real — it is their choice to start it, not ours.
        if (reduceMotion()) setPaused(true);
      },
      () => {
        // Advertising that failed to load is not an error a buyer should be
        // told about. The properties below are the page; this is a strip.
        if (live) setPromotions([]);
      },
    );
    return () => {
      // Left the page before it answered.
      live = false;
    };
  }, []);

  const shown = promotions.slice(0, MAX);
  const count = shown.length;
  const many = count > 1;

  // Scrolling the container IS the animation — no transforms, no track width
  // arithmetic. The browser gets snap points, so a swipe on a phone lands on
  // a slide for free and this function only has to nudge the same mechanism.
  const goTo = useCallback(
    (next: number) => {
      const element = track.current;
      if (!element || count === 0) return;
      // Wraps both ways, so neither arrow is ever a dead end and the timer can
      // run forever without walking off the last slide.
      const wrapped = (next + count) % count;
      element.scrollTo({
        left: wrapped * element.clientWidth,
        behavior: reduceMotion() ? "auto" : "smooth",
      });
    },
    [count],
  );

  useEffect(() => {
    if (!many || paused || interacting) return;
    // A timeout per slide, not one repeating interval: it restarts whenever
    // the slide changes, so a visitor who presses the arrow gets a full read
    // of the slide they chose instead of whatever was left of the old tick.
    const timer = setTimeout(() => goTo(index + 1), INTERVAL);
    return () => clearTimeout(timer);
  }, [many, paused, interacting, index, goTo]);

  if (count === 0) return null;

  const onScroll = () => {
    const element = track.current;
    if (!element) return;
    const at = Math.round(element.scrollLeft / element.clientWidth);
    const clamped = Math.min(Math.max(at, 0), count - 1);
    // Fires continuously while a smooth scroll runs; only a changed slide is
    // worth a render.
    if (clamped !== index) setIndex(clamped);
  };

  // Two layers on purpose. The button keeps a 44px tap target, because a 32px
  // one on a phone is hit by luck; only the disc you can see inside it shrinks.
  const arrow =
    "group absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  // Light enough to sit over a banner without competing with it: a translucent
  // disc, a hairline ring and muted ink, darkening only on hover.
  const disc =
    "flex h-8 w-8 items-center justify-center rounded-full bg-panel/75 text-muted ring-1 ring-line/60 backdrop-blur-sm transition-colors group-hover:bg-panel group-hover:text-ink sm:h-10 sm:w-10 sm:bg-panel/90";

  return (
    <section aria-labelledby="featured-heading" className="pb-7">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="featured-heading" className="font-display text-[20px]">
          Featured
        </h2>
        <div className="flex items-center gap-3">
          {/* The word every platform uses, because it is the one a buyer
              recognises without reading it twice: these are up because the
              people listing them put them up, not because they rank. */}
          <p className="annot">Sponsored</p>
          {many && (
            // WCAG 2.2.2: anything that moves on its own for more than five
            // seconds owes the visitor a way to stop it, and hover does not
            // count — a keyboard has no hover.
            <button
              type="button"
              onClick={() => setPaused((was) => !was)}
              className="text-[12.5px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured properties"
        className="relative mt-3"
        // Both halves of the implicit pause. A visitor reading a banner, or
        // tabbing to the link inside one, must not have it slide away.
        onMouseEnter={() => setInteracting(true)}
        onMouseLeave={() => setInteracting(false)}
        onFocus={() => setInteracting(true)}
        onBlur={() => setInteracting(false)}
      >
        <ul
          ref={track}
          onScroll={onScroll}
          // overscroll-contain: on a phone, swiping past the last slide should
          // not hand the gesture to the browser's back navigation.
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {shown.map((promotion, slide) => {
            // /property/[slug] is the only public detail route the site has;
            // there is no app/project/[slug] yet, so a project banner is still
            // artwork with nowhere to go. One line to change when that page
            // exists.
            const href =
              promotion.type === "Listing" && promotion.slug
                ? `/property/${promotion.slug}`
                : null;

            const frame = (
              <div className="relative aspect-[5/3] overflow-hidden rounded-2xl bg-ground ring-1 ring-line sm:aspect-[3/1]">
                {/* object-contain keeps the seller's banner uncropped; a
                    blurred copy of it fills whatever is left of the frame. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={promotion.path}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={promotion.path}
                  alt={
                    promotion.type === "Project"
                      ? "Featured project"
                      : "Featured property"
                  }
                  // The first slide is what a visitor lands on, so it is not
                  // lazy; the rest are off screen until they scroll.
                  loading={slide === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="relative h-full w-full object-contain"
                />
              </div>
            );

            return (
              <li
                key={promotion.path}
                aria-roledescription="slide"
                aria-label={`${slide + 1} of ${count}`}
                className="w-full flex-none snap-center"
              >
                {href ? (
                  <Link
                    href={href}
                    className="block rounded-2xl transition-shadow hover:shadow-[0_12px_32px_-18px_rgba(121,71,198,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {frame}
                  </Link>
                ) : (
                  frame
                )}
              </li>
            );
          })}
        </ul>

        {many && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous banner"
              className={`${arrow} left-1 sm:left-3`}
            >
              <span className={disc}>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next banner"
              className={`${arrow} right-1 sm:right-3`}
            >
              <span className={disc}>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </>
        )}
      </div>

      {many && (
        // Dots are both the position and the shortcut. Hit area is 44px; the
        // mark inside it is small.
        <div className="mt-1 flex justify-center">
          {shown.map((promotion, slide) => (
            <button
              key={promotion.path}
              type="button"
              onClick={() => goTo(slide)}
              aria-label={`Show banner ${slide + 1}`}
              aria-current={slide === index}
              className="flex h-11 w-7 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all ${
                  slide === index ? "w-5 bg-accent" : "w-1.5 bg-line"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default FeaturedPromotions;
