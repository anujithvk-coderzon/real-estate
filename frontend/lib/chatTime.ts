// Time formatting shared by the chat thread and the chats drawer, so the same
// moment never reads two different ways in two places.

// Inside a thread the question is always "when, relative to the message above",
// so bubbles show clock time rather than "3 hours ago".
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const yesterdayOf = (date: Date) => {
  const result = new Date(date);
  // setDate handles month and year rollover, so 1 Nov - 1 lands on 31 Oct.
  result.setDate(date.getDate() - 1);
  return result;
};

// The divider above a group of messages: Today / Yesterday / 19 Oct.
export const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterdayOf(today))) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    // The year is noise on anything from this year, and confusing when absent
    // from something older.
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

// An inbox row has one line for the time, so today collapses to the clock and
// everything else to a date.
export const inboxTime = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  if (sameDay(date, today)) return clockTime(iso);
  if (sameDay(date, yesterdayOf(today))) return "Yesterday";
  return dayLabel(iso);
};
