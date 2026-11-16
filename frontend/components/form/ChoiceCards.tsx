import TypeGlyph from "@/components/public/TypeGlyph";
import type { Option } from "@/lib/listing";
import { focusRing } from "@/lib/ui";

// A set of choices as pressable cards rather than a dropdown.
//
// A select hides every option until it is opened, shows one at a time, and on
// a phone hands the whole decision to the operating system's picker. Cards put
// the choices on the page where they can be compared, and give the answer a
// glyph — which is what a seller recognises first, before they read the word.
//
// Kept to one job: the caller owns the label, the asterisk and the hint.
const ChoiceCards = ({
  name,
  options,
  value,
  onChange,
  withGlyph = false,
  columns = "grid-cols-2 sm:grid-cols-3",
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  withGlyph?: boolean;
  columns?: string;
}) => (
  // radiogroup, not a list of buttons: arrow keys move between options and a
  // screen reader announces "3 of 7", which a row of buttons does not.
  <div role="radiogroup" aria-label={name} className={`grid gap-2 ${columns}`}>
    {options.map((option) => {
      const selected = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(selected ? "" : option.value)}
          // The selected tile carries its border AND a ring of the same
          // colour. One pixel of border alone is easy to miss across a grid;
          // doubling it is what makes the answer unmistakable at a glance.
          className={`relative flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[14px] border px-2 py-4 text-center transition-[border-color,background-color,box-shadow] duration-200 ${focusRing} ${
            selected
              ? "border-accent bg-accent-soft text-accent shadow-[0_0_0_1px_var(--color-accent)]"
              : "border-line bg-panel text-ink hover:border-accent/40 hover:bg-ground"
          }`}
        >
          {/* A radio dot in the corner. The colour change says which tile is
              chosen; this says the tiles are a choice at all, before anything
              has been picked. */}
          <span
            aria-hidden="true"
            className={`absolute right-2.5 top-2.5 h-[17px] w-[17px] rounded-full transition-[border-color,border-width] ${
              selected
                ? "border-[5px] border-accent"
                : "border border-line bg-panel"
            }`}
          />
          {withGlyph && (
            <TypeGlyph
              type={option.value}
              className={`h-7 w-7 ${selected ? "text-accent" : "text-muted"}`}
            />
          )}
          <span className="text-[13px] font-medium leading-tight">
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default ChoiceCards;
