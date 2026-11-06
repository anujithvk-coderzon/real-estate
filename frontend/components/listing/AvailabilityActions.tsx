"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  availabilityMoves,
  nextAvailability,
  type AvailabilityMove,
} from "@/lib/listing";
import { changeListingStatus } from "@/lib/listingStatus";
import { errorToast, successToast } from "@/lib/toast";
import type { ListingStatus } from "@/lib/types";
import { secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type Props = {
  id: string;
  // Quoted back in the confirmation, so a seller with eight similar plots can
  // see which one they are about to take off the market.
  title: string;
  // SALE ends as SOLD; RENT and PG end as RENTED. The seller is never asked
  // which word applies — see closedStatusFor.
  listingType: string;
  status: ListingStatus;
  // The caller holds the listing, so it updates its own copy: a badge, a
  // banner and a contact block all read the status and have to change
  // together, without a reload.
  onChange: (next: ListingStatus) => void;
  // Shape only. "button" is the ordinary size, for a page; "inline" is the
  // small outlined pill that fits a card footer beside Edit.
  variant?: "button" | "inline";
  // "next" is the single move a card or listing page offers. "all" adds the
  // ones that need room to explain themselves — publishing, and unlisting —
  // and belongs on the edit page.
  moves?: "next" | "all";
  className?: string;
};

const inlineButton =
  // Outlined, not bare text: in a card footer beside "Edit" an unbordered
  // label reads as a caption, and nobody taps a caption.
  "rounded-lg border border-line px-2.5 py-1.5 font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";

// The moves the listing can make from where it stands, as buttons. Live offers
// "Mark as sold"; sold offers "Mark as available". Never both states as a
// switch: every surface that renders this already says which state the listing
// is in, with a badge or a banner, and a disabled button beside a live one
// leaves the seller working out which of the two is a statement.
//
// Every surface goes through here — the owner's card grid, the dashboard page,
// and the public page when its owner is reading it — so the available move, the
// request and the question asked before a closing move are decided once.
const AvailabilityActions = ({
  id,
  title,
  listingType,
  status,
  onChange,
  variant = "button",
  moves = "next",
  className,
}: Props) => {
  const [saving, setSaving] = useState(false);
  // The move waiting on a yes.
  const [asking, setAsking] = useState<AvailabilityMove | null>(null);

  // Empty on an expired listing (the system's) and on a taken-down one
  // (moderation's, and not the seller's to undo). Decided in lib/listing.ts so
  // that no caller can get it wrong.
  const offered =
    moves === "all"
      ? availabilityMoves({ listingType, status })
      : [nextAvailability({ listingType, status })].filter(
          (move): move is AvailabilityMove => move !== null,
        );
  if (offered.length === 0) return null;

  const run = async (next: ListingStatus) => {
    setSaving(true);
    try {
      successToast(await changeListingStatus(id, next, status));
      setAsking(null);
      onChange(next);
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {offered.map((move) => (
        <button
          key={move.next}
          type="button"
          // A closing move asks first: it leaves search at once and takes the
          // contact buttons with it, which is not what a mis-tap should cost.
          // Opening moves do not ask — reopening is the undo, and a dialog in
          // front of an undo teaches people the first dialog meant nothing.
          onClick={() => (move.closing ? setAsking(move) : void run(move.next))}
          disabled={saving}
          className={`${variant === "inline" ? inlineButton : secondaryButton} ${
            className ?? ""
          }`}
        >
          {move.label}
        </button>
      ))}

      {asking && (
        <ConfirmDialog
          open
          title={`${asking.label}?`}
          message={
            <>
              <span className="font-medium text-ink">
                &ldquo;{title}&rdquo;
              </span>{" "}
              {asking.next === "DRAFT" ? (
                <>
                  will leave search, and its page will stop opening — every link
                  to it, including the ones already sent to buyers, will show
                  nothing found. It goes back to your drafts, where you can edit
                  it and publish it again.
                </>
              ) : (
                <>
                  will leave search straight away, and buyers will no longer be
                  able to call or message you about it. Anyone holding the link
                  still sees the page, marked as taken. You can put it back any
                  time.
                </>
              )}
            </>
          }
          confirmLabel={asking.label}
          busyLabel="Saving…"
          busy={saving}
          onConfirm={() => void run(asking.next)}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  );
};

export default AvailabilityActions;
