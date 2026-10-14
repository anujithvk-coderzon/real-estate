import { PROPERTY_TYPES, TYPE_COLOUR } from "@/lib/listing";

// What the pin colours mean. Without this the map is prettier and no more
// useful; with it, a glance says "the cheap side of town is all plots" before
// anything has been clicked.
//
// Only the types actually on the map are listed. A legend for seven colours
// when three are present is a legend nobody reads.
const MapLegend = ({ types }: { types: string[] }) => {
  const present = PROPERTY_TYPES.filter((type) => types.includes(type.value));
  if (present.length < 2) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {present.map((type) => (
        <li
          key={type.value}
          className="flex items-center gap-1.5 text-[12px] text-muted"
        >
          <span
            aria-hidden="true"
            style={{ background: TYPE_COLOUR[type.value] }}
            className="h-[7px] w-[7px] shrink-0 rounded-full"
          />
          {type.label}
        </li>
      ))}
    </ul>
  );
};

export default MapLegend;
