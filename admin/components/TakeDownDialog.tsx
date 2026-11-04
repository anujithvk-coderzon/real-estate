"use client";

import { useEffect, useRef, useState } from "react";
import { dangerButton, focusable, outlineButton, quietButton } from "@/lib/ui";

// The seller is sent this sentence. Bounds match the API's own.
export const MIN_REASON = 15;
export const MAX_REASON = 300;

// What the dialog needs to know about the thing being removed: its title, and
// the reports that led here. Both pages that open it have those, in different
// shapes, so neither hands over its own row type.
export type TakeDownSubject = {
  listingId: string;
  title: string;
  reasons: string[];
};

// Taking a listing down is the one destructive thing on this page: it hides
// somebody's property from the site and sends them a notification saying so.
// Hence a written reason, mandatory, shown to them — and a preview of it, so
// nobody discovers afterwards what they actually sent.
const TakeDownDialog = ({
  subject,
  saving,
  failure,
  onCancel,
  onConfirm,
}: {
  subject: TakeDownSubject;
  saving: boolean;
  failure: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) => {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    area.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const reason = text.trim();
  const short = reason.length < MIN_REASON;
  const long = reason.length > MAX_REASON;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="takedown-title"
        className="flex h-dvh w-full flex-col border-line bg-panel sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="takedown-title" className="font-display text-[20px]">
              Take this listing down
            </h2>
            <p className="mt-1 truncate text-[13.5px] text-muted">
              {subject.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancel"
            className={`-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] leading-none text-muted transition-colors hover:text-ink sm:hidden ${focusable}`}
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-line bg-ground px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Reported {subject.reasons.length}{" "}
              {subject.reasons.length === 1 ? "time" : "times"}
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-muted">
              {subject.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>· {reason}</li>
              ))}
            </ul>
          </div>

          <label
            htmlFor="takedown-reason"
            className="mt-4 block text-[13px] font-medium"
          >
            Why <span className="text-danger">*</span>
          </label>
          <textarea
            id="takedown-reason"
            ref={area}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setConfirming(false);
            }}
            rows={4}
            maxLength={MAX_REASON + 80}
            aria-describedby="takedown-count"
            placeholder="What was wrong, and what the seller would have to fix to list it again."
            className={`mt-1.5 w-full rounded-xl border border-line bg-ground px-3.5 py-2.5 text-[16px] leading-relaxed outline-none focus:border-accent sm:text-[14px] ${focusable}`}
          />
          <p
            id="takedown-count"
            aria-live="polite"
            className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted"
          >
            <span className="tabular-nums">
              {reason.length}/{MAX_REASON}
            </span>
            {short && <span>One full sentence at least.</span>}
            {long && (
              <span className="text-danger">
                {reason.length - MAX_REASON} over. Trim it.
              </span>
            )}
          </p>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            What the seller is sent
          </p>
          <div className="mt-2 rounded-xl border border-line bg-ground px-4 py-3">
            <p className="text-[13px] font-medium">Listing Taken Down</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Your listing {subject.title} has been taken down by the admin.{" "}
              {reason || (
                <span className="italic">
                  …and whatever you type above goes here.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-5 py-3.5">
          {failure && (
            <p
              role="alert"
              className="mb-2.5 rounded-lg border border-danger/30 px-3.5 py-2.5 text-[13px] text-danger"
            >
              {failure} — nothing was changed.
            </p>
          )}
          {confirming && !saving && (
            <p className="mb-2.5 rounded-lg border border-warn/40 bg-warn/5 px-3.5 py-2.5 text-[13px] leading-relaxed">
              This hides the listing from the site at once, tells the seller
              why, and marks every open report on it as settled.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={short || long || saving}
                  onClick={() => onConfirm(reason)}
                  className={`w-full justify-center sm:w-auto ${dangerButton}`}
                >
                  {saving ? "Taking it down…" : "Yes, take it down"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirming(false)}
                  className={`w-full justify-center sm:w-auto ${outlineButton}`}
                >
                  Go back
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={short || long}
                  onClick={() => setConfirming(true)}
                  className={`w-full justify-center sm:w-auto ${dangerButton}`}
                >
                  Take down
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className={`hidden w-full justify-center sm:inline-flex sm:w-auto ${quietButton}`}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeDownDialog;
