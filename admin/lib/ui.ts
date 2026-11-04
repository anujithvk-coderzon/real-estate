// Button and focus classes shared by the dashboard pages. They were copied at
// the top of every page before, which is how two queues doing the same job
// ended up with buttons of two different heights.

export const focusable =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const outlineButton = `inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

export const solidButton = `inline-flex min-h-11 items-center rounded-lg bg-accent px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

// The positive counterpart to dangerButton. Used for an action that undoes a
// removal, where the brand's purple would read as "primary" rather than as
// "this is the safe direction".
export const goodButton = `inline-flex min-h-11 items-center rounded-lg bg-good px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

export const dangerButton = `inline-flex min-h-11 items-center rounded-lg bg-danger px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

export const quietButton = `inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink ${focusable}`;

// The message an API error carries, when it carries one.
export const apiMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string" ? message : fallback;
};

export const onDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
