"use client";

// The search results page: /property/search?location=kakkanad&listingType=SALE&propertyType=APARTMENT
//
//   1. Read the search from the URL.
//   2. Call the API with it (the only API call on this page).
//   3. Sort and filter those results in the browser (instant, no new request).
//   4. Show the list and the map, kept in sync.
//
// Everything the user chooses lives in the URL, so refresh, Back and shared links keep it.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PublicListingCard from "@/components/listing/PublicListingCard";
import ResultsMap from "@/components/public/ResultsMap";
import SearchBar from "@/components/public/SearchBar";
import { api } from "@/lib/api";
import { formatRupeesShort } from "@/lib/format";
import type { PublicListingSummary } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";

type Result = { key: string; listings: PublicListingSummary[]; failed: boolean };

/* ---------- words and choices ---------- */

const PLURAL: Record<string, string> = {
  APARTMENT: "apartments",
  INDEPENDENT_HOUSE: "independent houses",
  VILLA: "villas",
  PLOT: "plots",
  COMMERCIAL: "commercial spaces",
  OFFICE: "offices",
  ROOM: "rooms",
};

const SINGULAR: Record<string, string> = {
  APARTMENT: "apartment",
  INDEPENDENT_HOUSE: "independent house",
  VILLA: "villa",
  PLOT: "plot",
  COMMERCIAL: "commercial space",
  OFFICE: "office",
  ROOM: "room",
};

const MODE_PHRASE: Record<string, string> = { SALE: "for sale", RENT: "for rent", PG: "for PG / hostel" };

// Budgets only make sense within one kind of price: a sale price and a monthly rent can't share a scale.
const BUDGETS: Record<string, number[]> = {
  SALE: [25_00_000, 50_00_000, 75_00_000, 1_00_00_000, 2_00_00_000, 5_00_00_000],
  RENT: [10_000, 20_000, 30_000, 50_000, 1_00_000],
  PG: [5_000, 8_000, 12_000, 20_000],
};

// Bedrooms mean nothing for these.
const NO_BEDROOMS = ["PLOT", "COMMERCIAL", "OFFICE"];

const SORTS = [
  { value: "", label: "Nearest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

// "kakkanad" → "Kakkanad"
const titleCase = (text: string) => text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const controlClass =
  "h-9 rounded-lg border border-line bg-panel px-2.5 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

/* ---------- icons ---------- */

const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px]">
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-[18px] w-[18px]">
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

/* ---------- the page ---------- */

const SearchResults = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. The search, from the URL.
  const location = searchParams.get("location") ?? "";
  const listingType = searchParams.get("listingType") ?? "";
  const propertyType = searchParams.get("propertyType") ?? "";
  // Refinements, applied in the browser.
  const sort = searchParams.get("sort") ?? "";
  const maxPrice = Number(searchParams.get("maxPrice")) || 0;
  const minBeds = Number(searchParams.get("beds")) || 0;

  // Only these three go to the server; changing sort or filters must not refetch.
  const serverQuery = new URLSearchParams(
    Object.entries({ location, listingType, propertyType }).filter(([, value]) => value),
  ).toString();

  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"list" | "map">("list"); // phones and tablets
  const [mapHidden, setMapHidden] = useState(false); // desktop
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  // 2. Call the API whenever the server part of the search changes (or on Try again).
  const fetchKey = `${serverQuery}#${retry}`;
  useEffect(() => {
    let ignore = false; // if another search starts first, this answer is thrown away
    api
      .get(`/list/search?${serverQuery}`)
      .then((response) => {
        if (!ignore) setResult({ key: fetchKey, listings: response.data.lists ?? [], failed: false });
      })
      .catch(() => {
        if (!ignore) setResult({ key: fetchKey, listings: [], failed: true });
      });
    return () => {
      ignore = true;
    };
  }, [serverQuery, fetchKey]);

  const loading = result?.key !== fetchKey;
  const failed = !loading && result.failed;
  const all = useMemo(() => (loading || !result ? [] : result.listings), [loading, result]);

  // 3. Sort and filter. Memoised, so hovering a card doesn't rebuild the map's pins.
  const shown = useMemo(() => {
    const kept = all.filter(
      (listing) =>
        (!maxPrice || Number(listing.price) <= maxPrice) &&
        (!minBeds || (typeof listing.bedrooms === "number" && listing.bedrooms >= minBeds)),
    );
    if (sort === "price-asc") return [...kept].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") return [...kept].sort((a, b) => Number(b.price) - Number(a.price));
    return kept; // the API already returns nearest first
  }, [all, sort, maxPrice, minBeds]);

  // Refinements replace the URL (no new history entry per click); a new search pushes.
  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("maxPrice");
    next.delete("beds");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // Clicking a pin brings its card into view.
  const selectFromMap = (slug: string) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRefs.current.get(slug)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  };

  const place = titleCase(location) || "your search";
  // "3 apartments for sale", "1 property"
  const describe = (count: number) => {
    const noun = count === 1 ? (SINGULAR[propertyType] ?? "property") : (PLURAL[propertyType] ?? "properties");
    return [noun, MODE_PHRASE[listingType]].filter(Boolean).join(" ");
  };
  const budgets = BUDGETS[listingType];
  const showBedrooms = !NO_BEDROOMS.includes(propertyType);
  const filtered = Boolean(maxPrice || minBeds);

  const heading = loading
    ? `Searching near ${place}…`
    : failed
      ? `Results near ${place}`
      : filtered
        ? `${shown.length} of ${all.length} ${describe(all.length)} near ${place}`
        : `${all.length} ${describe(all.length)} near ${place}`;

  // Links that loosen an empty search.
  const broaden = (drop: string) => {
    const next = new URLSearchParams(serverQuery);
    next.delete(drop);
    return `${pathname}?${next}`;
  };

  return (
    <div className="flex flex-col">
      {/* ---------- search toolbar: stays at the top while the list scrolls ---------- */}
      <div className="sticky top-0 z-20 border-b border-line bg-ground/95 backdrop-blur supports-[backdrop-filter]:bg-ground/80">
        <div className="px-4 py-3 lg:px-6">
          {/* key: a new search (or Back) rebuilds the bar, so its fields match the URL. */}
          <SearchBar key={serverQuery} variant="toolbar" initialValues={{ location, listingType, propertyType }} />
        </div>
      </div>

      <div className={`lg:grid ${mapHidden ? "" : "lg:grid-cols-[minmax(0,1fr)_40%]"}`}>
        {/* ---------- results ---------- */}
        <section aria-labelledby="results-heading" aria-busy={loading} className="@container min-w-0 px-4 pb-24 pt-5 lg:px-6 lg:pb-10">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <h1 id="results-heading" aria-live="polite" className="text-[20px] font-semibold tracking-tight lg:text-[22px]">
              {heading}
            </h1>

            {/* Refine: sort and the two filters people use most. */}
            {!failed && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="sort">Sort</label>
                <select id="sort" value={sort} onChange={(event) => setParam("sort", event.target.value)} className={controlClass}>
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                {budgets && (
                  <>
                    <label className="sr-only" htmlFor="budget">Maximum price</label>
                    <select id="budget" value={maxPrice || ""} onChange={(event) => setParam("maxPrice", event.target.value)} className={controlClass}>
                      <option value="">Any price</option>
                      {budgets.map((amount) => (
                        <option key={amount} value={amount}>Up to {formatRupeesShort(amount)}</option>
                      ))}
                    </select>
                  </>
                )}

                {showBedrooms && (
                  <>
                    <label className="sr-only" htmlFor="beds">Bedrooms</label>
                    <select id="beds" value={minBeds || ""} onChange={(event) => setParam("beds", event.target.value)} className={controlClass}>
                      <option value="">Any bedrooms</option>
                      {[1, 2, 3, 4].map((count) => (
                        <option key={count} value={count}>{count}+ bedrooms</option>
                      ))}
                    </select>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setMapHidden(!mapHidden)}
                  aria-pressed={!mapHidden}
                  className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-medium text-muted transition-colors hover:bg-panel hover:text-ink lg:flex"
                >
                  <MapIcon />
                  {mapHidden ? "Show map" : "Hide map"}
                </button>
              </div>
            )}
          </div>

          {filtered && !loading && !failed && shown.length > 0 && (
            <button type="button" onClick={clearFilters} className="mt-2 text-[13px] font-medium text-accent hover:underline">
              Clear filters
            </button>
          )}

          {/* ---------- the list, and every state it can be in ---------- */}
          <div className="mt-5">
            {failed ? (
              <div className="rounded-xl bg-panel px-6 py-12 text-center ring-1 ring-line">
                <h2 className="text-[17px] font-semibold">We couldn&apos;t load the results</h2>
                <p className="mt-1.5 text-[14px] text-muted">Check your connection, then try again.</p>
                <button type="button" onClick={() => setRetry(retry + 1)} className={`mt-5 ${secondaryButton}`}>
                  Try again
                </button>
              </div>
            ) : loading ? (
              <ul className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-3" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <li key={index} className="overflow-hidden rounded-xl bg-panel ring-1 ring-line">
                    <div className="aspect-[16/10] animate-pulse bg-line/50" />
                    <div className="space-y-2.5 p-3.5">
                      <div className="h-5 w-24 animate-pulse rounded bg-line/70" />
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-line/70" />
                      <div className="h-3.5 w-1/2 animate-pulse rounded bg-line/70" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : all.length === 0 ? (
              <div className="rounded-xl bg-panel px-6 py-12 text-center ring-1 ring-line">
                <h2 className="text-[17px] font-semibold">Nothing listed near {place} yet</h2>
                <p className="mx-auto mt-1.5 max-w-md text-[14px] text-muted">
                  Check the spelling, try a nearby town, or widen the search.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {propertyType && (
                    <button type="button" onClick={() => router.push(broaden("propertyType"))} className={secondaryButton}>
                      Any property type
                    </button>
                  )}
                  {listingType && (
                    <button type="button" onClick={() => router.push(broaden("listingType"))} className={secondaryButton}>
                      Buy, rent and PG
                    </button>
                  )}
                </div>
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-xl bg-panel px-6 py-12 text-center ring-1 ring-line">
                <h2 className="text-[17px] font-semibold">None of the {all.length} results match your filters</h2>
                <p className="mt-1.5 text-[14px] text-muted">Try a higher budget or fewer bedrooms.</p>
                <button type="button" onClick={clearFilters} className={`mt-5 ${primaryButton}`}>
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-3">
                {shown.map((listing, index) => (
                  <li
                    key={listing.slug ?? `listing-${index}`}
                    ref={(element) => {
                      if (!listing.slug) return;
                      if (element) cardRefs.current.set(listing.slug, element);
                      else cardRefs.current.delete(listing.slug);
                    }}
                    className="scroll-mt-24"
                  >
                    <PublicListingCard
                      listing={listing}
                      showMode={!listingType}
                      highlighted={listing.slug === activeSlug}
                      onHoverChange={(hovered) => setActiveSlug(hovered ? listing.slug : null)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ---------- map: right column on desktop, full screen on phones when chosen ---------- */}
        <div
          className={`${view === "map" ? "fixed inset-0 z-30" : "hidden"} bg-ground lg:sticky lg:top-[65px] lg:z-0 lg:h-[calc(100dvh-65px)] lg:border-l lg:border-line ${
            mapHidden ? "lg:hidden" : "lg:block"
          }`}
        >
          <ResultsMap listings={shown} frame={all} activeSlug={activeSlug} onActiveChange={setActiveSlug} onSelect={selectFromMap} />
        </div>
      </div>

      {/* ---------- phones and tablets: switch between list and map ---------- */}
      {!failed && (
        <button
          type="button"
          onClick={() => setView(view === "map" ? "list" : "map")}
          className="fixed bottom-5 left-1/2 z-40 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-white shadow-lg transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
        >
          {view === "map" ? <ListIcon /> : <MapIcon />}
          {view === "map" ? "List" : "Map"}
        </button>
      )}
    </div>
  );
};

export default SearchResults;
