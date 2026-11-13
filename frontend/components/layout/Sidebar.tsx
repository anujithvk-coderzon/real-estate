"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { usePathname } from "next/navigation";
import ContourArt from "@/components/ContourArt";
import ChatsDrawer from "@/components/layout/ChatsDrawer";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import { api, authReady, getAccessToken, setAccessToken } from "@/lib/api";
import {
  CHAT_UNREAD_CHANGED,
  NOTIFICATIONS_READ,
  PROFILE_UPDATED,
} from "@/lib/events";
import type { AuthUser } from "@/lib/types";

// accountType joins the three the panel shows, because one nav item is
// builders-only and /auth/me already sends it; notificationsCount is what the
// bell's badge starts from.
type User = Pick<
  AuthUser,
  "name" | "email" | "avatarUrl" | "accountType" | "notificationsCount"
>;

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

const ProfileIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5" />
  </svg>
);

const ListingsIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M7.5 9.5h9M7.5 14.5h6" />
  </svg>
);

const ChatsIcon = () => (
  <svg {...iconProps}>
    <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4.5 3.5Z" />
    <path d="M8.5 8.5h7M8.5 11.5h4" />
  </svg>
);

const PromotionsIcon = () => (
  <svg {...iconProps}>
    <path d="M4.5 10.5 14 6.5v11l-9.5-4Z" />
    <path d="M4.5 10.5H4a1.5 1.5 0 0 0 0 3h.5M14 8.5c2 .6 3.5 1.8 3.5 3.5s-1.5 2.9-3.5 3.5M7.5 14v4.5" />
  </svg>
);

const AddIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

const SettingsIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
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

const BellIcon = () => (
  <svg {...iconProps}>
    <path d="M12 4.5a5 5 0 0 0-5 5v3l-1.5 3h13L17 12.5v-3a5 5 0 0 0-5-5Z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </svg>
);

const ProjectsIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="9.5" width="7" height="10" rx="1.5" />
    <rect x="13.5" y="4.5" width="7" height="15" rx="1.5" />
    <path d="M6 13h2M6 16h2M16 8h2M16 11h2M16 14h2" />
  </svg>
);

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/list/my/profile", label: "My profile", Icon: ProfileIcon },
  { href: "/list/my/listings", label: "My listings", Icon: ListingsIcon },
  // Builders only. A plain seller has no projects, and a nav item that leads
  // to a page which can only ever say "none" is worse than no nav item — so
  // this one waits for /auth/me to say who is looking.
  {
    href: "/list/my/projects",
    label: "Projects",
    Icon: ProjectsIcon,
    builderOnly: true,
  },
  // Beside the listings it is about, not down with the account links: a seller
  // reaches for this while thinking about their properties.
  { href: "/list/promotions", label: "Promotions", Icon: PromotionsIcon },
  { href: "/list/create", label: "List a property", Icon: AddIcon },
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [unread, setUnread] = useState(0); // phones
  // Kept apart from `user` so reading them can empty the badge without
  // touching the name and avatar the panel is also drawn from.
  const [alerts, setAlerts] = useState(0);
  const [collapsed, setCollapsed] = useState(false); // desktop
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false); // falls back to initials
  const still = useReducedMotion();

  useEffect(() => {
    const loadUser = () =>
      api
        .get("/auth/me")
        .then((response) => {
          setUser(response.data.user);
          setAlerts(response.data.user.notificationsCount ?? 0);
        })
        .catch(() => {
          // The sidebar still works without the name.
        });
    loadUser();
    // Settings fires this after the name is edited, so the sidebar shows the new one.
    window.addEventListener(PROFILE_UPDATED, loadUser);
    return () => window.removeEventListener(PROFILE_UPDATED, loadUser);
  }, []);

  // The panel's GET marks everything read, so the badge is emptied here rather
  // than by asking /auth/me what it already knows the answer to.
  useEffect(() => {
    const clear = () => setAlerts(0);
    window.addEventListener(NOTIFICATIONS_READ, clear);
    return () => window.removeEventListener(NOTIFICATIONS_READ, clear);
  }, []);

  useEffect(() => {
    let live = true;
    const loadUnread = async () => {
      // Without this the request can leave before the refresh token has been
      // exchanged, and the badge silently stays at zero.
      await authReady;
      try {
        const { data } = await api.get("/chat/conversation/unread");
        if (live) setUnread(data.count);
      } catch {}
    };
    loadUnread();
    window.addEventListener(CHAT_UNREAD_CHANGED, loadUnread);
    return () => {
      live = false;
      window.removeEventListener(CHAT_UNREAD_CHANGED, loadUnread);
    };
  }, [pathname]);

  // A socket for the badge. The Sidebar is on every page, so this is what keeps
  // the count live when the user is nowhere near a chat page.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!url) return;

    const socket = new WebSocket(url);
    socket.onopen = async () => {
      await authReady;
      const token = getAccessToken();
      if (!token) return socket.close(); // signed out, nothing to count
      socket.send(JSON.stringify({ type: "login", token }));
    };

    socket.onmessage = (frame) => {
      const event = JSON.parse(frame.data);
      if (event.type === "message" || event.type === "read") {
        window.dispatchEvent(new Event(CHAT_UNREAD_CHANGED));
      }
    };

    return () => socket.close();
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

  // One sidebar link, highlighted when its page is open. Used by the main list and by Settings.
  const navLink = ({
    href,
    label,
    Icon,
  }: {
    href: string;
    label: string;
    Icon: () => React.ReactNode;
  }) => {
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
            <motion.span
              aria-hidden="true"
              layoutId="sidebar-active"
              transition={
                still
                  ? { duration: 0 }
                  : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
              }
              className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent"
            />
          )}
          <span className={active ? "text-accent" : ""}>
            <Icon />
          </span>
          <span className={hideWhenCollapsed}>{label}</span>
        </Link>
      </li>
    );
  };

  // Chats opens a panel, not a page, so it cannot be a Link — but it has to
  // look identical to the links above it.
  const chatsButton = (
    <li>
      <button
        type="button"
        onClick={() => {
          setChatsOpen(true);
          setMenuOpen(false);
        }}
        aria-haspopup="dialog"
        aria-expanded={chatsOpen}
        aria-label={collapsed ? "Chats" : undefined}
        title={collapsed ? "Chats" : undefined}
        // text-left because a <button> centres its text by default, while the
        // <a> elements above it inherit left — the label would not line up.
        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${focusRing} ${
          collapsed ? "lg:justify-center" : ""
        } ${chatsOpen ? "bg-accent-soft text-ink" : "text-muted hover:bg-accent-soft/60 hover:text-ink"}`}
      >
        <span className={chatsOpen ? "text-accent" : ""}>
          <ChatsIcon />
        </span>
        <span className={`flex-1 ${hideWhenCollapsed}`}>Chats</span>
        {unread > 0 && (
          <span
            aria-label={`${unread} unread`}
            // Collapsed, there is no room for a number and no label to sit
            // beside, so it becomes a dot on the icon's corner.
            className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums ${
              collapsed
                ? "lg:absolute lg:right-2 lg:top-2 lg:h-2.5 lg:min-w-2.5 lg:px-0 lg:text-transparent"
                : ""
            }`}
          >
            {/* Three digits change the pill's width and shove the row around. */}
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </li>
  );

  // Same shape as the chats button, for the same reason: it opens a panel, not
  // a page, so it cannot be a Link.
  const alertsButton = (
    <li>
      <button
        type="button"
        onClick={() => {
          setAlertsOpen(true);
          setMenuOpen(false);
        }}
        aria-haspopup="dialog"
        aria-expanded={alertsOpen}
        aria-label={collapsed ? "Notifications" : undefined}
        title={collapsed ? "Notifications" : undefined}
        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${focusRing} ${
          collapsed ? "lg:justify-center" : ""
        } ${alertsOpen ? "bg-accent-soft text-ink" : "text-muted hover:bg-accent-soft/60 hover:text-ink"}`}
      >
        <span className={alertsOpen ? "text-accent" : ""}>
          <BellIcon />
        </span>
        <span className={`flex-1 ${hideWhenCollapsed}`}>Notifications</span>
        {alerts > 0 && (
          <span
            aria-label={`${alerts} unread`}
            className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums ${
              collapsed
                ? "lg:absolute lg:right-2 lg:top-2 lg:h-2.5 lg:min-w-2.5 lg:px-0 lg:text-transparent"
                : ""
            }`}
          >
            {alerts > 99 ? "99+" : alerts}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <>
      <aside
        className={`relative isolate overflow-hidden border-b border-line bg-panel text-ink lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col lg:transition-[width] lg:duration-200 motion-reduce:transition-none ${
          collapsed ? "lg:w-[76px]" : "lg:w-60"
        }`}
      >
        {/* Bottom-right of the panel and bleeding past both edges, so the
            rings read as a fragment of a larger drawing. Desktop only: there
            is no spare room beside the nav on a phone. */}
        <ContourArt className="pointer-events-none absolute -bottom-16 -right-24 -z-10 hidden h-[420px] w-[400px] text-line lg:block" />

        {/* ---------- brand ----------
            The signed-in app had no mark at all: the panel opened straight
            into whoever was signed in. Brand on top, identity under it, is the
            order the admin panel already uses. Collapsed, the pin stays and
            the word goes — a 76px rail has room for one of them. */}
        <div
          className={`flex items-center border-b border-line px-4 py-3.5 ${collapsed ? "lg:justify-center lg:px-0" : "lg:px-5"}`}
        >
          <Logo markClass="h-7 w-7" textClass={`text-[19px] ${hideWhenCollapsed}`} />
        </div>

        {/* ---------- user ---------- */}
        <div
          className={`flex items-center gap-3 px-4 py-4 lg:pb-7 lg:pt-5 ${collapsed ? "lg:justify-center lg:px-0" : "lg:px-5"}`}
        >
          <span
            title={collapsed ? user?.name : undefined}
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-[15px] font-semibold tracking-wide text-white"
          >
            {user?.avatarUrl && !avatarFailed ? (
              // Google profile photos refuse requests that send a Referer, hence no-referrer.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              user && initialsOf(user.name)
            )}
          </span>

          <div className={`min-w-0 flex-1 ${hideWhenCollapsed}`}>
            {user ? (
              <>
                <p className="truncate font-display text-[19px] leading-tight">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-muted">
                  {user.email}
                </p>
              </>
            ) : (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-4 w-28 animate-pulse rounded bg-accent-soft" />
                <div className="h-3 w-36 animate-pulse rounded bg-accent-soft" />
              </div>
            )}
          </div>

          {/* On phones the nav lives behind "Menu", which would hide the unread
            badge behind a tap. Messaging is the one thing that has to announce
            itself, so it gets its own always-visible trigger up here. */}
          <button
            type="button"
            onClick={() => {
              setChatsOpen(true);
              setMenuOpen(false);
            }}
            aria-haspopup="dialog"
            aria-expanded={chatsOpen}
            aria-label={unread > 0 ? `Chats, ${unread} unread` : "Chats"}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted lg:hidden ${focusRing}`}
          >
            <ChatsIcon />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Unlike chats, this one appears only when it has something to
            report. An always-present third button costs the name and email
            beside it room they need on a 360px screen, and an empty bell is
            reachable through Menu anyway. */}
          {alerts > 0 && (
            <button
              type="button"
              onClick={() => {
                setAlertsOpen(true);
                setMenuOpen(false);
              }}
              aria-haspopup="dialog"
              aria-expanded={alertsOpen}
              aria-label={`Notifications, ${alerts} unread`}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted lg:hidden ${focusRing}`}
            >
              <BellIcon />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
                {alerts > 9 ? "9+" : alerts}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="sidebar-menu"
            className={`min-h-11 rounded-lg border border-line px-3.5 py-2.5 text-[14px] font-medium lg:hidden ${focusRing}`}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>

        <div
          id="sidebar-menu"
          className={`${menuOpen ? "nav-open flex" : "hidden"} flex-1 flex-col px-3 pb-4 lg:flex`}
        >
          {/* ---------- navigation ---------- */}
          <nav aria-label="Main">
            <ul className="space-y-1">
              {NAV_ITEMS.filter(
                (item) =>
                  !("builderOnly" in item) || user?.accountType === "BUILDER",
              ).map((item) => navLink(item))}
              {chatsButton}
              {alertsButton}
            </ul>
          </nav>

          {/* ---------- bottom ---------- */}
          <div className="mt-6 space-y-1 border-t border-line pt-3 lg:mt-auto">
            {/* Account things live at the bottom, apart from the everyday links above. */}
            <ul>
              {navLink({
                href: "/list/settings",
                label: "Settings",
                Icon: SettingsIcon,
              })}
            </ul>

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
              <span className={hideWhenCollapsed}>
                {loggingOut ? "Logging out…" : "Log out"}
              </span>
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

      {/* A sibling of the rail, not a child: the panel is fixed to the viewport,
        and nesting it inside the rail would tie it to the rail's own box. */}
      <ChatsDrawer open={chatsOpen} onClose={() => setChatsOpen(false)} />
      <NotificationsDrawer
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
      />
    </>
  );
};

export default Sidebar;
