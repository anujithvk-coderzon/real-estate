"use client";

import { useState } from "react";
import type { ListingImage } from "@/lib/types";

type Props = {
  images: ListingImage[];
  title: string;
};

const arrowButton =
  "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-panel/90 text-ink shadow-sm transition-colors hover:bg-panel";

// One large photo with previous / next arrows and a row of thumbnails.
const Gallery = ({ images, title }: Props) => {
  const [active, setActive] = useState(0);
  const count = images.length;

  // Wraps around, so "next" on the last photo goes back to the first.
  const show = (index: number) => setActive((index + count) % count);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-ink/[0.04] ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active].path}
          alt={`${title} — photo ${active + 1}`}
          className="aspect-[4/3] w-full object-contain sm:aspect-[16/9]"
        />
        {count > 1 && (
          <>
            <button type="button" onClick={() => show(active - 1)} aria-label="Previous photo" className={`left-3 ${arrowButton}`}>
              ←
            </button>
            <button type="button" onClick={() => show(active + 1)} aria-label="Next photo" className={`right-3 ${arrowButton}`}>
              →
            </button>
          </>
        )}
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-0.5 font-mono text-[12px] text-white">
          {active + 1} / {count}
        </span>
      </div>

      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active}
                className={`block overflow-hidden rounded-lg transition ${
                  index === active ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.path} alt="" className="h-16 w-24 object-cover sm:h-20 sm:w-28" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Gallery;
