"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RADIUS_OPTIONS,
  SEARCH_PROPERTY_TYPES,
  searchLabelOf,
} from "@/lib/listing";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

// What the user picked. "" means "any", and is not sent as a filter.
export type SearchValues = {
  listingType: string;
  propertyType: string;
  location: string;
  // How far around the location to look. "" means the API's default of 10 km.
  radius: string;
};

type Props = {
  // Pre-fills the fields, e.g. on the results page with the search from the URL.
  initialValues?: Partial<SearchValues>;
  // "card": the big search section on the home page.
  // "toolbar": one slim row above search results, collapsed to a summary on phones.
  // "compact": location only, for the centre of the hero circle. The mode and
  // type choices live in the filter bar there, so asking for them twice on one
  // screen would be the form competing with itself.
  variant?: "card" | "toolbar" | "compact";
};

// Two, not three. PG listings come back under Rent — the API folds them in —
// so offering PG separately would be a third choice that filters out the very
// rentals most people mean.
const MODES = [
  { value: "SALE", label: "Buy" },
  { value: "RENT", label: "Rent" },
];

const MAX_LOCATION_LENGTH = 100;

// Every control in the hero card wears one of these on a phone and none of
// them from md, where the row is self-evident. Exported because the mode
// buttons and the type select live in HeroStage — they write the URL rather
// than this form — and have to caption themselves identically.
export const FIELD_LABEL =
  "mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted md:sr-only";

const PinIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-5 w-5 shrink-0"
  >
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
    className="h-5 w-5 shrink-0"
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

// Home page search section: pick Buy / Rent / PG and a property type, then type a location.
const SearchBar = ({ initialValues, variant = "card" }: Props) => {
  const router = useRouter();
  const [listingType, setListingType] = useState(
    initialValues?.listingType ?? "",
  );
  const [propertyType, setPropertyType] = useState(
    initialValues?.propertyType ?? "",
  );
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [radius, setRadius] = useState(initialValues?.radius ?? "");

  const [expanded, setExpanded] = useState(false); // toolbar on phones: form hidden until tapped

  // Location is required: without it there is no place to search around.
  const canSearch = location.trim() !== "";

  // Clicking the selected mode again clears it, so "any" is always reachable.
  const toggleMode = (value: string) =>
    setListingType(listingType === value ? "" : value);

  // A <form>, so Enter in the location box submits without any key handling.
  // The search goes into the URL; the results page reads it from there and fetches.
  // So refresh, Back and shared links all keep the search.
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch) return;
    // compact renders none of the mode, the type or the distance: the hero
    // owns those controls and keeps them in the URL. So for that variant the props are the
    // truth and the local state is a stale copy — it was seeded once at mount
    // and the hero's links change the URL without ever remounting this form,
    // which is how Rent was being dropped on the way to the results page.
    const mode =
      variant === "compact" ? (initialValues?.listingType ?? "") : listingType;
    const kind =
      variant === "compact"
        ? (initialValues?.propertyType ?? "")
        : propertyType;
    const km = variant === "compact" ? (initialValues?.radius ?? "") : radius;

    const params = new URLSearchParams();
    if (mode) params.set("listingType", mode);
    if (kind) params.set("propertyType", kind);
    if (location.trim()) params.set("location", location.trim());
    // Carried even where there is no control for it, so editing the search on the
    // results page keeps the distance the visitor chose there.
    if (km) params.set("radius", km);
    router.push(`/property/search?${params}`);
    setExpanded(false);
  };

  if (variant === "compact") {
    return (
      <form
        role="search"
        onSubmit={handleSubmit}
        // No surface of its own below md. On a phone this sits inside the
        // hero's card, which already has a panel, a ring and padding — so the
        // form was a second box inside it and the field a third, and three
        // nested boxes is most of why the card felt oversized. From md it
        // becomes the pill that floats on the drawing, where it IS the
        // surface and earns the shadow.
        className="md:flex md:flex-nowrap md:items-center md:gap-1 md:rounded-xl md:bg-panel md:p-1.5 md:shadow-[0_10px_30px_-10px_rgba(48,32,68,0.35)]"
        suppressHydrationWarning
      >
        <div className="min-w-0 md:flex-1">
          <label htmlFor="hero-location" className={FIELD_LABEL}>
            Where
          </label>
          <div className="flex items-center rounded-lg bg-ground ring-1 ring-line md:bg-transparent md:ring-0">
            <span className="pointer-events-none pl-2.5 text-muted">
              <PinIcon />
            </span>
            <input
              id="hero-location"
              name="search-location"
              type="search"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={MAX_LOCATION_LENGTH}
              placeholder="Enter your preferred location"
              required
              autoComplete="off"
              enterKeyHint="search"
              // 16px, because anything smaller makes iOS zoom the page in on focus.
              className="min-w-0 flex-1 basis-0 bg-transparent px-2 py-2.5 text-[16px] text-ink placeholder:text-muted/60 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              suppressHydrationWarning
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSearch}
          title={canSearch ? undefined : "Enter a location to search"}
          aria-label="Search this location"
          // Its own line on a phone, carrying the word, and the only solid
          // accent in the card: a lone icon is the least obvious thing on a
          // screen where it is the only action.
          className={`mt-1.5 h-11 w-full ${primaryButton} md:mt-0 md:w-11 md:flex-none md:!px-0`}
        >
          <SearchIcon />
          <span className="ml-1.5 md:hidden">Search</span>
        </button>
      </form>
    );
  }

  if (variant === "toolbar") {
    // "Kakkanad · Rent · Apartment". Choices left as "any" are simply not mentioned.
    const summary = [
      location.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) ||
        "Search a location",
      MODES.find((mode) => mode.value === listingType)?.label,
      searchLabelOf(propertyType),
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <div className="w-full">
        {/* Phones: one tappable line; the full form would push results off the first screen. */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="search-toolbar"
          className="flex h-11 w-full items-center gap-2.5 rounded-lg bg-panel px-3.5 text-left text-[15px] ring-1 ring-line md:hidden"
        >
          <span className="text-muted">
            <SearchIcon />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{summary}</span>
          <span className="text-[13px] font-medium text-accent">
            {expanded ? "Close" : "Edit"}
          </span>
        </button>

        <form
          id="search-toolbar"
          role="search"
          aria-label="Change search"
          onSubmit={handleSubmit}
          className={`${expanded ? "mt-2 grid" : "hidden"} gap-2 rounded-lg bg-panel p-3 ring-1 ring-line md:mt-0 md:flex md:items-center md:bg-transparent md:p-0 md:ring-0`}
        >
          <div className="relative md:min-w-0 md:flex-1">
            <label htmlFor="toolbar-location" className="sr-only">
              Location
            </label>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              <PinIcon />
            </span>
            <input
              id="toolbar-location"
              name="search-location"
              type="search"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={MAX_LOCATION_LENGTH}
              placeholder="Enter your preferred location"
              required
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full rounded-lg border border-line bg-panel pl-10 pr-12 md:h-10 md:pr-3 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 md:text-[15px] [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          {/* Buy / Rent / PG as one joined control; clicking the selected one clears it. */}
          <div
            role="group"
            aria-label="Looking to"
            className="flex h-11 shrink-0 rounded-lg bg-panel p-1 ring-1 ring-line md:h-10"
          >
            {MODES.map((mode) => {
              const selected = listingType === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => toggleMode(mode.value)}
                  aria-pressed={selected}
                  className={`flex-1 rounded-lg px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent md:flex-none ${
                    selected
                      ? "bg-accent text-white"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <label htmlFor="toolbar-type" className="sr-only">
            Property type
          </label>
          <select
            id="toolbar-type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
            className="h-11 shrink-0 rounded-lg border border-line bg-panel px-3 text-[16px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 md:h-10 md:w-44 md:text-[15px]"
          >
            <option value="">Any type</option>
            {SEARCH_PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!canSearch}
            title={canSearch ? undefined : "Enter a location to search"}
            className={`h-11 shrink-0 !py-0 md:h-10 ${primaryButton}`}
          >
            Search
          </button>
        </form>
      </div>
    );
  }

  return (
    // Laid on the sheet: a rule for an edge and a flat white, no drop shadow.
    // Depth on this page comes from the one implied light source in the drawings,
    // and a glowing card would contradict it.
    <section
      aria-labelledby="search-heading"
      className="w-full rounded-xl bg-panel p-5 ring-1 ring-line sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="search-heading" className="font-display text-[17px]">
          Find a property
        </h2>
        {/* The sheet's own stamp: says what the form needs without a sentence of
            instructions underneath it. */}
        <p className="annot hidden sm:block">Location required</p>
      </div>

      {/* suppressHydrationWarning on the form controls: extensions tag inputs with
          their own attributes before React hydrates. See app/layout.tsx. */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className="mt-5 space-y-4"
        suppressHydrationWarning
      >
        {/* What you are looking for. Three controls side by side needs 768px;
            below that they stack, which is also the 320px layout. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,13rem)_minmax(0,10rem)] md:items-end">
          {/* ---------- mode ---------- */}
          <fieldset>
            <legend className={labelClass}>Looking to</legend>
            {/* Butted into one control, like a scale bar: three positions of the
                same question, not three separate buttons. */}
            <div className="flex gap-px overflow-hidden rounded-lg ring-1 ring-line">
              {MODES.map((mode) => {
                const selected = listingType === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => toggleMode(mode.value)}
                    aria-pressed={selected}
                    className={`h-11 flex-1 text-[15px] font-medium transition-colors first:rounded-l-md last:rounded-r-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? "bg-accent text-white"
                        : "bg-ground text-muted hover:bg-accent-soft hover:text-ink"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ---------- property type ---------- */}
          <div>
            <label htmlFor="search-type" className={labelClass}>
              Property type
            </label>
            <select
              id="search-type"
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              className={`h-11 ${inputClass}`}
              suppressHydrationWarning
            >
              <option value="">Any type</option>
              {SEARCH_PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* ---------- how far out ---------- */}
          <div>
            <label htmlFor="search-radius" className={labelClass}>
              Distance
            </label>
            <select
              id="search-radius"
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              className={`h-11 ${inputClass}`}
              suppressHydrationWarning
            >
              {/* The empty value is 10 km: the API's own default, so a search
                  made without touching this is the search it always was. */}
              <option value="">Within 10 km</option>
              {RADIUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Within {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------- where, and go ---------- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor="search-location" className={labelClass}>
              Location{" "}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <PinIcon />
              </span>
              <input
                id="search-location"
                name="search-location"
                type="search"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={MAX_LOCATION_LENGTH}
                placeholder="Enter your preferred location"
                required
                autoComplete="off"
                enterKeyHint="search"
                className="h-11 w-full rounded-lg border border-line bg-panel pl-10 pr-12 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
                suppressHydrationWarning
              />
              {location && (
                <button
                  type="button"
                  onClick={() => setLocation("")}
                  aria-label="Clear location"
                  className="absolute inset-y-0 right-1 my-auto flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink md:right-1.5 md:h-8 md:w-8"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Disabled until a location is typed; the title explains why on hover. */}
          <button
            type="submit"
            disabled={!canSearch}
            title={canSearch ? undefined : "Enter a location to search"}
            className={`h-11 ${primaryButton}`}
          >
            Search
          </button>
        </div>
      </form>
    </section>
  );
};

export default SearchBar;
