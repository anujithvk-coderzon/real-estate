// Display formatting for Indian users.

export const formatNumber = (value: string | number) =>
  Number(value).toLocaleString("en-IN");

export const formatRupees = (value: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));

// Property prices are read in lakh and crore: ₹45 L, ₹1.2 Cr.
export const formatRupeesShort = (value: string | number) => {
  const amount = Number(value);
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");

  if (amount >= 1_00_00_000) return `₹${trim(amount / 1_00_00_000)} Cr`;
  if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)} L`;
  return formatRupees(amount);
};

export const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

export const formatFileSize = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const relative = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

// "today", "yesterday", "3 days ago", "2 months ago"
export const formatTimeAgo = (value: string) => {
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days > -30) return relative.format(days, "day");
  if (days > -365) return relative.format(Math.round(days / 30), "month");
  return relative.format(Math.round(days / 365), "year");
};
