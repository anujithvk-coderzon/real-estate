"use client";

import { useEffect, useRef, useState } from "react";
import {
  dangerButton,
  focusable,
  goodButton,
  outlineButton,
  quietButton,
} from "@/lib/ui";

// Bounds match the API's own, in both directions.
export const MIN_NOTE = 15;
export const MAX_NOTE = 300;

export type Decision = "APPROVE" | "REJECT";

export type DecisionSubject = {
  listingId: string;
  title: string;
  // Whether the listing is already in search. It decides the wording, because
  // on a live listing the photographs appear the instant Approve is pressed,
  // while on a draft they wait for the owner to publish.
  live: boolean;
  // What is waiting, for the approve preview.
  pendingImages: number;
  pendingVideo: boolean;
  // Set only on a rejection, which is aimed at ONE item: its kind, its id, and
  // what to call it in the sentence the seller reads.
  target?: { kind: "image" | "video"; id: string; label: string };
};

// Two decisions, one dialog, and deliberately not two components.
//
// They are the same shape — a note, a preview of what the seller is sent, a
// confirm step — and the only real differences are whether the note is
// compulsory and which way the button is coloured. Two files would be two
// copies of the preview text, and the preview is the part that must not drift
// from what the API actually sends.
const ApprovalDecision = ({
  decision,
  subject,
  saving,
  failure,
  onCancel,
  onConfirm,
}: {
  decision: Decision;
  subject: DecisionSubject;
  saving: boolean;
  failure: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) => {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);

  const rejecting = decision === "REJECT";

  useEffect(() => {
    // Only a rejection has a field to focus. On an approval the textarea is
    // not rendered at all, and `area.current` is null.
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

  const note = text.trim();
  // Short only matters on a rejection: an approval with nothing to add is the
  // normal case, and a compulsory field there gets filled with "ok" for ever.
  const short = rejecting && note.length < MIN_NOTE;
  const long = note.length > MAX_NOTE;

  // The exact sentence the seller receives, mirrored from
  // approveListingService and rejectListingService. Written out rather than
  // summarised because an operator who cannot see what they are sending will
  // eventually send something they did not mean to — and this is a message to
  // a stranger about their own property.
  //
  // It has to be kept in step with the API by hand. The alternative is the API
  // returning its own preview, which is a round trip before every decision; of
  // the two risks, a sentence that drifts in wording is the lesser.
  const { pendingImages: images, pendingVideo: video } = subject;
  const one = images === 1 && !video;
  const what =
    images > 0 && video
      ? `Your ${images} photo${images === 1 ? "" : "s"} and video`
      : video
        ? "Your video"
        : `Your ${images} photo${images === 1 ? "" : "s"}`;

  // An approve carrying a target is undoing a rejection on that one item,
  // not clearing everything waiting on the listing.
  const one_item = !rejecting && subject.target !== undefined;

  const preview = rejecting
    ? `${subject.target?.label ?? "This item"} on ${subject.title} cannot be shown to buyers yet. ${note || "…whatever you type above…"} Replace it and we will take another look — your listing itself stays up either way, and anything already checked is still showing.`
    : one_item
      ? subject.live
        ? `${subject.target!.label} on ${subject.title} has been checked and is now showing to buyers.`
        : `${subject.target!.label} on ${subject.title} has been checked. It will show to buyers as soon as you publish the listing.`
      : subject.live
        ? `${what} on ${subject.title} ${one ? "has" : "have"} been checked and ${one ? "is" : "are"} now showing to buyers.${note ? ` ${note}` : ""}`
        : `${what} on ${subject.title} ${one ? "has" : "have"} been checked. ${one ? "It" : "They"} will show to buyers as soon as you publish the listing.${note ? ` ${note}` : ""}`;

  const heading = rejecting
    ? `Send ${subject.target?.label.toLowerCase() ?? "this"} back`
    : one_item
    ? `Show ${subject.target!.label.toLowerCase()} after all`
    : video && images === 0
      ? "Show this video to buyers"
      : `Show ${images === 1 ? "this photo" : `these ${images} photos`} to buyers`;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        className="flex h-dvh w-full flex-col border-line bg-panel sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="decision-title" className="font-display text-[20px]">
              {heading}
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
          {/* What the decision does, before the note rather than after it. An
              operator reading this for the first time needs to know that
              approving does not publish anything. */}
          <div className="rounded-xl border border-line bg-ground px-4 py-3">
            <p className="text-[13px] leading-relaxed text-muted">
              {rejecting
                ? "Nothing is taken away. The listing stays where it is, every other photo keeps showing, and this one stays hidden — which is where it is now. The owner replaces it and it comes back here."
                : one_item
                  ? "This undoes the note you sent the seller about this one item. Everything else on the listing stays as it is."
                  : subject.live
                    ? "This listing is already in search. These photos start showing to buyers the moment you press this."
                    : "This listing is still a draft, so nothing changes for buyers today. These photos will show the moment its owner publishes it — which they can do whenever they like."}
            </p>
          </div>

          {/* Only on a rejection. An approval is an operator saying "yes",
              and a free-text box beside a yes gets filled with "ok" for ever —
              or with something the seller then has to interpret. The one that
              needs words is the one that asks them to act. */}
          {rejecting && (
            <>
              <label
                htmlFor="decision-note"
                className="mt-4 block text-[13px] font-medium"
              >
                What is wrong with{" "}
                {subject.target?.label.toLowerCase() ?? "it"}{" "}
                <span className="text-danger">*</span>
              </label>
              <textarea
                id="decision-note"
                ref={area}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setConfirming(false);
                }}
                rows={4}
                maxLength={MAX_NOTE + 80}
                aria-describedby="decision-count"
                placeholder="In a sentence they can act on. “This is a screenshot from another site” beats “not acceptable” — they cannot see your screen."
                /* 16px at base, not 14: iOS Safari zooms the whole page in on a
                   focused input under 16px, and on a 320px screen that zoom
                   leaves the dialog's buttons off the edge. */
                className={`mt-1.5 w-full rounded-xl border border-line bg-ground px-3.5 py-2.5 text-[16px] leading-relaxed outline-none focus:border-accent sm:text-[14px] ${focusable}`}
              />
              <p
                id="decision-count"
                aria-live="polite"
                className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted"
              >
                <span className="tabular-nums">
                  {note.length}/{MAX_NOTE}
                </span>
                {short && <span>One sentence they can act on, at least.</span>}
                {long && (
                  <span className="text-danger">
                    {note.length - MAX_NOTE} over. Trim it.
                  </span>
                )}
              </p>
            </>
          )}

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            What the seller is sent
          </p>
          <div className="mt-2 rounded-xl border border-line bg-ground px-4 py-3">
            <p className="text-[13px] font-medium">
              {rejecting
                ? subject.target?.kind === "video"
                  ? "Your Video Needs Changing"
                  : "A Photo Needs Changing"
                : one_item
                  ? "Photo Approved"
                  : subject.live
                  ? "Photos Are Live"
                  : "Photos Checked"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {preview}
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
              {rejecting
                ? "This sends the note above to the seller. Their listing stays up; this one item stays hidden until they replace it."
                : subject.live
                  ? "These photos go onto a live page immediately. You can still take the whole listing down later if something was missed."
                  : "Cleared for whenever its owner publishes."}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={short || long || saving}
                  onClick={() => onConfirm(note)}
                  className={`w-full justify-center sm:w-auto ${
                    rejecting ? dangerButton : goodButton
                  }`}
                >
                  {saving
                    ? rejecting
                      ? "Sending it back…"
                      : "Releasing…"
                    : rejecting
                      ? "Yes, send it back"
                      : subject.live
                        ? "Yes, show them now"
                        : "Yes, clear them"}
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
                  className={`w-full justify-center sm:w-auto ${
                    rejecting ? dangerButton : goodButton
                  }`}
                >
                  {rejecting
                    ? "Send back"
                    : one_item
                      ? "Show it"
                      : "Approve photos"}
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

export default ApprovalDecision;
