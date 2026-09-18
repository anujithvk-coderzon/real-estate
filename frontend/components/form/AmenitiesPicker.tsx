import { amenityCategoryLabel } from "@/lib/listing";
import type { ListingAmenity } from "@/lib/types";

type Props = {
  amenities: ListingAmenity[];
  categories: string[];
  selected: string[];
  onToggle: (amenityId: string) => void;
};

// Amenities grouped by category, each one a toggle chip.
const AmenitiesPicker = ({ amenities, categories, selected, onToggle }: Props) => (
  <div className="space-y-5">
    {categories.map((category) => {
      const inCategory = amenities.filter((amenity) => amenity.category === category);
      if (inCategory.length === 0) return null;

      return (
        <fieldset key={category}>
          <legend className="text-[13px] font-medium text-muted">{amenityCategoryLabel(category)}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {inCategory.map((amenity) => {
              const on = selected.includes(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(amenity.id)}
                  className={`rounded-full border px-3 py-1.5 text-[14px] transition-colors ${
                    on
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-line bg-panel text-ink hover:border-accent/50"
                  }`}
                >
                  {on && <span aria-hidden="true">✓ </span>}
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
