"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { api, authReady } from "@/lib/api";
import { inboxTime } from "@/lib/chatTime";
import { CHAT_UNREAD_CHANGED } from "@/lib/events";
import { apiMessage } from "@/lib/validation/apiError";

// A row as GET /chat/conversations sends it.
type Row = {
  id: string;
  name: string;
  avatar: string | null;
  title: string;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCount: number;
};

const initialsOf = (name: string) => {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "?";
};

// The API runs avatars through avatarPublicUrl, but a user who never uploaded
// one has null — and only a real URL is safe to put in an <img>.
const isUsableAvatar = (value: string | null) => !!value?.startsWith("http");

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-5 w-5"
  >
    <path d="M7 7l10 10M17 7 7 17" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <circle cx="11" cy="11" r="6" />
    <path d="m15.5 15.5 3.5 3.5" />
  </svg>
);

type Props = {
  open: boolean;
  onClose: () => void;
};

const ChatsDrawer = ({ open, onClose }: Props) => {
  const search = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Portals need a DOM to target, which does not exist during the server
  // render, so the first client render is what turns this on.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus into the panel on open, and back to whatever opened it on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    search.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  // Fetched on open rather than on mount: unread counts go stale the moment
  // the other person replies, so every opening asks again.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailure(null);
    const load = async () => {
      await authReady;
      try {
        const { data } = await api.get("/chat/conversations");
        if (!live) return;
        setRows(data.messages);
        // The drawer has just read the authoritative counts, so let the rail
        // badge re-read them too instead of drifting apart from this list.
        window.dispatchEvent(new Event(CHAT_UNREAD_CHANGED));
      } catch (error) {
        if (live) setFailure(apiMessage(error));
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [open]);

  // Nothing behind an open panel should scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Not rendered at all when closed. A hidden-but-present overlay is how a page
  // ends up with invisible things swallowing clicks.
  if (!mounted || !open) return null;

  // Filters what has already been fetched. A search that went to the server on
  // every keystroke would be a request per letter for a list of this size.
  const needle = query.trim().toLowerCase();
  const visible = (rows ?? []).filter(
    (row) =>
      !needle ||
      row.name.toLowerCase().includes(needle) ||
      row.title.toLowerCase().includes(needle),
  );

  return createPortal(
    // Portalled to <body> so no ancestor's transform, overflow or stacking
    // context can clip it or shrink it.
    <div className="fixed inset-0 z-[100] flex">
      {/* The scrim closes the panel from anywhere outside it, on every screen
          size — the close button should not be the only way out. */}
      <button
        type="button"
        aria-label="Close chats"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/40"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Chats"
        className="relative z-10 flex h-full w-full max-w-[420px] flex-col border-r border-line bg-panel shadow-[0_24px_60px_-28px_rgba(48,32,68,0.45)]"
      >
        {/* ---------- head ---------- */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <h2 className="flex-1 font-display text-[18px]">
            Chats
            {rows && (
              <span className="ml-2 text-[13px] font-normal text-muted tabular-nums">
                {rows.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chats"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ground px-3">
            <span className="shrink-0 text-muted">
              <SearchIcon />
            </span>
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats"
              className="min-h-10 w-full bg-transparent text-[16px] outline-none placeholder:text-muted sm:text-[15px]"
            />
          </div>
        </div>

        {/* ---------- the list ---------- */}
        {!rows && !failure && (
          <ul className="flex-1 space-y-1 px-2 py-3">
            {[0, 1, 2, 3].map((key) => (
              <li key={key} className="flex items-center gap-3 px-2 py-3">
                <span className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-accent-soft" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3.5 w-2/5 animate-pulse rounded bg-accent-soft" />
                  <span className="block h-3 w-3/5 animate-pulse rounded bg-accent-soft" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {failure && (
          <div className="flex-1 px-5 py-10 text-center">
            <p className="text-[14px] text-muted">{failure}</p>
          </div>
        )}

        {rows && rows.length === 0 && (
          <div className="flex-1 px-5 py-10 text-center">
            <p className="font-display text-[15px]">No chats yet</p>
            <p className="mt-1.5 text-[13.5px] text-muted">
              Open a property you like and press Chat now — the conversation
              will appear here.
            </p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-2 py-2">
            {visible.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/list/messages/${row.id}`}
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-accent-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {isUsableAvatar(row.avatar) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={row.avatar as string}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-white">
                      {initialsOf(row.name)}
                    </span>
                  )}

                  {/* min-w-0 is what lets the truncating lines below shrink: a
                      flex child defaults to min-width:auto and would push past
                      the panel instead of ellipsing. */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-muted tabular-nums">
                        {inboxTime(row.lastMessageAt)}
                      </span>
                    </span>

                    <span className="mt-0.5 block truncate text-[12.5px] text-accent">
                      {row.title}
                    </span>

                    <span className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${
                          row.unreadCount > 0
                            ? "font-medium text-ink"
                            : "text-muted"
                        }`}
                      >
                        {/* A thread exists before anyone speaks in it, so the
                            preview can legitimately be empty. */}
                        {row.lastMessageText || "No messages yet"}
                      </span>
                      {row.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
                          {row.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}

            {visible.length === 0 && (
              <li className="px-4 py-10 text-center text-[13.5px] text-muted">
                No chat matches “{query}”.
              </li>
            )}
          </ul>
        )}

      </aside>
    </div>,
    document.body,
  );
};

export default ChatsDrawer;
