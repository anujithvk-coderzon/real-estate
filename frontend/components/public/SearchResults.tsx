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
import ListingFilters, {
  REFINE_PARAMS,
} from "@/components/public/ListingFilters";
import MapLegend from "@/components/public/MapLegend";
import ResultsMap from "@/components/public/ResultsMap";
import SearchBar from "@/components/public/SearchBar";
import { api } from "@/lib/api";
import { fixErrorKm, gradeFix } from "@/lib/fix";
import { RADIUS_OPTIONS, categoryOf, type Option } from "@/lib/listing";
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

// The same mark the filter bar's own button carries, drawn to the same
// metrics. Two ways into one sheet should not look like two different controls.
const TuneIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
  >
    <path d="M3 7h12M19 7h2M3 17h4M11 17h10" />
    <circle cx="17" cy="7" r="2.1" />
    <circle cx="9" cy="17" r="2.1" />
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
  // How wrong `me` might be, in metres, set by "Find nearby properties" only
  // when the fix was too coarse to state as fact. Absent on a typed search and
  // on a precise one, which is what makes `approximate` below false by default
  // for every link that existed before this.
  const accuracy = Number(searchParams.get("acc")) || 0;
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
    Object.entries({
      location,
      listingType,
      propertyType,
      radius,
      // The device's own fix, when "Find nearby properties" supplied it, sent
      // so the API measures from HERE instead of geocoding `location` back to
      // the centroid of whatever area got named. The gap between those two
      // points is the bug this fixes: a property 25 km away reading as 2.4 km,
      // and the ring drawn around a suburb — or, when the fix resolved no
      // closer than a district, around a point fifty kilometres off.
      //
      // `location` still travels, but with a point the API ignores it and uses
      // it for nothing: it is this page's label and the map dot's name. And
      // SearchBar deletes `me` the moment the typed place changes, so these
      // coordinates are only ever here when the search IS the visitor's own
      // position.
      ...(device ? { lat: String(device[1]), lon: String(device[0]) } : {}),
    }).filter(([, value]) => value),
  ).toString();

  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  // Phones and tablets. "Find nearby properties" sends view=map, because the
  // answer to "what is around me" is a map, not a list of names.
  // The map is what this site has that a list of names does not — a radius you
  // can see, your own position inside it, pins you can compare at a glance —
  // so on a phone it is what you land on. ?view=list is still honoured, for a
  // link someone shared deliberately.
  //
  // Unconditional rather than behind a media query, on purpose: from lg the
  // grid shows the list and the map side by side, and every class this value
  // touches is a max-lg: one, so it changes nothing there. A media query would
  // buy nothing and cost a hydration mismatch, since the server cannot know
  // the width of the screen it is rendering for.
  const [view, setView] = useState<"list" | "map">(
    searchParams.get("view") === "list" ? "list" : "map",
  );
  const [mapHidden, setMapHidden] = useState(false); // desktop
  // The filter sheet's open state, held here rather than inside ListingFilters,
  // because on a phone in map view there are two ways into it and only one of
  // them is reachable: the bar's own button is under the full-screen map, and
  // the button in the map's chrome is not.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // What the sheet is holding, for the badge on the button that opens it. Only
  // its own three: the mode, the type and the distance are in the toolbar on
  // this page, so counting them would badge the button for choices standing
  // visible right beside it.
  const refineCount = REFINE_PARAMS.filter((name) =>
    searchParams.get(name),
  ).length;
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
  // What the ring is drawn around: the point the API measured every distanceKm
  // from, whatever that was. On a nearby search that is now the device's own
  // fix, sent above, so the ring and the "You are here" dot land on the same
  // spot. On a typed search it is still the geocoded place, and the two are
  // different points for the reason the `me` prop documents.
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
  // Graded here rather than trusted from the URL, because the radius is not
  // fixed: someone who arrives with a coarse fix and then widens to 50 km has
  // turned an approximate search into a fair one without touching `acc`, and
  // the same fix at 10 km is worse than it was at 20. One function in
  // lib/fix.ts decides, so the button that refuses and the page that captions
  // cannot drift apart.
  //
  // Requires a device fix: an `acc` typed into the URL with no `me` beside it
  // describes the width of nothing.
  const approximate =
    Boolean(device) && accuracy > 0 && gradeFix(accuracy, radiusKm) !== "good";

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
    // Nor does it improve the fix. Dropping `acc` here would quietly promote a
    // rough search to an exact-looking one just because a filter came off.
    if (accuracy) next.set("acc", String(accuracy));
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
    // Carried, not dropped — and widening is exactly how a coarse fix stops
    // being a problem, so the caption can disappear on arrival while the
    // number that justified it travels with the link.
    if (accuracy) next.set("acc", String(accuracy));
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
      {/* In map view on a phone the map is fixed over the whole screen at
          z-30, which used to bury this bar underneath it: the only way back to
          the search was the List button. So here it floats above the map
          instead, and the map's own chrome moves into this same stack — a
          flow, not an overlay, so a two-line search bar can never sit on top
          of the distance pill. */}
      <div
        // relative is in the else branch, not the base: with both on one
        // element Tailwind emits .relative after .fixed, so at equal
        // specificity relative wins and max-lg:fixed does nothing at all.
        // That is the exact bug the map column's own comment records, two
        // elements down, and it had been reintroduced here.
        className={`z-20 border-b border-line bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80 lg:sticky lg:top-0 lg:z-20 lg:border-b lg:bg-panel/95 ${
          view === "map" && !failed
            ? // Over the map the band itself goes: every control in it already
              // carries its own white panel and ring, so the only thing the
              // background was painting was the gaps between them — about
              // 150px of map, opaque, for no information. Transparent, the
              // same controls read as chrome floating on the map and the map
              // runs to the top of the screen.
              "max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-40 max-lg:border-b-0 max-lg:bg-transparent max-lg:backdrop-blur-none max-lg:supports-[backdrop-filter]:bg-transparent"
            : "relative"
        }`}
      >
        <div className="px-4 py-2 lg:px-6 lg:py-3">
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
            // The way to the budget, the seller and the bedrooms while the map
            // is full screen. Map view only: in list view the filter bar is
            // right there in the column below, and two buttons opening one
            // sheet on one screen is how they drift apart.
            extra={
              view === "map" && !failed ? (
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={filtersOpen}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[15px] font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <TuneIcon />
                  {/* The word from md, where the row holds nothing else and
                      has the width to spare. On a phone it is the icon and
                      the count, because the word costs the type select beside
                      it the space it needs to read "Any type". */}
                  <span className="hidden md:inline">More filters</span>
                  <span className="sr-only md:hidden">More filters</span>
                  {refineCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[12px] font-semibold tabular-nums text-white">
                      {refineCount}
                    </span>
                  )}
                </button>
              ) : null
            }
          />
        </div>
        {/* On a phone the map is the whole screen, so every word the results
            column was going to say is a screen away behind the List button.
            Without this, a nearby search with nothing in range looked like a
            page that had failed to load: an empty map, no pins, no message.
            lg:hidden throughout, because the column beside the map already
            carries all of it on a wide screen. */}
        {view === "map" && !failed && (
          <div className="space-y-1.5 px-3 pb-2 lg:hidden">
            {/* How far out the ring reaches. 16px text: anything smaller and
                iOS zooms the page in when the select takes focus. */}
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
              {/* The caveat that outlives the toast. A toast is gone in six
                  seconds and never comes back on a reload or a shared link,
                  and the thing it was warning about — every distance on this
                  page — is still here. This is the same sentence, attached to
                  the results it is about.

                  Under the heading rather than over it: the heading answers
                  "what did I get", and this qualifies that answer. warn, not
                  danger, because nothing failed. The search ran and most of
                  what came back is genuinely nearby; it is the precision that
                  is overstated, not the result. */}
              {approximate && (
                <p className="mt-3 rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-[12.5px] leading-snug text-warn">
                  Measured from an approximate location — your device placed you
                  to within about {fixErrorKm(accuracy)} km, so the distances
                  shown are rough. Search by area name for exact ones.
                </p>
              )}
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
              {/* No showRadius: the distance moved up into the search bar,
                  beside the mode and the type. It belongs with them — those
                  three decide what the SERVER returns, while everything in
                  here only hides some of what already arrived. Leaving a copy
                  down here as well would be two controls for one question,
                  which is how they drift apart. The chip and the "3 filters"
                  badge drop it too, because this prop gates those as well. */}
              <ListingFilters
                showTypes={false}
                sorts={SEARCH_SORTS}
                // Held above, because the map's chrome opens the same sheet.
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
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
                      approximate={approximate}
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
            view === "map" && !failed
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
            // Kilometres here, metres in the URL: the URL carries what the
            // browser gave, and every consumer converts for itself rather than
            // guessing which unit it was handed. 0 when the fix was good
            // enough, which is what stops the circle being drawn at all.
            accuracyKm={approximate ? accuracy / 1000 : 0}
            activeSlug={activeSlug}
            onActiveChange={setActiveSlug}
            onSelect={selectFromMap}
          />
          {/* What the pin colours mean, over the map's own corner. It renders
              its own box, because only it knows whether there is anything to
              put in one — see the note in MapLegend. */}
          <MapLegend types={shown.map(categoryOf)} />
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
