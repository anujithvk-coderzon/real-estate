"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";

// Icons are inline rather than a library: five 20px glyphs do not justify a
// dependency, and these inherit currentColor so the active state tints them
// without a second class.
const icon = {
  home: "M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1Z",
  listings: "M4 4h16v6H4Zm0 10h16v6H4Z",
  users:
    "M4 20a6 6 0 0 1 12 0M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8m8 16a5 5 0 0 0-3-4.6",
  interests:
    "M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z",
  promotions: "M4 10v4h3l5 4V6L7 10H4Zm12-2a5 5 0 0 1 0 8",
  rera: "M6 3h9l4 4v14H6Zm3 10 2 2 4-4",
  projects: "M4 20V9h6v11M14 20V4h6v16M6 12h2M6 15h2M16 7h2M16 10h2M16 13h2",
  flag: "M6 21V4m0 1h10l-1.5 3.5L16 12H6",
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
  { href: "/listings", label: "Photo approvals", d: icon.listings },
  { href: "/interests", label: "User interests", d: icon.interests },
  { href: "/promotions", label: "Promotions", d: icon.promotions },
  { href: "/rera", label: "Agent RERA", d: icon.rera },
  // Its own queue, not a tab of the agents' one: a project's registration is
  // compulsory before it may be advertised at all, the register is a different
  // one, and the person told about the decision is the builder, not the lister.
  { href: "/project-rera", label: "Project RERA", d: icon.projects },
  // What visitors have reported. Named for what it holds rather than for the
  // table behind it: an operator looks for the flagged thing, not for a row in
  // "complaints".
  { href: "/flagged", label: "Flagged content", d: icon.flag },
] as const;

const itemBase =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors";

const Sidebar = ({
  operator,
  onSignOut,
  onNavigate,
  waiting,
}: {
  operator: { name: string; email: string } | null;
  onSignOut: () => void;
  onNavigate?: () => void;
  waiting?: number | null;
}) => {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <Wordmark className="text-[18px] leading-none" />
        </div>
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
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>

                  {item.href === "/listings" &&
                    typeof waiting === "number" &&
                    waiting > 0 && (
                      <span
                        aria-label={`${waiting} waiting`}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          current
                            ? "bg-accent text-white"
                            : "bg-warn/15 text-warn"
                        }`}
                      >
                        {waiting > 99 ? "99+" : waiting}
                      </span>
                    )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        {operator && (
          <div className="px-2 pb-3">
            {/* min-w-0 + truncate, because a long email is the thing that
                breaks a fixed-width sidebar. */}
            <p className="truncate text-[13px] font-semibold">
              {operator.name}
            </p>
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
