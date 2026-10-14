"use client";

// The filter bar, shared by the home page and the search results page.
//
// Every choice lives in the URL, so refresh, Back and a shared link all keep it.
// Nothing is filtered here. This bar only writes the URL; each page decides what
// a change means. The home page is paginated, so it sends every filter to the API
// and refetches. The search page gets its whole result set in one request (the map
// needs every pin), so it narrows that set in the browser instead. Filtering here
// would be wrong for both: on the home page it would see only the page already
// loaded, and on the search page it would leave the map's pins out of step.
//
// Two layouts. On a phone the listings are what the visitor came for, so the
// filters collapse to one button and open in a sheet; five stacked selects would
// push every property below the fold. From 1024px up there is room to show them.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatRupeesShort } from "@/lib/format";
import {
  BUDGET_MAX,
  BUDGET_STEPS,
  LISTING_TYPES,
  NO_BEDROOMS,
  POSTED_BY,
  RADIUS_OPTIONS,
  budgetAt,
  budgetPosition,
  labelOf,
  propertyTypeOptions,
  type Option,
} from "@/lib/listing";

// Every filter this bar owns. Clearing all of them means deleting exactly these,
// so a location or a page number typed in the URL survives. Sort is not one of
// them: it changes the order, never which listings match.
const FILTER_PARAMS = [
  "listingType",
  "propertyType",
  "postedBy",
  "maxPrice",
  "beds",
];

// The home page's default order is newest first, which the API already does.
const HOME_SORTS: Option[] = [
  { value: "", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const BEDROOM_OPTIONS: Option[] = [
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

// How long the slider waits after the last move before changing the URL. Without
// it, one drag across the scale would fire a hundred requests.
const COMMIT_DELAY = 250;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Inline on a wide screen. Every control in the bar is h-10 with the same
// radius and the same text size, so the row reads as one instrument rather than
// as four parts that happen to be adjacent.
const inlineSelect = `h-10 rounded-lg border border-line bg-panel px-3 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${focusRing}`;

// A trigger that states its own value, so the bar can be read without opening
// anything: "Under ₹72 L", not "Budget".
const inlineTrigger = `flex h-10 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[14px] font-medium text-ink transition-colors hover:border-accent ${focusRing}`;

// In the sheet, or in the phone's top row: full width and a 44px touch target.
const sheetSelect = `h-11 w-full rounded-lg border border-line bg-panel px-3 text-[16px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${focusRing}`;

/* ---------- small parts ---------- */

const FilterIcon = () => (
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

// A row of choices that are all visible at once. Used inside the sheet, where a
// native <select> would stack a picker wheel on top of it: two layers of chrome
// to answer a question with three answers.
const Pills = ({
  legend,
  options,
  value,
  anyLabel,
  onPick,
}: {
  legend: string;
  options: Option[];
  value: string;
  anyLabel: string;
  onPick: (value: string) => void;
}) => (
  <fieldset>
    <legend className="mb-2 block text-[13px] font-medium text-muted">
      {legend}
    </legend>
    <div className="flex flex-wrap gap-2">
      {[{ value: "", label: anyLabel }, ...options].map((option) => {
        const picked = value === option.value;
        return (
          <button
            key={option.value || "any"}
            type="button"
            aria-pressed={picked}
            onClick={() => onPick(option.value)}
            className={`h-11 rounded-lg px-3.5 text-[15px] transition-colors ${focusRing} ${
              picked
                ? "bg-accent font-medium text-white"
                : "bg-ground text-ink hover:bg-accent-soft"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);

/* ---------- the budget slider ---------- */

// Keyed on the committed amount by its parent, so a chip removal or Clear all
// remounts it at the right spot instead of needing an effect to resync.
const BudgetSlider = ({
  id,
  amount,
  onCommit,
  compact = false,
}: {
  // Both layouts stay in the DOM, so each copy needs its own id for its label.
  id: string;
  amount: string;
  onCommit: (next: string) => void;
  compact?: boolean;
}) => {
  // Both held locally while dragging, so the label keeps up with the thumb and
  // the URL is only told once the user stops moving it.
  const [position, setPosition] = useState(() =>
    budgetPosition(Number(amount)),
  );
  // Kept beside the position rather than recomputed from it: rounding to two
  // figures is lossy, so a URL saying ₹23,000 must keep saying ₹23,000.
  const [shown, setShown] = useState(() => Number(amount) || 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const move = (next: number) => {
    const nextAmount = budgetAt(next);
    setPosition(next);
    setShown(nextAmount);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => onCommit(nextAmount ? String(nextAmount) : ""),
      COMMIT_DELAY,
    );
  };

  const label = shown ? `Up to ${formatRupeesShort(shown)}` : "Any budget";

  return (
    <div className={compact ? "min-w-56 flex-1" : ""}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-muted">
          Budget
        </label>
        <span className="text-[15px] font-medium tabular-nums text-ink">
          {label}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={BUDGET_STEPS}
        step={1}
        value={position}
        onChange={(event) => move(Number(event.target.value))}
        // A screen reader would otherwise announce the bare position, "47".
        aria-valuetext={label}
        className={`mt-2 w-full accent-accent ${focusRing}`}
      />
      <div className="mt-0.5 flex justify-between text-[12px] text-muted">
        <span>Any</span>
        <span>{formatRupeesShort(BUDGET_MAX)}</span>
      </div>
    </div>
  );
};

// The budget, behind a trigger that states its own value. A native <details>
// gives the open/close state and keyboard support for free, but it only closes
// when its summary is clicked again — and anything floating over the page is
// expected to dismiss on a click away or on Escape. Those two are added here.
const BudgetPopover = ({
  amount,
  onCommit,
}: {
  amount: string;
  onCommit: (next: string) => void;
}) => {
  const host = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      const element = host.current;
      if (!element?.open) return;
      // A click inside is someone using the slider, not dismissing it.
      if (event.target instanceof Node && element.contains(event.target))
        return;
      element.open = false;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && host.current?.open) {
        host.current.open = false;
      }
    };

    // Capture, so the popover closes before a click lands on a card behind it.
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={host} className="group relative">
      <summary className={`${inlineTrigger} cursor-pointer list-none`}>
        {amount ? `Under ${formatRupeesShort(amount)}` : "Any budget"}
        <span
          aria-hidden="true"
          className="text-[10px] text-muted transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      {/* z-20: above the listing cards, which begin immediately below. */}
      <div className="absolute left-0 top-12 z-20 w-72 rounded-xl border border-line bg-panel p-4 shadow-[0_16px_40px_-20px_rgba(48,32,68,0.45)]">
        <BudgetSlider
          key={amount}
          id="filter-budget-wide"
          amount={amount}
          onCommit={onCommit}
        />
      </div>
    </details>
  );
};

/* ---------- the bar ---------- */

type Props = {
  // The search page's own toolbar already asks what and where, so it hides these.
  showTypes?: boolean;
  // How far to look, which only means something once there is a place to measure
  // from. The home page has none, so it leaves this off.
  showRadius?: boolean;
  // The default order differs per page: newest here, nearest on the search page.
  sorts?: Option[];
};

const ListingFilters = ({
  showTypes = true,
  showRadius = false,
  sorts = HOME_SORTS,
}: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sheet = useRef<HTMLDialogElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const listingType = searchParams.get("listingType") ?? "";
  const propertyType = searchParams.get("propertyType") ?? "";
  const radius = searchParams.get("radius") ?? "";
  const postedBy = searchParams.get("postedBy") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const beds = searchParams.get("beds") ?? "";
  const sort = searchParams.get("sort") ?? "";

  const showBedrooms = !NO_BEDROOMS.includes(propertyType);
  // Radius is not in FILTER_PARAMS: that list is shared with the home page, which
  // has no radius. It still counts here, so the phone's badge matches the sheet.
  const activeCount =
    FILTER_PARAMS.filter((name) => searchParams.get(name)).length +
    (showRadius && radius ? 1 : 0);

  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    if (sheetOpen && !element.open) {
      // showModal needs iOS 15.4. show() still sets [open], so the sheet appears
      // on an older phone; it just does not dim the page or trap focus.
      if (typeof element.showModal === "function") element.showModal();
      else element.show();
    }
    if (!sheetOpen && element.open) element.close();
  }, [sheetOpen]);

  // Refining replaces the URL instead of pushing, so Back leaves the page rather
  // than walking through every control the visitor touched.
  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    // A filter changes how many listings exist, so any page past the first is
    // meaningless: page 3 of a one-page result shows nothing at all.
    next.delete("page");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const setParam = (name: string, value: string) => {
    // Each listing type allows different property types, and only some types have
    // bedrooms. A stale value would quietly empty the list, so it goes with it.
    if (name === "listingType") {
      const allowed = propertyTypeOptions(value).some(
        (option) => option.value === propertyType,
      );
      apply({
        listingType: value,
        ...(allowed ? {} : { propertyType: "" }),
        // A ceiling chosen for monthly rents is nonsense for a sale price.
        maxPrice: "",
      });
      return;
    }
    if (name === "propertyType" && NO_BEDROOMS.includes(value)) {
      apply({ propertyType: value, beds: "" });
      return;
    }
    apply({ [name]: value });
  };

  const clearAll = () =>
    apply({
      ...Object.fromEntries(FILTER_PARAMS.map((name) => [name, ""])),
      ...(showRadius && { radius: "" }), // back to the API's 10 km
    });

  type Chip = { key: string; text: string; clear: Record<string, string> };
  const chips: Chip[] = [];
  if (showRadius && radius) {
    chips.push({
      key: "radius",
      text: `Within ${radius} km`,
      clear: { radius: "" },
    });
  }
  if (showTypes && listingType) {
    chips.push({
      key: "listingType",
      text: labelOf(listingType),
      clear: { listingType: "" },
    });
  }
  if (showTypes && propertyType) {
    chips.push({
      key: "propertyType",
      text: labelOf(propertyType),
      clear: { propertyType: "" },
    });
  }
  if (postedBy) {
    chips.push({
      key: "postedBy",
      text: `By ${labelOf(postedBy).toLowerCase()}`,
      clear: { postedBy: "" },
    });
  }
  if (maxPrice) {
    chips.push({
      key: "budget",
      text: `Under ${formatRupeesShort(maxPrice)}`,
      clear: { maxPrice: "" },
    });
  }
  if (beds) {
    chips.push({ key: "beds", text: `${beds}+ bedrooms`, clear: { beds: "" } });
  }

  // Rendered twice, once per layout, so each copy needs its own id to stay
  // paired with its own label.
  const sortSelect = (id: string, className: string) => (
    <>
      <label className="sr-only" htmlFor={id}>
        Sort by
      </label>
      <select
        id={id}
        value={sort}
        onChange={(event) => setParam("sort", event.target.value)}
        className={className}
      >
        {sorts.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="space-y-3">
      {/* ---------- phones and tablets ---------- */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-3.5 text-[15px] font-medium text-ink transition-colors hover:border-accent hover:text-accent ${focusRing}`}
        >
          <FilterIcon />
          Filters
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[12px] font-semibold tabular-nums text-white">
              {activeCount}
            </span>
          )}
        </button>
        {/* min-w-0 lets it shrink past its longest option instead of pushing the
            row wider than a 320px screen. */}
        {sortSelect(
          "filter-sort-narrow",
          `${sheetSelect} ml-auto min-w-0 max-w-[11.5rem]`,
        )}
      </div>

      {/* ---------- 1024px and up ---------- */}
      <div className="hidden items-end gap-3 lg:flex lg:flex-wrap">
        {showTypes && (
          <>
            <label className="sr-only" htmlFor="filter-listingType">
              Looking to
            </label>
            <select
              id="filter-listingType"
              value={listingType}
              onChange={(event) => setParam("listingType", event.target.value)}
              className={inlineSelect}
            >
              <option value="">Buy or rent</option>
              {LISTING_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="filter-propertyType">
              Property type
            </label>
            <select
              id="filter-propertyType"
              value={propertyType}
              onChange={(event) => setParam("propertyType", event.target.value)}
              className={inlineSelect}
            >
              <option value="">Any type</option>
              {propertyTypeOptions(listingType).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        )}

        {showRadius && (
          <>
            <label className="sr-only" htmlFor="filter-radius">
              Search radius
            </label>
            <select
              id="filter-radius"
              value={radius}
              onChange={(event) => setParam("radius", event.target.value)}
              className={inlineSelect}
            >
              <option value="">Within 10 km</option>
              {RADIUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Within {option.label}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="sr-only" htmlFor="filter-postedBy">
          Listed by
        </label>
        <select
          id="filter-postedBy"
          value={postedBy}
          onChange={(event) => setParam("postedBy", event.target.value)}
          className={inlineSelect}
        >
          <option value="">Any seller</option>
          {POSTED_BY.map((option) => (
            <option key={option.value} value={option.value}>
              Listed by {option.label.toLowerCase()}
            </option>
          ))}
        </select>

        {showBedrooms && (
          <>
            <label className="sr-only" htmlFor="filter-beds">
              Bedrooms
            </label>
            <select
              id="filter-beds"
              value={beds}
              onChange={(event) => setParam("beds", event.target.value)}
              className={inlineSelect}
            >
              <option value="">Any bedrooms</option>
              {BEDROOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} bedrooms
                </option>
              ))}
            </select>
          </>
        )}

        {/* A ceiling only: people shop to a budget, and "price: low to high"
            covers the other end better than a minimum would.

            In a popover rather than in the row: a range input needs two lines to
            show its value, which is what made this bar uneven, and dragging a
            120px slider is guesswork. The trigger states the value instead. */}
        <BudgetPopover
          amount={maxPrice}
          onCommit={(next) => setParam("maxPrice", next)}
        />

        <div className="ml-auto">
          {sortSelect("filter-sort-wide", inlineSelect)}
        </div>
      </div>

      {/* ---------- what is narrowing the list ---------- */}
      {/* Without this, a visitor seeing three results cannot tell which choice
          caused it. On a phone the row scrolls sideways rather than stacking. */}
      {chips.length > 0 && (
        <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => apply(chip.clear)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] font-medium text-accent transition-colors hover:bg-accent hover:text-white ${focusRing}`}
            >
              {chip.text}
              <span aria-hidden="true" className="text-[16px] leading-none">
                ×
              </span>
              <span className="sr-only">— remove this filter</span>
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className={`h-9 shrink-0 rounded-full px-2 text-[13px] font-medium text-muted transition-colors hover:text-ink ${focusRing}`}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ---------- the sheet ---------- */}
      {/* The native <dialog> opened with showModal() dims the page, keeps keyboard
          focus inside, closes on Esc, and is announced to screen readers. */}
      <dialog
        ref={sheet}
        aria-labelledby="filter-sheet-title"
        onCancel={(event) => {
          event.preventDefault();
          setSheetOpen(false);
        }}
        // A click on the dimmed backdrop lands on the <dialog> itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) setSheetOpen(false);
        }}
        // open:grid, not grid: a closed <dialog> relies on display:none, which a
        // plain display class would override and leave the sheet on screen.
        //
        // h-[88dvh], not max-h: a <dialog> is height:fit-content, which is an
        // indefinite height. Safari resolves the middle row against that before
        // applying max-height, so the scrolling area collapsed to a thin strip
        // with its text cut off; Chrome sizes it from the capped height, which is
        // why Android looked right. A definite height removes the ambiguity.
        //
        // Grid rows rather than flex for the same reason: minmax(0,1fr) states
        // outright that the middle row takes the leftover and may shrink to zero.
        className="sheet fixed inset-x-0 bottom-0 top-auto m-0 h-[88dvh] w-full max-w-[36rem] grid-rows-[auto_minmax(0,1fr)_auto] rounded-t-2xl bg-panel p-0 text-ink backdrop:bg-ink/40 open:grid sm:mx-auto lg:hidden"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="filter-sheet-title" className="font-display text-[17px]">
            Filters
          </h2>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className={`h-9 rounded-lg px-2.5 text-[14px] font-medium text-muted transition-colors hover:text-ink ${focusRing}`}
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close filters"
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ground hover:text-ink ${focusRing}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
                className="h-[18px] w-[18px]"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Takes whatever height the header and footer leave, so neither is ever
            pushed off a short screen. */}
        <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          {showTypes && (
            <>
              <Pills
                legend="Looking to"
                options={LISTING_TYPES}
                value={listingType}
                anyLabel="Buy or rent"
                onPick={(value) => setParam("listingType", value)}
              />

              <div>
                <label
                  htmlFor="sheet-propertyType"
                  className="mb-2 block text-[13px] font-medium text-muted"
                >
                  Property type
                </label>
                <select
                  id="sheet-propertyType"
                  value={propertyType}
                  onChange={(event) =>
                    setParam("propertyType", event.target.value)
                  }
                  className={sheetSelect}
                >
                  <option value="">Any type</option>
                  {propertyTypeOptions(listingType).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* The empty pill is 10 km, not "any": there is always a radius. */}
          {showRadius && (
            <Pills
              legend="Search radius"
              options={RADIUS_OPTIONS}
              value={radius}
              anyLabel="10 km"
              onPick={(value) => setParam("radius", value)}
            />
          )}

          <Pills
            legend="Listed by"
            options={POSTED_BY}
            value={postedBy}
            anyLabel="Anyone"
            onPick={(value) => setParam("postedBy", value)}
          />

          {showBedrooms && (
            <Pills
              legend="Bedrooms"
              options={BEDROOM_OPTIONS}
              value={beds}
              anyLabel="Any"
              onPick={(value) => setParam("beds", value)}
            />
          )}

          <BudgetSlider
            key={`sheet-${maxPrice}`}
            id="filter-budget-sheet"
            amount={maxPrice}
            onCommit={(next) => setParam("maxPrice", next)}
          />
        </div>

        {/* pb: the sheet is flush with the bottom of the screen, and on a phone
            with a home indicator or gesture bar the last ~34px of that is not
            usable area. Without the inset the button sits under it. max() keeps
            the normal 1rem on a phone that reports no inset. */}
        <div className="border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Choices already applied behind the sheet, so this only gets out of
              the way. Naming the thing it reveals beats a bare "Done". */}
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className={`h-11 w-full rounded-lg bg-accent text-[15px] font-medium text-white transition-colors hover:bg-accent-hover ${focusRing}`}
          >
            Show properties
          </button>
        </div>
      </dialog>
    </div>
  );
};

export default ListingFilters;
