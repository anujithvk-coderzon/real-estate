"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BudgetSlider from "@/components/public/BudgetSlider";
import NearbyButton from "@/components/public/NearbyButton";
import { rememberHomeSearch } from "@/lib/homeSearch";
import {
  NO_BEDROOMS,
  RADIUS_OPTIONS,
  SEARCH_MODES,
  modeSelectValue,
  searchTypeOptions,
  typeChoice,
  typeSelectValue,
  SEARCH_PROPERTY_TYPES,
  propertyTypeOptions,
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
// Emptying the field in one tap. The native one that comes with
// type="search" is hidden by a rule on every field below — it is a different
// shape and weight in every browser, and it sits inside our own ring looking
// like a stray glyph. This is the same mark drawn to our own metrics.
//
// A button, not an icon: it is 44px square where a finger lands, it says what
// it does to a screen reader, and it hands focus back to the field so the next
// thing typed goes where the person is looking.
const ClearLocation = ({
  value,
  onClear,
  inputId,
  className = "",
}: {
  value: string;
  onClear: () => void;
  inputId: string;
  className?: string;
}) => {
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onClear();
        document.getElementById(inputId)?.focus();
      }}
      aria-label="Clear location"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {/* A multiplication sign, not a lowercase x: it is symmetrical, and it
          is what every other close control on the site uses. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    </button>
  );
};

// Buy / Rent, and the property type. Two copies of each are rendered in the
// toolbar — one in the row that only exists from md, one in the phone's own row
// — so they live out here rather than being written twice. Each copy needs its
// own id: two <select>s sharing one would leave the second label pointing at
// the first control.
const ModeGroup = ({
  value,
  onToggle,
  className = "",
}: {
  value: string;
  onToggle: (value: string) => void;
  className?: string;
}) => (
  <div
    role="group"
    aria-label="Looking to"
    className={`flex h-11 rounded-lg bg-panel p-1 ring-1 ring-line md:h-10 ${className}`}
  >
    {SEARCH_MODES.map((mode) => {
      const selected = value === mode.value;
      return (
        <button
          key={mode.value}
          type="button"
          onClick={() => onToggle(mode.value)}
          aria-pressed={selected}
          className={`flex-1 rounded-lg px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent md:flex-none ${
            selected ? "bg-accent text-white" : "text-muted hover:text-ink"
          }`}
        >
          {mode.label}
        </button>
      );
    })}
  </div>
);

// How far around the place to look. This belongs to the search, not to the
// refinements: it changes which listings the SERVER returns, while a budget or
// a bedroom count only hides some of what already arrived. It used to sit in
// the filter bar beside those, which is why it reads better here, in the row
// that asks the other two questions about the search itself.
//
// Two copies render, one per breakpoint, so they need distinct ids: a second
// <label htmlFor> pointing at the first copy's id would move focus to a
// control on the other side of the screen.
const RadiusSelect = ({
  id,
  value,
  onPick,
  long = false,
  className = "",
}: {
  id: string;
  value: string;
  onPick: (value: string) => void;
  // "Within 20 km" where there is room; bare "20 km" on a phone, where the
  // caption would be the same word repeated down the list.
  long?: boolean;
  className?: string;
}) => (
  <>
    <label htmlFor={id} className="sr-only">
      Distance
    </label>
    <select
      id={id}
      value={value}
      onChange={(event) => onPick(event.target.value)}
      // 16px: anything smaller and iOS zooms the whole page in when the select
      // takes focus, and the map underneath is then the wrong size.
      className={`h-11 rounded-lg border border-line bg-panel px-2 text-[16px] font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${className}`}
    >
      <option value="">{long ? "Within 10 km" : "10 km"}</option>
      {RADIUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {long ? `Within ${option.label}` : option.label}
        </option>
      ))}
    </select>
  </>
);

const TypeSelect = ({
  id,
  value,
  mode,
  onPick,
  className = "",
}: {
  id: string;
  value: string;
  // The options are narrowed by it: the combinations that cannot exist would
  // otherwise read as a result set with nothing in it — there are no plots to
  // rent.
  mode: string;
  onPick: (value: string) => void;
  className?: string;
}) => (
  <>
    <label htmlFor={id} className="sr-only">
      Property type
    </label>
    <select
      id={id}
      value={value}
      onChange={(event) => onPick(event.target.value)}
      className={`h-11 rounded-lg border border-line bg-panel px-3 text-[16px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 md:h-10 md:text-[15px] ${className}`}
    >
      <option value="">Any type</option>
      {searchTypeOptions(mode, value).map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  </>
);

const SearchBar = ({ initialValues, variant = "card" }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The toolbar is the one variant that sits ON the results page, where the URL
  // is already the single source of truth and the page refetches the moment it
  // changes. So there the mode, the type and the distance are not kept in state
  // at all: each control reads the URL and writes straight back to it, which is
  // what makes a change apply on the spot instead of waiting for Search. The
  // other two variants stand on the home page, where there are no results yet
  // to change, so they collect a whole search locally and submit it in one go.
  //
  // The location is deliberately NOT live, in any variant: the API geocodes it,
  // so applying it per keystroke would fire a search for "ko", "koc", "koch"
  // and leave the map wherever the last answer landed. It waits for Enter or
  // the Search button, which is also what the filter bar below does with the
  // budget slider — the difference there is only that it debounces instead.
  const live = variant === "toolbar";

  const [modeDraft, setModeDraft] = useState(initialValues?.listingType ?? "");
  const [typeDraft, setTypeDraft] = useState(initialValues?.propertyType ?? "");
  const [radiusDraft, setRadiusDraft] = useState(initialValues?.radius ?? "");
  const [location, setLocation] = useState(initialValues?.location ?? "");

  // What the controls show, and what a submit carries.
  const listingType = live
    ? (searchParams.get("listingType") ?? "")
    : modeDraft;
  const propertyType = live
    ? (searchParams.get("propertyType") ?? "")
    : typeDraft;
  const radius = live ? (searchParams.get("radius") ?? "") : radiusDraft;
  // Only the toolbar offers this: the hero has no results to narrow yet.
  const maxPrice = live ? (searchParams.get("maxPrice") ?? "") : "";

  // Location is required: without it there is no place to search around.
  const canSearch = location.trim() !== "";

  // One choice into the URL, keeping every other one already in it — the budget,
  // the bedrooms, the seller, the order, the map view. replace rather than push,
  // so Back leaves the results page instead of walking the visitor back through
  // every control they touched. The same rule, for the same reason, as
  // ListingFilters.apply.
  const applyNow = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    // Any page past the first is meaningless once the set of matches changes.
    next.delete("page");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // Clicking the selected mode again clears it, so "any" is always reachable.
  const toggleMode = (value: string) => {
    const shown = modeSelectValue(listingType);
    // Pressing the lit button clears it — except when PG is what lit it, where
    // the useful move is to widen PG to every rental, not to drop the mode.
    const mode = shown === value && listingType !== "PG" ? "" : value;
    if (!live) {
      setModeDraft(mode);
      return;
    }
    // A plot cannot be rented, and a ceiling picked for a monthly rent means
    // nothing against sale prices. Both leave with the mode rather than quietly
    // emptying the results — the same correction ListingFilters makes.
    const keepsType = propertyTypeOptions(mode, SEARCH_PROPERTY_TYPES).some(
      (option) => option.value === propertyType,
    );
    applyNow({
      listingType: mode,
      ...(keepsType ? {} : { propertyType: "" }),
      maxPrice: "",
    });
  };

  const pickType = (value: string) => {
    // One control, two parameters: PG is a tenure in the data, so choosing it
    // writes listingType, not propertyType. See typeChoice.
    const changes = typeChoice(value, listingType);
    if (!live) {
      setTypeDraft(changes.propertyType);
      if (changes.listingType !== undefined) setModeDraft(changes.listingType);
      return;
    }
    // A plot or a commercial space has no bedrooms, so a bedroom filter left
    // over from apartments would match nothing at all — and a PG is let by the
    // bed, so the same applies.
    applyNow({
      ...changes,
      ...(NO_BEDROOMS.includes(value) || value === "PG" ? { beds: "" } : {}),
    });
  };

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

    // On the results page the refinements already made — budget, bedrooms,
    // seller, order, list or map — survive a change of place: someone who said
    // "under 50 L" has not stopped meaning it by moving from Kochi to Aluva.
    // Coming from the home page there is nothing yet to keep.
    const params = new URLSearchParams(live ? searchParams.toString() : "");
    params.delete("page");
    // Radius is carried even where there is no control for it, so editing the
    // search on the results page keeps the distance chosen there.
    for (const [name, value] of Object.entries({
      listingType: mode,
      propertyType: kind,
      location: location.trim(),
      radius: km,
    })) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    // A typed place is not the visitor's position, so the device dot and its
    // "You are here" go with the search they belonged to.
    if (location.trim() !== (initialValues?.location ?? ""))
      params.delete("me");
    // What the home row was set to, so pressing Back from the results finds
    // it as it was. The URL used to carry this; it cannot any more, because
    // these are form fields rather than links.
    if (variant === "compact")
      rememberHomeSearch({
        location: location.trim(),
        listingType: mode,
        propertyType: kind,
        radius: km,
      });
    router.push(`/property/search?${params}`);
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
            <ClearLocation
              value={location}
              onClear={() => setLocation("")}
              inputId="hero-location"
              className="md:h-9 md:w-9"
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
    return (
      <div className="w-full">
        {/* The field itself, at every width. It used to be a summary line that
            had to be tapped to reveal this form — two taps and a layout shift
            to reach the one control the bar exists for, and on the map the
            summary repeated a place name shown directly above it. Collapsing
            was worth it when this form was a card of four controls; the mode
            and the type moved to their own row below, so what is left is a
            field and a button, which is smaller than the summary that hid
            them. */}
        <form
          id="search-toolbar"
          role="search"
          aria-label="Change search"
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
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
              // pr-12 on every size now: md used to drop to pr-3, which was
              // right when nothing sat on the right of the field and would put
              // the clear button on top of the text.
              className="h-11 w-full rounded-lg border border-line bg-panel pl-10 pr-12 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 md:h-10 md:text-[15px] [&::-webkit-search-cancel-button]:hidden"
            />
            <ClearLocation
              value={location}
              onClear={() => setLocation("")}
              inputId="toolbar-location"
              className="absolute inset-y-0 right-1 my-auto md:right-1.5 md:h-8 md:w-8"
            />
          </div>

          {/* From md the whole search is one row, so these two sit in it. On a
              phone they are in the row below instead — they apply themselves,
              so they are not part of submitting this form, and inside it they
              would be unreachable until it was opened. */}
          <ModeGroup
            value={modeSelectValue(listingType)}
            onToggle={toggleMode}
            className="hidden shrink-0 md:flex"
          />
          <TypeSelect
            id="toolbar-type"
            value={typeSelectValue(listingType, propertyType)}
            mode={listingType}
            onPick={pickType}
            className="hidden shrink-0 md:block md:w-44"
          />
          <RadiusSelect
            id="toolbar-radius"
            value={radius}
            onPick={(value) => applyNow({ radius: value })}
            long
            className="hidden shrink-0 md:block md:h-10 md:w-36 md:text-[15px]"
          />

          {/* The home page offers this and the results page did not, which is
              backwards: someone already looking at a map of Kochi is exactly
              who wants "and what about where I am standing". It carries the
              search already on screen, so a budget or a bedroom count set here
              survives the jump. */}
          <NearbyButton
            compact
            keep={searchParams.toString()}
            listingType={listingType}
            propertyType={propertyType}
            radius={radius}
          />

          {/* The mode and the type apply themselves, so this button is only
              ever about the place — hence "Search here" rather than "Search",
              which looked like the one thing that applied everything and left
              the other two looking inert. */}
          <button
            type="submit"
            disabled={!canSearch}
            title={canSearch ? undefined : "Enter a location to search"}
            className={`h-11 shrink-0 !py-0 md:h-10 ${primaryButton}`}
          >
            {/* "Search here" needs ~110px it cannot have beside the field on a
                360px screen. The short word is the same promise. */}
            <span className="md:hidden">Search</span>
            <span className="hidden md:inline">Search here</span>
          </button>
        </form>

        {/* Phones: always on screen, never behind Edit. Each one changes the
            results the moment it is touched. */}
        {/* Phones: always on screen, never behind an Edit. Each one changes
            the results the moment it is touched. min-w-0 on the selects,
            because a flex item defaults to min-width:auto and one sized by its
            longest option would push the row past the screen rather than
            share it. */}
        <div className="mt-1.5 flex gap-2 md:hidden">
          <ModeGroup
            value={modeSelectValue(listingType)}
            onToggle={toggleMode}
            className="shrink-0"
          />
          <TypeSelect
            id="toolbar-type-narrow"
            value={typeSelectValue(listingType, propertyType)}
            mode={listingType}
            onPick={pickType}
            className="min-w-0 flex-1"
          />
        </div>

        {/* The distance and the budget share a line. A slider needs width, but
            not a band of its own: dense it is the height of the select beside
            it, so this is one row rather than two.

            The same track the filter bar shows on a laptop, not a select of
            preset ceilings — one control, one vocabulary, both screens. Below
            lg only; from there the filter bar beside the results carries it.
            Keyed on the committed amount, so clearing the chip or pressing
            Clear all puts the thumb back where it belongs. */}
        <div className="mt-1.5 flex items-center gap-2 lg:hidden">
          <RadiusSelect
            id="toolbar-radius-narrow"
            value={radius}
            onPick={(value) => applyNow({ radius: value })}
            className="shrink-0 md:hidden"
          />
          <BudgetSlider
            id="toolbar-budget"
            key={maxPrice}
            amount={maxPrice}
            onCommit={(next) => applyNow({ maxPrice: next })}
            dense
            className="min-w-0 flex-1 rounded-lg bg-panel px-2.5 py-1 ring-1 ring-line"
          />
        </div>
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
              {SEARCH_MODES.map((mode) => {
                // PG lights Rent: it is a kind of rental, chosen in the type
                // list below rather than here.
                const selected = modeSelectValue(listingType) === mode.value;
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
            {/* This one listed SEARCH_PROPERTY_TYPES straight, so it was the
                only type control in the app that ignored the mode — offering
                Plot under Rent — and the one that PG never reached. It goes
                through the same two helpers as the others now. */}
            <select
              id="search-type"
              value={typeSelectValue(listingType, propertyType)}
              onChange={(event) => pickType(event.target.value)}
              className={`h-11 ${inputClass}`}
              suppressHydrationWarning
            >
              <option value="">Any type</option>
              {searchTypeOptions(
                listingType,
                typeSelectValue(listingType, propertyType),
              ).map((type) => (
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
              onChange={(event) => setRadiusDraft(event.target.value)}
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
              <ClearLocation
                value={location}
                onClear={() => setLocation("")}
                inputId="search-location"
                className="absolute inset-y-0 right-1 my-auto md:h-8 md:w-8 md:right-1.5"
              />
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
