"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROPERTY_TYPES } from "@/lib/listing";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

// What the user picked. "" means "any", and is not sent as a filter.
export type SearchValues = {
  listingType: string;
  propertyType: string;
  location: string;
};

type Props = {
  // Pre-fills the fields, e.g. on the results page with the search from the URL.
  initialValues?: Partial<SearchValues>;
  // "card": the big search section on the home page.
  // "toolbar": one slim row above search results, collapsed to a summary on phones.
  variant?: "card" | "toolbar";
};

const MODES = [
  { value: "SALE", label: "Buy" },
  { value: "RENT", label: "Rent" },
  { value: "PG", label: "PG" },
];

const MAX_LOCATION_LENGTH = 100;

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-5 w-5 shrink-0">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

// Home page search section: pick Buy / Rent / PG and a property type, then type a location.
const SearchBar = ({ initialValues, variant = "card" }: Props) => {
  const router = useRouter();
  const [listingType, setListingType] = useState(initialValues?.listingType ?? "");
  const [propertyType, setPropertyType] = useState(initialValues?.propertyType ?? "");
  const [location, setLocation] = useState(initialValues?.location ?? "");

  const [expanded, setExpanded] = useState(false); // toolbar on phones: form hidden until tapped

  // Location is required: without it there is no place to search around.
  const canSearch = location.trim() !== "";

  // Clicking the selected mode again clears it, so "any" is always reachable.
  const toggleMode = (value: string) => setListingType(listingType === value ? "" : value);

  // A <form>, so Enter in the location box submits without any key handling.
  // The search goes into the URL; the results page reads it from there and fetches.
  // So refresh, Back and shared links all keep the search.
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch) return;
    const params = new URLSearchParams();
    if (listingType) params.set("listingType", listingType);
    if (propertyType) params.set("propertyType", propertyType);
    if (location.trim()) params.set("location", location.trim());
    router.push(`/property/search?${params}`);
    setExpanded(false);
  };

  if (variant === "toolbar") {
    // "Kakkanad · Rent · Apartment". Choices left as "any" are simply not mentioned.
    const summary = [
      location.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) || "Search a location",
      MODES.find((mode) => mode.value === listingType)?.label,
      PROPERTY_TYPES.find((type) => type.value === propertyType)?.label,
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
          <span className="text-muted"><SearchIcon /></span>
          <span className="min-w-0 flex-1 truncate font-medium">{summary}</span>
          <span className="text-[13px] font-medium text-accent">{expanded ? "Close" : "Edit"}</span>
        </button>

        <form
          id="search-toolbar"
          role="search"
          aria-label="Change search"
          onSubmit={handleSubmit}
          className={`${expanded ? "mt-2 grid" : "hidden"} gap-2 rounded-lg bg-panel p-3 ring-1 ring-line md:mt-0 md:flex md:items-center md:bg-transparent md:p-0 md:ring-0`}
        >
          <div className="relative md:min-w-0 md:flex-1">
            <label htmlFor="toolbar-location" className="sr-only">Location</label>
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
              placeholder="Locality, city or area"
              required
              autoComplete="off"
              enterKeyHint="search"
              className="h-10 w-full rounded-lg border border-line bg-panel pl-10 pr-3 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 md:text-[15px] [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          {/* Buy / Rent / PG as one joined control; clicking the selected one clears it. */}
          <div role="group" aria-label="Looking to" className="flex h-10 shrink-0 rounded-lg bg-panel p-1 ring-1 ring-line">
            {MODES.map((mode) => {
              const selected = listingType === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => toggleMode(mode.value)}
                  aria-pressed={selected}
                  className={`flex-1 rounded-md px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent md:flex-none ${
                    selected ? "bg-accent text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <label htmlFor="toolbar-type" className="sr-only">Property type</label>
          <select
            id="toolbar-type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
            className="h-10 shrink-0 rounded-lg border border-line bg-panel px-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 md:w-44"
          >
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!canSearch}
            title={canSearch ? undefined : "Enter a location to search"}
            className={`h-10 shrink-0 !py-0 ${primaryButton}`}
          >
            Search
          </button>
        </form>
      </div>
    );
  }

  return (
    <section aria-labelledby="search-heading" className="w-full rounded-2xl bg-panel p-5 shadow-sm ring-1 ring-line sm:p-6">
      <h2 id="search-heading" className="text-[18px] font-semibold tracking-tight">
        Search what you want
      </h2>
      <p className="mt-1 text-[14px] text-muted">Pick what you&apos;re looking for, then tell us where.</p>

      <form
        role="search"
        onSubmit={handleSubmit}
        className="mt-5 grid gap-4 md:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)_auto] md:items-end"
      >
        {/* ---------- mode ---------- */}
        <fieldset>
          <legend className={labelClass}>Looking to</legend>
          <div className="flex gap-1.5">
            {MODES.map((mode) => {
              const selected = listingType === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => toggleMode(mode.value)}
                  aria-pressed={selected}
                  className={`h-11 rounded-md px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selected ? "bg-accent text-white" : "bg-ground text-muted hover:text-ink"
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
          >
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------- location: the only field you type in ---------- */}
        <div>
          <label htmlFor="search-location" className={labelClass}>
            Location <span className="text-danger" aria-hidden="true">*</span>
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
              placeholder="e.g. Kakkanad, Kannur"
              required
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full rounded-md border border-line bg-panel pl-10 pr-10 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {location && (
              <button
                type="button"
                onClick={() => setLocation("")}
                aria-label="Clear location"
                className="absolute inset-y-0 right-1.5 my-auto flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
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
      </form>
    </section>
  );
};

export default SearchBar;
