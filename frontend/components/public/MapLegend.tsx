import { PROPERTY_TYPES, TYPE_COLOUR } from "@/lib/listing";

// What the pin colours mean. Without this the map is prettier and no more
// useful; with it, a glance says "the cheap side of town is all plots" before
// anything has been clicked.
//
// Only the types actually on the map are listed. A legend for seven colours
// when three are present is a legend nobody reads — and one colour explains
// itself, so below two there is nothing here worth the space.
//
// The box is part of this component rather than the page's. It was the page's,
// rendered on `shown.length > 1` — more than one LISTING — while the list
// inside appears on more than one TYPE. Filtering to a single type satisfied
// the first test and failed the second, so the chrome rendered around nothing:
// a full-width empty white bar on a phone, a small empty tab in the corner on a
// desktop. Two conditions that had to agree, in two files, is what made that
// possible; now there is one, here.
const MapLegend = ({ types }: { types: string[] }) => {
  const present = PROPERTY_TYPES.filter((type) => types.includes(type.value));
  if (present.length < 2) return null;

  return (
    // left-3 with a max width rather than left-3 right-3: the box is as wide as
    // the words in it and no wider, so two types on a phone no longer reserve
    // the whole screen width for a line of text that does not fill it. The cap
    // keeps it off both edges when every type is present.
    // bottom-20 clears the List button; from lg that button is gone.
    <div className="pointer-events-none absolute bottom-20 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-xl bg-panel/95 px-2.5 py-2 ring-1 ring-line backdrop-blur-sm lg:bottom-3 lg:max-w-xs lg:px-3 lg:py-2.5">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted lg:gap-x-4 lg:gap-y-1.5 lg:text-[12px]">
        {present.map((type) => (
          <li key={type.value} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              style={{ background: TYPE_COLOUR[type.value] }}
              className="h-[7px] w-[7px] shrink-0 rounded-full"
            />
            {type.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MapLegend;
