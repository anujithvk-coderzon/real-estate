"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { api } from "@/lib/api";
import { formatRupeesShort } from "@/lib/format";
import { secondaryButton } from "@/lib/ui";

// One row of GET /list/similar/:slug. Deliberately thinner than a search
// result: this strip is a nudge towards the next property, not a result set.
type SimilarListing = {
  slug: string;
  title: string;
  price: string;
  locality: string | null;
  image: string | null;
};

type Props = {
  slug: string;
  // The locality the heading names, so the section says where instead of
  // "in this area".
  place?: string | null;
};

// The page size the API uses (take=8 in similarListingService), so the button
// promises exactly what arrives.
const PER_PAGE = 8;

const SimilarListings = ({ slug, place }: Props) => {
  const [listings, setListings] = useState<SimilarListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // Phones lay this out as a swipeable strip, so new cards land off-screen to
  // the right; the ref is how the strip is nudged over to show them.
  const strip = useRef<HTMLUListElement | null>(null);
  const still = useReducedMotion();

  // A failure is silent on purpose. This section is a suggestion, and an error
  // about other properties would only distract from the one being viewed.
  useEffect(() => {
    let live = true;
    api
      .get(`/list/similar/${slug}?page=1`)
      .then(({ data }) => {
        if (!live) return;
        setListings(data.result.result ?? []);
        setTotal(data.result.count ?? 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);

  const showMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/list/similar/${slug}?page=${next}`);
      // Appended, not replaced: nobody loses the cards they were reading.
      setListings((previous) => [...previous, ...(data.result.result ?? [])]);
      setTotal(data.result.count ?? 0);
      setPage(next);
      // On a phone the new cards are off to the right, so the tap would look
      // like it did nothing. Only scrolls when the strip really is scrollable,
      // which is false once the layout becomes a grid.
      requestAnimationFrame(() => {
        const element = strip.current;
        if (!element || element.scrollWidth <= element.clientWidth) return;
        element.scrollBy({
          left: element.clientWidth * 0.85,
          behavior: still ? "auto" : "smooth",
        });
      });
    } catch {
      // The button stays where it is; a second tap is the cheapest retry.
    } finally {
      setLoadingMore(false);
    }
  };

  // Nothing to suggest, so nothing on the page — no heading over an empty grid.
  if (listings.length === 0) return null;

  const remaining = total - listings.length;

  return (
    <section
      aria-labelledby="similar-heading"
      // The rule is structural: everything above belongs to this property,
      // everything below is a different one.
      className="mt-12 border-t border-line pt-10 lg:mt-16"
    >
      <h2
        id="similar-heading"
        className="font-display text-[20px] leading-tight lg:text-[22px]"
      >
        {place ? `More properties in ${place}` : "More properties in this area"}
      </h2>
      <p className="mt-1.5 text-[14px] text-muted">
        {total === 1
          ? "One other listing here, newest first."
          : `${total} other listings here, newest first.`}
      </p>

      {/* Phones get a swipeable strip that runs to the edge of the screen, so a
          long list costs one gesture instead of a screenful of scrolling. From
          640px up there is room to scan, so it becomes a grid. */}
      <ul
        ref={strip}
        className="-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden"
      >
        {listings.map((listing) => (
          <li
            key={listing.slug}
            // 244px leaves the next card peeking even on a 320px screen, which
            // is the only hint a strip needs that it scrolls.
            className="w-[244px] shrink-0 snap-start sm:w-auto"
          >
            {/* Lifts on approach like the search cards, so a card here reads as
                the same kind of object as a card there. */}
            <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_32px_-16px_rgba(48,32,68,0.28)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <div className="relative aspect-[16/10] overflow-hidden bg-ground">
                {listing.image ? (
                  <>
                    {/* A blurred copy fills the frame so the photograph itself
                        is never cropped — the treatment the search card uses. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="relative h-full w-full object-contain"
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px] text-muted">
                    No photographs
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-3.5">
                <h3 className="truncate text-[14.5px] font-semibold leading-snug text-ink">
                  {/* The overlay makes the whole card clickable, without a
                      second link for a screen reader to read out. */}
                  <Link
                    href={`/property/${listing.slug}`}
                    title={listing.title}
                    className="after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {listing.title}
                  </Link>
                </h3>

                {listing.locality && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                    <span aria-hidden="true">&#8982;</span>
                    <span className="min-w-0 truncate">{listing.locality}</span>
                  </p>
                )}

                <p className="mt-auto pt-3 text-[17px] font-bold leading-none tabular-nums text-ink">
                  {formatRupeesShort(listing.price)}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {/* Only while the server still holds rows nobody has asked for. */}
      {remaining > 0 && (
        <button
          type="button"
          onClick={showMore}
          disabled={loadingMore}
          // Full width on phones so it is a comfortable thumb target under the
          // strip; its own width once there is room beside it.
          className={`mt-6 w-full sm:w-auto ${secondaryButton}`}
        >
          {loadingMore
            ? "Loading"
            : `Show ${Math.min(PER_PAGE, remaining)} more`}
        </button>
      )}

      {/* Keyboard and screen reader users get told what the new cards did. */}
      {page > 1 && (
        <p aria-live="polite" className="sr-only">
          Showing {listings.length} of {total} listings.
        </p>
      )}
    </section>
  );
};

export default SimilarListings;
