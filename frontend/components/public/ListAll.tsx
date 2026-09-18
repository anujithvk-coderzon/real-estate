"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PublicListingCard from "@/components/listing/PublicListingCard";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import type { PublicListingSummary } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type PageResponse = { lists: PublicListingSummary[]; total?: number };

const fetchPage = async (page: number) => {
  const response = await api.get("/list/all", { params: { page } });
  return response.data as PageResponse;
};

// Public home page: everyone's published listings. The next page loads on its
// own as the visitor scrolls near the bottom.
const ListAll = () => {
  const [listings, setListings] = useState<PublicListingSummary[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [failed, setFailed] = useState(false);

  // A marker below the grid. When it scrolls into view, the next page loads.
  const endOfList = useRef<HTMLDivElement>(null);
  // Blocks a second request while one is in flight; a ref updates immediately,
  // unlike state, so fast scrolling cannot trigger two loads.
  const loading = useRef(false);
  // The last page loaded and how many listings are shown. Refs, not state: an
  // observer from an earlier render can still fire, and it must see the latest
  // values, or it would fetch the same page again and show it twice.
  const lastPage = useRef(0);
  const loadedCount = useRef(0);

  const applyPage = (pageNumber: number, data: PageResponse) => {
    lastPage.current = pageNumber;
    loadedCount.current = pageNumber === 1 ? data.lists.length : loadedCount.current + data.lists.length;

    setListings((prev) => {
      if (pageNumber === 1 || !prev) return data.lists;
      // A listing published while the visitor scrolls shifts every page by one,
      // so the next page can repeat the last card. Skip anything already shown.
      const shown = new Set(prev.map((listing) => listing.slug));
      return [...prev, ...data.lists.filter((listing) => !shown.has(listing.slug))];
    });
    if (typeof data.total === "number") setTotal(data.total);
    // With a total we know exactly; without one, an empty page means the end.
    setHasMore(
      typeof data.total === "number" ? loadedCount.current < data.total : data.lists.length > 0,
    );
  };

  useEffect(() => {
    fetchPage(1)
      .then((data) => applyPage(1, data))
      .catch((error) => {
        setFailed(true);
        errorToast(apiMessage(error));
      });
  }, []);

  const loadNext = async () => {
    if (loading.current || lastPage.current === 0) return;
    loading.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const next = lastPage.current + 1;
      applyPage(next, await fetchPage(next));
    } catch (error) {
      errorToast(apiMessage(error));
      setLoadMoreFailed(true); // stop auto-loading; the visitor can retry
    } finally {
      loading.current = false;
      setLoadingMore(false);
    }
  };

  // No dependency array on purpose: the observer is rebuilt after each render,
  // so it reads the latest hasMore; loadNext itself reads the page from a ref.
  useEffect(() => {
    const marker = endOfList.current;
    if (!marker || !hasMore || loadMoreFailed) return;

    // Start loading a little before the visitor actually reaches the bottom.
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadNext(), {
      rootMargin: "600px",
    });
    observer.observe(marker);
    return () => observer.disconnect();
  });

  const count = total ?? listings?.length ?? 0;

  return (
    <div className="min-h-dvh">
      <main className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-10">
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight lg:text-[56px]">
          Homes, plots and rooms
          <br className="hidden sm:block" /> across Kerala
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          {listings === null ? "Loading listings…" : `${count} ${count === 1 ? "property" : "properties"} listed`}
        </p>

        {failed ? (
          <div className="mt-10 rounded-2xl bg-panel p-10 text-center ring-1 ring-line">
            <h2 className="text-[18px] font-semibold">Listings could not be loaded</h2>
            <p className="mt-2 text-[15px] text-muted">Check your connection and try again.</p>
            <button type="button" onClick={() => window.location.reload()} className={`mt-5 ${secondaryButton}`}>
              Try again
            </button>
          </div>
        ) : listings === null ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index} className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
                <div className="aspect-[4/3] animate-pulse bg-line/60" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-20 animate-pulse rounded bg-line" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
                </div>
              </li>
            ))}
          </ul>
        ) : listings.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
            <h2 className="font-display text-[30px] leading-tight">No properties listed yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">Be the first to list one.</p>
            <Link href="/list/create" className={`mt-6 inline-block ${primaryButton}`}>
              List a property
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing, index) => (
                // The slug identifies a public listing; old listings without one fall back to their position.
                <li key={listing.slug ?? `listing-${index}`}>
                  <PublicListingCard listing={listing} />
                </li>
              ))}
            </ul>

            <div ref={endOfList} className="mt-10 flex flex-col items-center gap-3 text-[14px] text-muted">
              {loadingMore && <p aria-live="polite">Loading more properties…</p>}
              {loadMoreFailed && (
                <>
                  <p>More properties could not be loaded.</p>
                  <button type="button" onClick={loadNext} className={secondaryButton}>
                    Try again
                  </button>
                </>
              )}
              {!hasMore && <p>You&apos;ve seen all {count} properties.</p>}
              {/* Keyboard and screen reader users can load more without scrolling. */}
              {hasMore && !loadingMore && !loadMoreFailed && (
                <button
                  type="button"
                  onClick={loadNext}
                  className="sr-only focus:not-sr-only focus:rounded-md focus:border focus:border-line focus:px-4 focus:py-2"
                >
                  Load more properties
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ListAll;
