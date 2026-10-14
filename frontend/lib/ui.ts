// Shared class names, so inputs and buttons look the same on every page.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// 16px on phones is not a style choice: Mobile Safari zooms the whole page when
// a focused field's text is smaller than that, and the visitor is left on a
// zoomed, sideways-scrolling page. Desktop keeps the 15px the design asks for.
//
// min-h-11 is 44px, the smallest target a finger hits reliably.
export const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-panel px-3 py-2 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-[15px]";

export const labelClass = "mb-1.5 block text-[13px] font-medium text-muted";

// The three solid buttons share min-h-11 so they line up and all clear 44px;
// padding alone left them at 42.5px.
export const primaryButton = `inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const secondaryButton = `inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2.5 text-[15px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const dangerButton = `inline-flex min-h-11 items-center justify-center rounded-lg bg-danger px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// py-3 with -my-3 grows the tappable box to 44px without moving anything around
// it: a bare 13px line is a ~20px target, the smallest in the app.
export const textButton = `inline-flex items-center px-1 py-3 -my-3 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

export const sectionTitle = "text-[19px] font-semibold tracking-tight";
