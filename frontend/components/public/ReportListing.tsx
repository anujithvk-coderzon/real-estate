"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { api } from "@/lib/api";
import { authHref, rememberReturn } from "@/lib/returnTo";
import { errorToast, successToast } from "@/lib/toast";
import { inputClass, primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// The reasons, in the order somebody scanning them would recognise their own
// problem. Each one is sent as the complaint's title, so the queue groups by
// them — free text here would mean nobody can ever answer "how many listings
// were reported as already sold".
const REASONS = [
  "Already sold or rented",
  "Details are wrong or misleading",
  "The price is wrong",
  "The photos are not of this property",
  "Nobody answers, or the contact is fake",
  "This is a duplicate of another listing",
  "The RERA number looks wrong",
  "Offensive or inappropriate content",
  "Something else",
] as const;

// A flag, so the control reads as a control. Without a glyph it was a grey
// 13px line among other grey 13px lines, which is exactly how a thing nobody
// can find looks.
const FlagIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-3.5 w-3.5"
  >
    <path d="M5.5 21V4.5" />
    <path d="M5.5 5.5h9.5l-1 3 1 3H5.5" />
  </svg>
);

const MIN_DETAIL = 15;
const MAX_DETAIL = 1000;

const ReportListing = ({
  slug,
  signedIn,
  here,
}: {
  slug: string;
  // Derived by the page from the payload it got, so this component never has
  // to ask the API who is reading.
  signedIn: boolean;
  // Where to come back to after signing in.
  here: string;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) {
        setOpen(false);
        return;
      }
      // Tab must not walk out of the dialog into the page behind it: that page
      // is still there and still focusable, so a keyboard user who tabs past
      // the last button lands on a listing they cannot see.
      if (event.key !== "Tab" || !panel.current) return;
      const stops = panel.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), select, textarea, a[href], input:not([disabled])",
      );
      if (stops.length === 0) return;
      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      const here = document.activeElement;
      if (event.shiftKey && (here === first || !panel.current.contains(here))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && here === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    area.current?.focus();
    // Back to the control they pressed, not to the top of the page.
    return () => opener?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const body = detail.trim();
  const short = body.length < MIN_DETAIL;
  const long = body.length > MAX_DETAIL;

  const submit = async () => {
    if (short || long) return;
    setSending(true);
    try {
      const { data } = await api.post(`/list/complaint/${slug}`, {
        title: reason,
        body,
      });
      successToast(data.message ?? "Thank you — we have your report");
      setOpen(false);
      setSent(true);
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSending(false);
    }
  };

  // Reported in this session. Not a promise that it is resolved — only that we
  // have it, which is the honest thing to say and the thing the law gives us
  // 24 hours to say.
  if (sent)
    return (
      <p className="text-[13px] text-muted">
        Thank you — we have your report, and somebody will look at this listing.
      </p>
    );

  // Signing in is required by the endpoint, and asking before the form is
  // written beats taking a paragraph of typing and then throwing it away at a
  // login wall.
  if (!signedIn)
    return (
      <p className="text-[13px] text-muted">
        <Link
          href={authHref("/auth/login", here)}
          onClick={() => rememberReturn(here)}
          className="font-medium text-muted underline decoration-line decoration-1 underline-offset-[3px] hover:text-ink hover:decoration-accent"
        >
          Sign in to report this listing
        </Link>{" "}
        if something here is wrong or misleading.
      </p>
    );

  return (
    <>
      {/* Quiet, but not hidden: a glyph and an underline, so it reads as a
          control rather than as one more grey line of small print. Still not a
          filled button — a loud Report beside Chat collects misclicks on
          sellers who did nothing wrong. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-muted underline decoration-line decoration-1 underline-offset-[3px] transition-colors hover:text-danger hover:decoration-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <FlagIcon />
        Report this listing
      </button>

      {/* Portalled to <body>, not left where it is written. This control sits
          in the listing page's right-hand column, which is lg:sticky — and a
          sticky element creates a stacking context, so a z-index set inside it
          is scoped to that column rather than to the page. The overlay ends up
          painted under whatever comes later in the document. The portal takes
          it out of every ancestor's stacking context, transform and overflow
          at once. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-6">
            {/* No click-outside close: there is typing in here. */}
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-title"
              className="flex h-dvh w-full flex-col bg-panel sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:ring-1 sm:ring-line"
            >
              <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 id="report-title" className="font-display text-[20px]">
                    Report this listing
                  </h2>
                  <p className="mt-1 text-[13px] text-muted">
                    Only our team sees this. The seller is not told who reported
                    it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  aria-label="Close"
                  className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] leading-none text-muted transition-colors hover:text-ink"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <label
                  htmlFor="report-reason"
                  className="block text-[13px] font-medium"
                >
                  What is wrong?
                </label>
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  {REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="report-detail"
                  className="mt-4 block text-[13px] font-medium"
                >
                  What should we know? <span className="text-danger">*</span>
                </label>
                <textarea
                  id="report-detail"
                  ref={area}
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  rows={5}
                  maxLength={MAX_DETAIL + 80}
                  aria-describedby="report-count"
                  placeholder="Anything that helps us check it — what you saw, when, and how you know."
                  className={`${inputClass} mt-1.5 text-[16px] sm:text-[15px]`}
                />
                <p
                  id="report-count"
                  aria-live="polite"
                  className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted"
                >
                  <span className="tabular-nums">
                    {body.length}/{MAX_DETAIL}
                  </span>
                  {short && (
                    <span>One line at least, so we know what to check.</span>
                  )}
                  {long && (
                    <span className="text-danger">
                      {body.length - MAX_DETAIL} over. Trim it.
                    </span>
                  )}
                </p>

                <p className="mt-4 rounded-lg border border-line bg-ground px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
                  We acknowledge every report within 24 hours and aim to settle
                  it within 15 days. Reporting a listing does not take it down
                  by itself — somebody here reads it first, and a listing that
                  turns out to be fine stays up.
                </p>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-3.5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={short || long || sending}
                  onClick={submit}
                  className={`w-full sm:w-auto ${primaryButton}`}
                >
                  {sending ? "Sending…" : "Send report"}
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setOpen(false)}
                  className={`hidden w-full sm:inline-flex sm:w-auto ${secondaryButton}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default ReportListing;
