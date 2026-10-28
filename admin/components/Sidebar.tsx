"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Icons are inline rather than a library: five 20px glyphs do not justify a
// dependency, and these inherit currentColor so the active state tints them
// without a second class.
const icon = {
  home: "M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1Z",
  listings: "M4 4h16v6H4Zm0 10h16v6H4Z",
  users: "M4 20a6 6 0 0 1 12 0M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8m8 16a5 5 0 0 0-3-4.6",
  interests: "M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z",
  promotions: "M4 10v4h3l5 4V6L7 10H4Zm12-2a5 5 0 0 1 0 8",
} as const;

const Glyph = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-[18px] w-[18px] shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const NAV = [
  { href: "/home", label: "Home", d: icon.home },
  { href: "/interests", label: "User interests", d: icon.interests },
  { href: "/promotions", label: "Promotions", d: icon.promotions },
] as const;

// Shown but not linked — a staff tool should say what it will hold, and a link
// to a route that 404s is worse than a label that admits it is not ready.
const SOON = [
  { label: "Listings", d: icon.listings, note: "approve, hide, remove" },
  { label: "Sellers", d: icon.users, note: "accounts and RERA" },
] as const;

const itemBase =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors";

const Sidebar = ({
  operator,
  onSignOut,
  onNavigate,
}: {
  operator: { name: string; email: string } | null;
  onSignOut: () => void;
  onNavigate?: () => void;
}) => {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="font-display text-[18px] leading-none">
          Properties<span className="text-accent">.</span>
        </p>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
          Staff
        </span>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const current = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={`${itemBase} ${
                    current
                      ? "bg-accent-soft font-semibold text-accent"
                      : "text-ink hover:bg-ground"
                  }`}
                >
                  <Glyph d={item.d} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          Not built yet
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {SOON.map((item) => (
            <li key={item.label}>
              {/* A div, not a disabled button: there is nothing to press, and a
                  disabled control in a nav list reads as broken rather than
                  forthcoming. */}
              <div
                className={`${itemBase} cursor-default text-muted/70`}
                title={item.note}
              >
                <Glyph d={item.d} />
                <span className="truncate">{item.label}</span>
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        {operator && (
          <div className="px-2 pb-3">
            {/* min-w-0 + truncate, because a long email is the thing that
                breaks a fixed-width sidebar. */}
            <p className="truncate text-[13px] font-semibold">{operator.name}</p>
            <p className="truncate text-[12px] text-muted">{operator.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-ink transition-colors hover:bg-ground hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-[18px] w-[18px] shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 17l5-5-5-5M20 12H9M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
