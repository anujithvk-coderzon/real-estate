"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ListingImage } from "@/lib/types";

type Props = {
  images: Pick<ListingImage, "path">[]; // only the URL is needed, so public pages work without ids
  title: string;
};

// 44px at base: on a phone these arrows are the only way through the photos.
const arrowButton =
  "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-panel/90 text-ink shadow-md backdrop-blur-sm transition-[background-color,transform] hover:bg-panel active:scale-95 motion-reduce:active:scale-100 sm:h-10 sm:w-10";

// One large photo with previous / next arrows and a row of thumbnails.
//
// The photo slides in from the side you asked for: press next and the new one
// arrives from the right, press previous and it comes from the left. That is the
// whole reason this animates — it tells you which way you moved through the set,
// which a crossfade cannot. Looking at photographs is most of what a buyer does
// on this page, so it is worth the care.
const Gallery = ({ images, title }: Props) => {
  // The photo and the direction it arrived from, in ONE piece of state. They
  // have to change together: a ref would be read during render, which React
  // forbids because the render that moves the photo could still see the old
  // direction. Keeping them as a pair makes that impossible.
  const [[active, direction], setView] = useState<[number, number]>([0, 1]);
  const still = useReducedMotion();
  const count = images.length;

  // Wraps around, so "next" on the last photo goes back to the first.
  const show = (index: number, by: number) =>
    setView([(index + count) % count, by]);

  // A thumbnail can jump several photos; the slide follows the real direction.
  const jump = (index: number) => setView([index, index > active ? 1 : -1]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-ink/[0.04] ring-1 ring-line">
        {/* mode="popLayout" keeps the leaving photo out of the layout, so the
            two never stack and push the frame taller mid-transition. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={images[active].path}
            src={images[active].path}
            alt={`${title} — photo ${active + 1}`}
            initial={still ? false : { opacity: 0, x: direction * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={still ? {} : { opacity: 0, x: direction * -48 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="aspect-[4/3] w-full object-contain sm:aspect-[16/9] lg:max-h-[460px]"
          />
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => show(active - 1, -1)}
              aria-label="Previous photo"
              className={`left-3 ${arrowButton}`}
            >
              &#8592;
            </button>
            <button
              type="button"
              onClick={() => show(active + 1, 1)}
              aria-label="Next photo"
              className={`right-3 ${arrowButton}`}
            >
              &#8594;
            </button>
          </>
        )}
        <span className="absolute bottom-3 right-3 z-10 rounded-full bg-ink/70 px-2.5 py-0.5 text-[12px] tabular-nums text-white">
          {active + 1} / {count}
        </span>
      </div>

      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={image.path} className="shrink-0">
              <button
                type="button"
                onClick={() => jump(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active}
                className={`relative block overflow-hidden rounded-lg transition-opacity ${
                  index === active ? "" : "opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.path}
                  alt=""
                  className="h-16 w-24 object-cover sm:h-20 sm:w-28"
                />
                {/* The ring travels between thumbnails rather than blinking on
                    and off, so the eye can follow where it went. layoutId is
                    what makes one element appear to move between parents. */}
                {index === active && (
                  <motion.span
                    layoutId="gallery-active"
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-accent"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Gallery;
