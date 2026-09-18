// Shared class names, so inputs and buttons look the same on every page.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const inputClass =
  "w-full rounded-md border border-line bg-panel px-3 py-2 text-[15px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export const labelClass = "mb-1.5 block text-[13px] font-medium text-muted";

export const primaryButton = `rounded-md bg-accent px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const secondaryButton = `rounded-md border border-line px-4 py-2.5 text-[15px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const dangerButton = `rounded-md bg-danger px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const textButton = `text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

export const sectionTitle = "text-[19px] font-semibold tracking-tight";
