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
import ListingFilters from "@/components/public/ListingFilters";
import MapLegend from "@/components/public/MapLegend";
import ResultsMap from "@/components/public/ResultsMap";
import SearchBar from "@/components/public/SearchBar";
import { api } from "@/lib/api";
import { RADIUS_OPTIONS, type Option } from "@/lib/listing";
import type { PublicListingSummary } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";

type Result = {
  key: string;
  listings: PublicListingSummary[];
  // Where the API geocoded the search to, [longitude, latitude]. Null when the
  // place could not be found at all, which is a different kind of nothing.
  center: [number, number] | null;
  failed: boolean;
};

/* ---------- words and choices ---------- */

const PLURAL: Record<string, string> = {
  APARTMENT: "apartments",
  INDEPENDENT_HOUSE: "independent houses",
  VILLA: "villas",
  PLOT: "plots",
  // The merged choice sends COMMERCIAL and the API answers with both kinds, so
  // the sentence has to admit both or it misnames what is on screen.
  COMMERCIAL: "commercial spaces and offices",
  OFFICE: "offices",
  ROOM: "rooms",
};

const SINGULAR: Record<string, string> = {
  APARTMENT: "apartment",
  INDEPENDENT_HOUSE: "independent house",
  VILLA: "villa",
  PLOT: "plot",
  COMMERCIAL: "commercial space or office",
  OFFICE: "office",
  ROOM: "room",
};

const MODE_PHRASE: Record<string, string> = {
  SALE: "for sale",
  RENT: "for rent",
  PG: "for PG or hostel",
};

// The API returns nearest first, so that is this page's default order. The home
// page's is newest first, which is why the bar takes its sorts as a prop.
const SEARCH_SORTS: Option[] = [
  { value: "", label: "Nearest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

// "kakkanad" → "Kakkanad"
const titleCase = (text: string) =>
  text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

/* ---------- icons ---------- */

const MapIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
  >
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

const ListIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
  >
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
  // How far out to look. Empty means the API's default of 10 km.
  const radius = searchParams.get("radius") ?? "";
  // Set by "Find nearby properties" as me=lat,lon: the phone's own fix, which
  // the map marks with the device-location dot. An older link carrying a bare
  // me=1 simply has no point to mark, and the search behaves as a typed one.
  const fix = searchParams.get("me");
  const device = useMemo(() => {
    const parts = (fix ?? "").split(",").map(Number);
    // Validated because it arrives in a URL anyone can type. A longitude of
    // 900 would send the camera into the void.
    return parts.length === 2 &&
      parts.every((part) => Number.isFinite(part)) &&
      Math.abs(parts[0]) <= 90 &&
      Math.abs(parts[1]) <= 180
      ? ([parts[1], parts[0]] as [number, number]) // MapLibre wants lon first
      : null;
  }, [fix]);
  // Refinements, applied in the browser.
  const sort = searchParams.get("sort") ?? "";
  const postedBy = searchParams.get("postedBy") ?? "";
  const maxPrice = Number(searchParams.get("maxPrice")) || 0;
  const minBeds = Number(searchParams.get("beds")) || 0;

  // Only these four go to the server. The rest are applied below, in the browser:
  // the map needs every pin, so this endpoint returns the whole result set rather
  // than a page, and once it is all in memory a round trip would only add a spinner.
  //
  // Radius cannot be one of those: widening it asks for listings the server never
  // sent, so it belongs here and a change refetches.
  const serverQuery = new URLSearchParams(
    Object.entries({ location, listingType, propertyType, radius }).filter(
      ([, value]) => value,
    ),
  ).toString();

  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  // Phones and tablets. "Find nearby properties" sends view=map, because the
  // answer to "what is around me" is a map, not a list of names.
  const [view, setView] = useState<"list" | "map">(
    searchParams.get("view") === "map" ? "map" : "list",
  );
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
        if (!ignore) {
          // { lat, lon } from the API, in Nominatim's own order; MapLibre wants
          // longitude first, so it is flipped once, here.
          const place = response.data.center;
          setResult({
            key: fetchKey,
            listings: response.data.lists ?? [],
            center: place ? [Number(place.lon), Number(place.lat)] : null,
            failed: false,
          });
        }
      })
      .catch(() => {
        if (!ignore)
          setResult({
            key: fetchKey,
            listings: [],
            center: null,
            failed: true,
          });
      });
    return () => {
      ignore = true;
    };
  }, [serverQuery, fetchKey]);

  const loading = result?.key !== fetchKey;
  const failed = !loading && result.failed;
  const all = useMemo(
    () => (loading || !result ? [] : result.listings),
    [loading, result],
  );
  // What the ring is drawn around: the point the API geocoded the place name
  // to, because that is the point it measured every distanceKm from. The
  // device's own fix is NOT it — see the `me` prop below.
  //
  // Kept WHILE the next search is in flight rather than nulled by `loading`.
  // That null is what made the dot and the ring disappear the moment the
  // distance changed from 10 km to 50: the area being searched had not moved,
  // only how far out it reached, so taking it off the map for the length of a
  // request was wrong twice over — and if the geocode then failed, it never
  // came back. The device fix is the last resort, for the first paint of a
  // nearby search and for a geocode that fails outright.
  const center = result?.center ?? device;
  // Empty means the API's own default, which is 10 km.
  const radiusKm = Number(radius) || 10;

  // 3. Sort and filter. Memoised, so hovering a card doesn't rebuild the map's pins.
  const shown = useMemo(() => {
    const kept = all.filter(
      (listing) =>
        (!postedBy || listing.postedBy === postedBy) &&
        (!maxPrice || Number(listing.price) <= maxPrice) &&
        (!minBeds ||
          (typeof listing.bedrooms === "number" &&
            listing.bedrooms >= minBeds)),
    );
    if (sort === "price-asc")
      return [...kept].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc")
      return [...kept].sort((a, b) => Number(b.price) - Number(a.price));
    return kept; // the API already returns nearest first
  }, [all, sort, postedBy, maxPrice, minBeds]);

  // Only for the "nothing matches" state. Everyday clearing is the bar's own job:
  // each choice has a chip with an x, and the sheet has Clear all. Replaces the
  // URL rather than pushing, so Back leaves the page instead of walking through
  // every control the visitor touched.
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    for (const name of ["postedBy", "maxPrice", "beds"]) next.delete(name);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // The filter bar owns the distance, but that bar lives in the results column
  // — which is a whole screen away when the map is full screen on a phone. So
  // the map carries its own copy of the one control that cannot be judged
  // without looking at the area it measures.
  const applyRadius = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("radius", value);
    else next.delete("radius");
    next.delete("page");
    next.set("view", "map"); // a refresh or a shared link stays on the map
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // Clicking a pin brings its card into view.
  const selectFromMap = (slug: string) => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    cardRefs.current.get(slug)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  };

  const place = titleCase(location) || "your search";
  // "near Kakkanad" at the default, "within 30 km of Kakkanad" once chosen: the
  // count only makes sense next to the area it was counted over.
  const area = radius ? `within ${radius} km of ${place}` : `near ${place}`;
  // "3 apartments for sale", "1 property"
  const describe = (count: number) => {
    const noun =
      count === 1
        ? (SINGULAR[propertyType] ?? "property")
        : (PLURAL[propertyType] ?? "properties");
    return [noun, MODE_PHRASE[listingType]].filter(Boolean).join(" ");
  };
  const filtered = Boolean(postedBy || maxPrice || minBeds);

  const heading = loading
    ? `Searching ${area}…`
    : failed
      ? `Results ${area}`
      : filtered
        ? `${shown.length} of ${all.length} ${describe(all.length)} ${area}`
        : `${all.length} ${describe(all.length)} ${area}`;

  // Links that loosen an empty search.
  const broaden = (drop: string) => {
    const next = new URLSearchParams(serverQuery);
    next.delete(drop);
    // serverQuery holds only what the API is asked for; this is where the
    // search came from, and loosening it does not move the visitor.
    if (fix) next.set("me", fix);
    return `${pathname}?${next}`;
  };
  // The next distance up, or nothing at 50 km. Offered when a search comes back
  // empty: the commonest reason is a small town with nothing inside 10 km.
  const wider = RADIUS_OPTIONS.find(
    (option) => Number(option.value) > (Number(radius) || 10),
  );
  const widen = (value: string) => {
    const next = new URLSearchParams(serverQuery);
    next.set("radius", value);
    if (fix) next.set("me", fix);
    // Widening from the map's own message keeps the visitor on the map.
    if (view === "map") next.set("view", "map");
    return `${pathname}?${next}`;
  };

  return (
    <div className="flex flex-col">
      {/* ---------- search toolbar: stays at the top while the list scrolls ---------- */}
      {/* Static on a phone: stacked, this toolbar is ~215px tall, so pinning it
          would hold 38% of a 568px screen above the results for the whole
          scroll. It follows the reader only once it fits on one line. */}
      <div className="relative z-20 border-b border-line bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80 lg:sticky lg:top-0">
        <div className="px-4 py-3 lg:px-6">
          {/* Keyed on the place alone. The mode, the type and the distance are
              read from the URL by the bar itself, so they need no remount to
              stay in step — and keying on them would throw away a half-typed
              place every time one was changed. */}
          {/* radius has no control here — the filter bar below owns it — but it is
              passed so editing the search keeps the distance already chosen. */}
          <SearchBar
            key={location}
            variant="toolbar"
            initialValues={{ location, listingType, propertyType, radius }}
          />
        </div>
      </div>

      <div
        className={`lg:grid ${mapHidden ? "" : "lg:grid-cols-[minmax(0,1fr)_40%]"}`}
      >
        {/* ---------- results ---------- */}
        <section
          aria-labelledby="results-heading"
          aria-busy={loading}
          className="@container min-w-0 px-5 pb-24 pt-5 lg:px-6 lg:pb-10"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="annot">Good finds, close to you</p>
              <h1
                id="results-heading"
                aria-live="polite"
                className="mt-2 font-display text-[22px] leading-tight lg:text-[26px]"
              >
                {heading}
              </h1>
            </div>

            {!failed && (
              <button
                type="button"
                onClick={() => setMapHidden(!mapHidden)}
                aria-pressed={!mapHidden}
                className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-medium text-muted transition-colors hover:bg-panel hover:text-ink lg:flex"
              >
                <MapIcon />
                {mapHidden ? "Show map" : "Hide map"}
              </button>
            )}
          </div>

          {/* The same bar as the home page. Its choices land in the URL, and this
              page decides what to do with each: listingType and propertyType are
              in serverQuery, so changing one refetches; postedBy, the budget and
              bedrooms are not, so they filter the set already loaded. The search
              toolbar above already asks what and where, hence showTypes={false}. */}
          {!failed && (
            <div className="mt-4">
              <ListingFilters
                showTypes={false}
                showRadius
                sorts={SEARCH_SORTS}
              />
            </div>
          )}

          {/* ---------- the list, and every state it can be in ---------- */}
          <div className="mt-5">
            {failed ? (
              <div className="rounded-xl bg-panel px-6 py-12 text-center ring-1 ring-line">
                <h2 className="font-display text-[17px]">
                  We couldn&apos;t load the results
                </h2>
                <p className="mt-1.5 text-[14px] text-muted">
                  Check your connection, then try again.
                </p>
                <button
                  type="button"
                  onClick={() => setRetry(retry + 1)}
                  className={`mt-5 ${secondaryButton}`}
                >
                  Try again
                </button>
              </div>
            ) : loading ? (
              <ul
                className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-3"
                aria-hidden="true"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <li
                    key={index}
                    className="overflow-hidden rounded-xl bg-panel ring-1 ring-line"
                  >
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
                <h2 className="font-display text-[17px]">
                  Nothing listed {area} yet
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-[14px] text-muted">
                  Check the spelling, try a nearby town, or widen the search.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {wider && (
                    <button
                      type="button"
                      onClick={() => router.push(widen(wider.value))}
                      className={primaryButton}
                    >
                      Look within {wider.label}
                    </button>
                  )}
                  {propertyType && (
                    <button
                      type="button"
                      onClick={() => router.push(broaden("propertyType"))}
                      className={secondaryButton}
                    >
                      Any property type
                    </button>
                  )}
                  {listingType && (
                    <button
                      type="button"
                      onClick={() => router.push(broaden("listingType"))}
                      className={secondaryButton}
                    >
                      Buy, rent and PG
                    </button>
                  )}
                </div>
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-xl bg-panel px-6 py-12 text-center ring-1 ring-line">
                <h2 className="font-display text-[17px]">
                  None of the {all.length} results match your filters
                </h2>
                <p className="mt-1.5 text-[14px] text-muted">
                  Try a higher budget, fewer bedrooms, or any seller.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`mt-5 ${primaryButton}`}
                >
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
                      onHoverChange={(hovered) =>
                        setActiveSlug(hovered ? listing.slug : null)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ---------- map: right column on desktop, full screen on phones when chosen ---------- */}
        {/* Two bugs lived in this one class list. `relative` and `fixed` were
            both on it, and Tailwind emits .relative AFTER .fixed, so at equal
            specificity relative won and the "full screen" map was never fixed
            at all. With no position and no height below lg — ResultsMap's own
            root is h-full — it resolved to nothing, which is why the map did
            not appear on a phone. The phone classes are scoped with max-lg now
            so they cannot collide with the desktop ones. */}
        <div
          className={`bg-ground ${
            view === "map"
              ? "max-lg:fixed max-lg:inset-0 max-lg:z-30"
              : "max-lg:hidden"
          } lg:sticky lg:top-[65px] lg:z-0 lg:h-[calc(100dvh-65px)] lg:border-l lg:border-line ${
            mapHidden ? "lg:hidden" : "lg:block"
          }`}
        >
          <ResultsMap
            listings={shown}
            frame={all}
            center={center}
            radiusKm={radiusKm}
            centerLabel={titleCase(location)}
            me={device}
            activeSlug={activeSlug}
            onActiveChange={setActiveSlug}
            onSelect={selectFromMap}
          />
          {/* On a phone the map is the whole screen, so every word the results
              column was going to say is a screen away behind the List button.
              Without this, a nearby search with nothing in range looked like a
              page that had failed to load: an empty map, no pins, no message.
              lg:hidden throughout, because the column beside the map already
              carries all of it on a wide screen. */}
          {view === "map" && !failed && (
            <div className="absolute inset-x-3 top-3 z-10 space-y-2 lg:hidden">
              {/* How far out the ring reaches. 16px text: anything smaller and
                  iOS zooms the page in when the select takes focus. */}
              <div className="flex items-center justify-between gap-2 rounded-xl bg-panel/95 px-3 py-2 ring-1 ring-line backdrop-blur">
                <label
                  htmlFor="map-radius"
                  className="text-[13px] font-medium text-muted"
                >
                  {`Around ${place}`}
                </label>
                <select
                  id="map-radius"
                  value={radius}
                  onChange={(event) => applyRadius(event.target.value)}
                  className="h-9 rounded-lg border border-line bg-panel px-2 text-[16px] font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">Within 10 km</option>
                  {RADIUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      Within {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <p className="mx-auto w-fit rounded-full bg-panel/95 px-3.5 py-2 text-[13px] font-medium text-muted ring-1 ring-line backdrop-blur">
                  Searching {area}…
                </p>
              ) : shown.length === 0 ? (
                <div className="rounded-xl bg-panel/95 px-4 py-3.5 ring-1 ring-line backdrop-blur">
                  <p className="font-display text-[15px]">
                    {all.length === 0
                      ? `Nothing listed ${area} yet`
                      : `None of the ${all.length} results match your filters`}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    {all.length === 0
                      ? "The dotted circle is the area that was searched."
                      : "Loosen a filter to see the properties around you."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {all.length === 0 ? (
                      <>
                        {wider && (
                          <button
                            type="button"
                            onClick={() => applyRadius(wider.value)}
                            className={`h-10 !py-0 ${primaryButton}`}
                          >
                            Look within {wider.label}
                          </button>
                        )}
                        {/* The search itself is edited in the toolbar, which is
                            on the list screen. */}
                        <button
                          type="button"
                          onClick={() => setView("list")}
                          className={`h-10 !py-0 ${secondaryButton}`}
                        >
                          Change search
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className={`h-10 !py-0 ${primaryButton}`}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* What the pin colours mean, over the map's own corner. pointer-events
              none so it never swallows a drag that starts on top of it. */}
          {shown.length > 1 && (
            <div className="pointer-events-none absolute bottom-20 left-3 right-3 z-10 rounded-xl bg-panel/95 px-3 py-2.5 ring-1 ring-line backdrop-blur-sm lg:bottom-3 lg:right-auto lg:max-w-xs">
              <MapLegend types={shown.map((listing) => listing.propertyType)} />
            </div>
          )}
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
