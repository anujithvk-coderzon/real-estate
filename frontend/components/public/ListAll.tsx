"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PublicListingCard from "@/components/listing/PublicListingCard";
import HeroStage from "@/components/public/HeroStage";
import ListingFilters from "@/components/public/ListingFilters";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import type { PublicListingSummary } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type PageResponse = { lists: PublicListingSummary[]; total?: number };

// The filters the API narrows by. Anything else in the URL is not its business.
const FILTER_PARAMS = [
  "listingType",
  "propertyType",
  "postedBy",
  "maxPrice",
  "beds",
];

// Sort travels to the API too, but it is not a filter: it cannot empty the list,
// so it must not turn the "nothing matches these filters" message on.
const QUERY_PARAMS = [...FILTER_PARAMS, "sort"];

// take: ask for exactly what will be rendered. Without it the home page pulled
// the API's full page of 20 and threw 12 away on every visit.
const fetchPage = async (page: number, query: string, take?: number) => {
  const response = await api.get(`/list/all?${query}`, {
    params: { page, ...(take ? { take } : {}) },
  });
  return response.data as PageResponse;
};

/* ---------- the grid ---------- */

type GridProps = {
  // Everything the API needs, already a query string.
  query: string;
  // Changes the wording when nothing comes back: no listings at all is a different
  // problem from filters that match none of them.
  filtered: boolean;
  // Optional: the page no longer shows a count of its own, but the grid still
  // reports one for anything that wants it later.
  onCount?: (count: number) => void;
};

// Mounted with `key={query}`, so a filter change gives it fresh state and fresh
// refs. That is why it resets nothing by hand: there is nothing stale to reset.
const Listings = ({ query, filtered, onCount }: GridProps) => {
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
    loadedCount.current =
      pageNumber === 1
        ? data.lists.length
        : loadedCount.current + data.lists.length;

    setListings((prev) => {
      if (pageNumber === 1 || !prev) return data.lists;
      // A listing published while the visitor scrolls shifts every page by one,
      // so the next page can repeat the last card. Skip anything already shown.
      const shown = new Set(prev.map((listing) => listing.slug));
      return [
        ...prev,
        ...data.lists.filter((listing) => !shown.has(listing.slug)),
      ];
    });
    if (typeof data.total === "number") setTotal(data.total);
    onCount?.(data.total ?? loadedCount.current);
    // With a total we know exactly; without one, an empty page means the end.
    setHasMore(
      typeof data.total === "number"
        ? loadedCount.current < data.total
        : data.lists.length > 0,
    );
  };

  useEffect(() => {
    fetchPage(1, query)
      .then((data) => applyPage(1, data))
      .catch((error) => {
        setFailed(true);
        errorToast(apiMessage(error));
      });
    // Runs once per mount, and a new query is a new mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNext = async () => {
    if (loading.current || lastPage.current === 0) return;
    loading.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const next = lastPage.current + 1;
      // Only the uncapped grid ever loads a second page, so no take here.
      applyPage(next, await fetchPage(next, query));
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
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadNext(),
      {
        rootMargin: "600px",
      },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  });

  const count = total ?? listings?.length ?? 0;

  if (failed) {
    return (
      <div className="rounded-2xl bg-panel p-10 text-center ring-1 ring-line">
        <h2 className="font-display text-[18px]">
          Listings could not be loaded
        </h2>
        <p className="mt-2 text-[15px] text-muted">
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`mt-5 ${secondaryButton}`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (listings === null) {
    return (
      <ul
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-busy="true"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <li
            key={index}
            className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line"
          >
            <div className="aspect-[4/3] animate-pulse bg-line/60" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-20 animate-pulse rounded bg-line" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  // Two different nothings: a site with no listings at all, and filters that match
  // none of the ones there are. Only the first wants a nudge to go and list something.
  if (listings.length === 0) {
    return filtered ? (
      <div className="rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
        <h2 className="font-display text-[30px] leading-tight">
          No properties match these filters
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">
          Try removing one of them, or raising the budget.
        </p>
      </div>
    ) : (
      <div className="rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
        <h2 className="font-display text-[30px] leading-tight">
          No properties listed yet
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">
          Be the first to list one.
        </p>
        <Link
          href="/list/create"
          className={`mt-6 inline-block ${primaryButton}`}
        >
          List a property
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing, index) => (
          // The slug identifies a public listing; old listings without one fall back to their position.
          <li key={listing.slug ?? `listing-${index}`}>
            <PublicListingCard listing={listing} />
          </li>
        ))}
      </ul>

      <div
        ref={endOfList}
        className="mt-10 flex flex-col items-center gap-3 text-[14px] text-muted"
      >
        {loadingMore && <p aria-live="polite">Loading more properties…</p>}
        {loadMoreFailed && (
          <>
            <p>More properties could not be loaded.</p>
            <button
              type="button"
              onClick={loadNext}
              className={secondaryButton}
            >
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
            className="sr-only focus:not-sr-only focus:rounded-lg focus:border focus:border-line focus:px-4 focus:py-2"
          >
            Load more properties
          </button>
        )}
      </div>
    </>
  );
};

/* ---------- the page ---------- */

// Public home page: everyone's published listings, narrowed by the filter bar.
// The next page loads on its own as the visitor scrolls near the bottom.
const ListAll = () => {
  const searchParams = useSearchParams();

  // Only what the API cares about, in a fixed order, so the same choices always
  // produce the same string and an unrelated param in the URL cannot refetch.
  const query = QUERY_PARAMS.map(
    (name) => [name, searchParams.get(name) ?? ""] as const,
  )
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");

  const filtered = FILTER_PARAMS.some((name) => searchParams.get(name));

  return (
    <main className="min-h-dvh">
      {/* The stage: the drawing in its circle, the search at the centre, and
          the seven types gathering out of orbit into their row as you scroll. */}
      <HeroStage />

      <div className="mx-auto w-full max-w-7xl px-5 pb-8 pt-7 sm:pt-8 lg:px-10">
        {/* Narrows the grid below. Separate from the search bar on purpose: that
            one leaves this page, these stay on it. */}
        {/* showTypes={false}: the hero above already asks Buy/Rent/PG and the
            property type, so this bar would be the second copy of both on one
            screen. It keeps what the hero does not ask — budget, bedrooms,
            seller and order. */}
        <ListingFilters showTypes={false} />

        {/* Every listing, loaded as the visitor scrolls. No cap and no heading:
            the filter bar directly above already says what is being shown, and
            a title would only repeat it. */}
        <div className="mt-8 sm:mt-10">
          {/* key: new filters are a new list, so the grid starts over rather
              than appending page 1 of the new search to page 3 of the old. */}
          <Listings key={query} query={query} filtered={filtered} />
        </div>
      </div>
    </main>
  );
};

export default ListAll;
