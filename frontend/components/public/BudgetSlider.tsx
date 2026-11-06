"use client";

import { useEffect, useRef, useState } from "react";
import { formatRupeesShort } from "@/lib/format";
import {
  BUDGET_MAX,
  BUDGET_STEPS,
  budgetAt,
  budgetPosition,
} from "@/lib/listing";

// How long after the last drag before the choice is written. Long enough that
// sliding across the track is one update rather than a hundred.
const COMMIT_DELAY = 250;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The budget, as a track rather than a list of ceilings.
//
// It lives in its own file because two screens show it: the filter bar beside
// the results on a laptop, and the chrome over the map on a phone. It was
// private to ListingFilters, so the phone got a <select> of preset amounts
// instead — a second control answering the same question in a different
// vocabulary, which is how two parts of one app start disagreeing.
//
// Keyed on the committed amount by its parent, so a chip removal or Clear all
// remounts it at the right spot instead of needing an effect to resync.
const BudgetSlider = ({
  id,
  amount,
  onCommit,
  compact = false,
  dense = false,
  className = "",
}: {
  // Every copy stays in the DOM at once, so each needs its own id for its
  // label — a second <label htmlFor> pointing at the first would move focus to
  // a control on another part of the screen.
  id: string;
  amount: string;
  onCommit: (next: string) => void;
  compact?: boolean;
  // For chrome laid over a map, where every row costs map. Drops the two end
  // captions and tightens the spacing, so the control is the height of the
  // select beside it rather than half again as tall. The track still says
  // where you are, and the value is printed above it either way — the captions
  // only name the ends, which on a logarithmic scale nobody reads off anyway.
  dense?: boolean;
  className?: string;
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
    <div className={`${compact ? "min-w-56 flex-1" : ""} ${className}`.trim()}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className={`font-medium text-muted ${dense ? "text-[12px]" : "text-[13px]"}`}
        >
          Budget
        </label>
        <span
          className={`min-w-0 truncate font-medium tabular-nums text-ink ${dense ? "text-[13px]" : "text-[15px]"}`}
        >
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
        className={`w-full accent-accent ${dense ? "mt-0.5" : "mt-2"} ${focusRing}`}
      />
      {!dense && (
        <div className="mt-0.5 flex justify-between text-[12px] text-muted">
          <span>Any</span>
          <span>{formatRupeesShort(BUDGET_MAX)}</span>
        </div>
      )}
    </div>
  );
};

export default BudgetSlider;
