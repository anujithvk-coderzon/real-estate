"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, setAccessToken } from "@/lib/api";

type User = { name: string; email: string };

/* ---------- icons (24px grid, drawn with the current text colour) ---------- */

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-5 w-5 shrink-0",
};

const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M5.5 9v10.5h13V9" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);

const ListingsIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M7.5 9.5h9M7.5 14.5h6" />
  </svg>
);

const AddIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

const LogoutIcon = () => (
  <svg {...iconProps}>
    <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
    <path d="M10 8 6 12l4 4M6 12h9" />
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg {...iconProps}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M9.5 4.5v15" />
    <path d={collapsed ? "m13.5 10 2 2-2 2" : "m15.5 10-2 2 2 2"} />
  </svg>
);

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/list/my/listings", label: "My listings", Icon: ListingsIcon },
  { href: "/list/create", label: "List a property", Icon: AddIcon },
];

// Faint survey-map contour lines behind the lower half of the panel.
const CONTOURS = [
  "M251.6 215.0 L251.9 217.0 L251.4 218.9 L250.2 220.6 L248.6 222.2 L247.0 223.6 L245.6 225.0 L244.3 226.5 L242.9 227.9 L241.1 229.1 L238.9 229.8 L236.5 229.9 L234.1 229.5 L232.0 229.0 L230.0 228.7 L228.1 228.8 L225.9 229.3 L223.6 229.7 L221.0 229.9 L218.5 229.6 L216.3 228.8 L214.3 227.5 L212.7 226.0 L211.4 224.3 L210.5 222.5 L210.2 220.6 L210.3 218.6 L210.9 216.7 L211.6 215.0 L212.2 213.4 L212.4 211.8 L212.4 210.1 L212.6 208.3 L213.2 206.5 L214.4 205.0 L216.0 203.8 L217.9 202.9 L219.8 202.0 L221.6 201.0 L223.3 199.7 L225.2 198.3 L227.5 197.2 L230.0 196.7 L232.5 197.0 L234.8 198.1 L236.8 199.5 L238.4 201.1 L239.8 202.5 L241.2 203.7 L242.6 204.9 L244.0 206.1 L245.3 207.3 L246.6 208.6 L247.9 210.0 L249.3 211.5 L250.7 213.1Z",
  "M276.3 215.0 L276.2 219.2 L274.6 223.1 L272.0 226.8 L268.9 230.0 L266.0 233.1 L263.3 236.3 L260.6 239.4 L257.2 242.3 L253.1 244.4 L248.2 245.3 L243.2 245.1 L238.4 244.3 L234.1 243.9 L230.0 244.3 L225.7 245.6 L220.8 247.3 L215.3 248.5 L209.8 248.6 L204.6 247.3 L200.3 244.8 L196.8 241.5 L194.1 237.9 L192.1 234.1 L190.6 230.2 L189.9 226.2 L189.9 222.3 L190.6 218.6 L191.3 215.0 L191.7 211.5 L191.7 208.0 L191.8 204.3 L192.4 200.5 L194.0 196.9 L196.9 193.9 L200.5 191.4 L204.2 189.2 L207.9 186.8 L211.3 184.0 L215.1 180.9 L219.5 178.0 L224.6 176.3 L230.0 176.3 L235.2 178.0 L239.7 181.0 L243.4 184.4 L246.6 187.4 L249.8 189.7 L253.3 191.6 L256.9 193.4 L260.6 195.5 L264.0 197.9 L267.2 200.7 L270.1 203.8 L272.8 207.2 L275.0 210.9Z",
  "M303.0 215.0 L302.2 221.5 L299.7 227.7 L295.8 233.4 L291.4 238.7 L287.1 243.7 L282.9 248.7 L278.2 253.5 L272.4 257.5 L265.4 260.0 L257.6 260.9 L250.0 260.7 L243.0 260.4 L236.5 261.2 L230.0 263.6 L222.7 267.0 L214.3 270.2 L205.2 271.6 L196.5 270.6 L189.1 267.1 L183.4 261.8 L179.0 255.8 L175.6 249.7 L172.6 243.8 L170.2 238.1 L168.4 232.2 L167.7 226.4 L167.7 220.6 L168.0 215.0 L168.1 209.4 L168.0 203.7 L168.4 197.7 L169.8 191.8 L172.8 186.3 L177.4 181.4 L182.7 177.2 L188.2 173.1 L193.5 168.6 L199.1 163.6 L205.4 158.7 L212.9 155.1 L221.4 153.9 L230.0 155.6 L237.8 159.7 L244.3 164.9 L249.8 169.7 L255.1 173.3 L260.9 175.6 L267.5 177.4 L274.5 179.4 L281.1 182.4 L286.9 186.4 L291.8 191.2 L295.9 196.6 L299.3 202.3 L301.8 208.5Z",
  "M331.5 215.0 L330.5 224.1 L327.0 232.7 L321.9 240.7 L316.0 248.2 L310.0 255.2 L303.6 261.9 L296.3 268.0 L287.6 272.8 L277.7 275.8 L267.4 277.1 L257.5 277.9 L248.4 279.6 L239.6 283.1 L230.0 288.3 L218.9 293.9 L206.4 297.6 L193.8 297.8 L182.4 294.0 L173.5 287.0 L166.9 278.3 L161.9 269.5 L157.2 261.4 L152.5 253.9 L148.0 246.6 L144.5 238.9 L142.3 231.0 L141.6 223.0 L141.5 215.0 L141.6 207.0 L141.8 198.9 L142.6 190.5 L144.9 182.2 L149.1 174.3 L155.0 167.2 L161.9 160.5 L169.1 153.9 L176.6 147.1 L185.0 140.2 L194.8 134.4 L206.1 131.4 L218.3 132.0 L230.0 136.3 L240.2 142.8 L248.7 149.4 L256.5 154.4 L264.9 157.1 L274.6 158.3 L285.4 159.5 L296.2 162.0 L305.8 166.6 L313.4 173.1 L319.2 180.6 L323.8 188.7 L327.6 197.2 L330.4 206.0Z",
  "M362.7 215.0 L361.4 226.8 L357.0 238.2 L350.1 248.6 L341.9 258.1 L333.3 266.9 L324.2 275.1 L314.2 282.4 L303.0 288.2 L290.8 292.4 L278.5 295.5 L266.7 298.9 L255.4 303.9 L243.5 311.0 L230.0 318.9 L214.5 325.4 L197.8 327.8 L182.0 324.8 L168.8 316.7 L158.9 305.5 L151.6 293.7 L145.1 282.9 L138.0 273.7 L130.2 265.2 L122.7 256.4 L116.8 246.7 L113.5 236.3 L112.5 225.6 L112.7 215.0 L113.0 204.5 L113.3 193.7 L114.1 182.6 L116.7 171.3 L121.6 160.5 L128.8 150.4 L137.4 141.0 L147.1 131.8 L157.8 123.0 L170.0 115.3 L184.1 110.1 L199.7 109.0 L215.5 112.2 L230.0 118.9 L242.4 126.7 L253.4 132.8 L264.5 136.0 L277.2 136.5 L291.9 136.2 L307.4 137.3 L321.9 141.5 L333.5 149.0 L341.9 158.7 L347.9 169.6 L352.8 180.6 L357.2 191.8 L360.9 203.2Z",
  "M397.1 215.0 L395.2 229.9 L388.7 244.0 L378.9 256.7 L367.5 268.0 L356.0 278.3 L344.5 288.0 L332.5 297.0 L319.7 305.0 L306.1 311.9 L292.3 318.4 L278.5 325.8 L264.2 334.8 L248.3 344.9 L230.0 354.0 L209.7 359.1 L189.2 357.9 L170.9 350.0 L156.5 337.1 L145.7 322.4 L136.7 308.6 L127.2 297.2 L116.1 287.7 L104.0 278.3 L93.1 267.7 L85.5 255.5 L82.0 242.0 L81.5 228.4 L82.1 215.0 L82.2 201.7 L81.6 187.9 L81.5 173.4 L83.7 158.6 L89.3 144.3 L98.2 130.9 L109.8 118.8 L123.3 108.0 L138.5 98.5 L155.6 91.4 L174.4 87.9 L194.1 89.1 L213.0 94.4 L230.0 102.0 L245.0 108.7 L259.3 112.3 L275.0 112.2 L293.1 110.1 L313.3 109.0 L333.1 111.6 L350.0 119.0 L362.4 130.5 L370.8 144.2 L376.9 158.4 L382.8 172.2 L389.1 186.0 L394.5 200.2Z",
  "M434.5 215.0 L430.4 233.1 L420.2 249.7 L406.3 264.3 L391.6 277.3 L378.0 289.4 L365.5 301.4 L353.2 313.6 L340.0 325.4 L325.6 336.7 L309.9 347.8 L293.1 359.3 L274.6 371.4 L253.6 382.5 L230.0 390.3 L205.1 391.7 L181.4 385.3 L161.2 372.2 L145.5 355.4 L132.8 338.8 L120.5 324.9 L106.3 314.0 L89.9 304.4 L73.3 293.8 L59.9 280.5 L51.8 264.9 L49.0 248.0 L49.3 231.3 L49.5 215.0 L47.9 198.6 L44.9 181.2 L42.9 162.6 L44.7 143.6 L52.0 125.5 L64.5 109.4 L81.0 95.8 L100.0 84.6 L120.7 75.9 L142.9 70.3 L166.0 68.6 L188.9 71.1 L210.5 76.5 L230.0 82.3 L248.2 85.6 L267.1 85.0 L288.4 81.5 L312.5 77.9 L337.6 78.0 L360.5 84.0 L378.5 96.2 L390.9 112.4 L399.3 129.9 L406.7 146.9 L415.2 163.2 L424.4 179.5 L431.9 196.8Z",
];

const ContourArt = () => (
  <svg
    viewBox="0 0 300 320"
    aria-hidden="true"
    className="pointer-events-none absolute -bottom-16 -right-24 -z-10 hidden h-[420px] w-[400px] text-line lg:block"
  >
    {CONTOURS.map((d, index) => (
      <path key={index} d={d} fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.6 - index * 0.06} />
    ))}
  </svg>
);

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const Sidebar = () => {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false); // phones
  const [collapsed, setCollapsed] = useState(false); // desktop
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => {
        // The sidebar still works without the name.
      });
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
    } finally {
      // Leave this browser signed out even if the request failed.
      setAccessToken(null);
      // A full load, not router.push: it clears everything this tab remembered
      // about the user, and works even when logging out from the home page itself.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full reload is intended
      window.location.assign("/");
    }
  };

  // Labels disappear on desktop when collapsed, but stay on phones.
  const hideWhenCollapsed = collapsed ? "lg:hidden" : "";

  return (
    <aside
      className={`relative isolate overflow-hidden border-b border-line bg-panel text-ink lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col lg:transition-[width] lg:duration-200 motion-reduce:transition-none ${
        collapsed ? "lg:w-[76px]" : "lg:w-60"
      }`}
    >
      <ContourArt />

      {/* ---------- user ---------- */}
      <div className={`flex items-center gap-3 px-4 py-4 lg:pb-7 lg:pt-7 ${collapsed ? "lg:justify-center lg:px-0" : "lg:px-5"}`}>
        <span
          title={collapsed ? user?.name : undefined}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold tracking-wide text-white"
        >
          {user ? initialsOf(user.name) : ""}
        </span>

        <div className={`min-w-0 flex-1 ${hideWhenCollapsed}`}>
          {user ? (
            <>
              <p className="truncate font-display text-[19px] leading-tight">{user.name}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted">{user.email}</p>
            </>
          ) : (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-4 w-28 animate-pulse rounded bg-accent-soft" />
              <div className="h-3 w-36 animate-pulse rounded bg-accent-soft" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="sidebar-menu"
          className={`rounded-lg border border-line px-3 py-1.5 text-[14px] font-medium lg:hidden ${focusRing}`}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div id="sidebar-menu" className={`${menuOpen ? "flex" : "hidden"} flex-1 flex-col px-3 pb-4 lg:flex`}>
        {/* ---------- navigation ---------- */}
        <nav aria-label="Main">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              // "/" is the start of every path, so Home only matches exactly.
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? label : undefined}
                    title={collapsed ? label : undefined}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${focusRing} ${
                      collapsed ? "lg:justify-center" : ""
                    } ${active ? "bg-accent-soft text-ink" : "text-muted hover:bg-accent-soft/60 hover:text-ink"}`}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />
                    )}
                    <span className={active ? "text-accent" : ""}>
                      <Icon />
                    </span>
                    <span className={hideWhenCollapsed}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ---------- bottom ---------- */}
        <div className="mt-6 space-y-1 border-t border-line pt-3 lg:mt-auto">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label={collapsed ? "Log out" : undefined}
            title={collapsed ? "Log out" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted transition-colors hover:bg-accent-soft/60 hover:text-danger disabled:opacity-60 ${focusRing} ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <LogoutIcon />
            <span className={hideWhenCollapsed}>{loggingOut ? "Logging out…" : "Log out"}</span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-muted transition-colors hover:bg-accent-soft/60 hover:text-ink lg:flex ${focusRing} ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <CollapseIcon collapsed={collapsed} />
            <span className={hideWhenCollapsed}>Collapse</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
