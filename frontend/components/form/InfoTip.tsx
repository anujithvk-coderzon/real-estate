"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// An "i" button that opens a short explanation. The form shows what to do; the
// why lives here, for whoever wants it, so the page is not a wall of text.
//
// Opened by a tap or click rather than hover, because most sellers are on a
// phone and a phone has no hover.
//
// Rendered into document.body: the cards in CardStack are transformed, and a
// transformed ancestor turns position: fixed into position: absolute, which
// would pin the panel to the card instead of the screen.

const WIDTH = 300;
const GUTTER = 16; // never closer to the screen edge than the page gutter
const GAP = 8;

type Props = {
  // Read out for the button, e.g. "Who can see the pin".
  label: string;
  children: ReactNode;
};

type Position = { top: number; left: number; width: number };

const InfoTip = ({ label, children }: Props) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const id = useId();

  // Below the button when it fits, above it when it would run off the bottom,
  // and slid sideways so it never leaves the screen.
  const place = useCallback(() => {
    const anchor = button.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - GUTTER * 2);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, GUTTER),
      window.innerWidth - GUTTER - width,
    );
    const height = panel.current?.offsetHeight ?? 0;
    const below = rect.bottom + GAP;
    const top =
      below + height > window.innerHeight - GUTTER && rect.top - GAP - height > GUTTER
        ? rect.top - GAP - height
        : below;
    setPosition({ top, left, width });
  }, []);

  // Measured after the panel is in the page, so its real height decides
  // whether it opens above or below.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Forgets the position too, so the next opening is measured afresh.
  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target))
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    // Capture, so scrolling inside any container also moves the panel along.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        // The circle is 18px; the padding makes the tap area 36px, cancelled
        // by the negative margin so it does not push the label around.
        className={`-m-2 inline-flex shrink-0 items-center justify-center rounded-full p-2 align-middle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          open ? "text-accent" : "text-muted hover:text-accent"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          aria-hidden="true"
          className="h-[18px] w-[18px]"
        >
          <circle cx="10" cy="10" r="8.2" />
          <path d="M10 9v5" />
          <circle cx="10" cy="6.2" r="0.4" fill="currentColor" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="note"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: position?.width ?? WIDTH,
              // Hidden for the one frame before it has been measured.
              visibility: position ? "visible" : "hidden",
            }}
            className="fixed z-50 rounded-lg bg-panel px-3.5 py-3 text-left text-[13px] font-normal normal-case leading-relaxed tracking-normal text-ink shadow-lg ring-1 ring-line"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
};

export default InfoTip;
