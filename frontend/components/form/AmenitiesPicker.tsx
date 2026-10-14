import { amenityCategoryLabel } from "@/lib/listing";
import type { ListingAmenity } from "@/lib/types";

type Props = {
  amenities: ListingAmenity[];
  categories: string[];
  selected: string[];
  onToggle: (amenityId: string) => void;
};

// Amenities grouped by category, each one a toggle chip.
const AmenitiesPicker = ({
  amenities,
  categories,
  selected,
  onToggle,
}: Props) => (
  <div className="space-y-5">
    {categories.map((category) => {
      const inCategory = amenities.filter(
        (amenity) => amenity.category === category,
      );
      if (inCategory.length === 0) return null;

      return (
        <fieldset key={category}>
          <legend className="text-[13px] font-medium text-muted">
            {amenityCategoryLabel(category)}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {inCategory.map((amenity) => {
              const on = selected.includes(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(amenity.id)}
                  className={`flex items-center gap-1 rounded-full border px-3.5 py-2.5 text-[14px] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 sm:py-1.5 ${
                    on
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-line bg-panel text-ink hover:border-accent/50"
                  }`}
                >
                  {/* Fixed room for the tick, so the label does not jump
                      sideways the moment you press it. */}
                  <span
                    aria-hidden="true"
                    className={`inline-block w-0 overflow-hidden transition-[width,opacity] duration-150 ${
                      on ? "w-3.5 opacity-100" : "opacity-0"
                    }`}
                  >
                    &#10003;
                  </span>
                  {amenity.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    })}
  </div>
);

export default AmenitiesPicker;
