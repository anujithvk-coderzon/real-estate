"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, authReady } from "@/lib/api";
import { inboxTime } from "@/lib/chatTime";
import { NOTIFICATIONS_READ } from "@/lib/events";
import { apiMessage } from "@/lib/validation/apiError";
import type { Notification } from "@/lib/types";

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

type Props = {
  open: boolean;
  onClose: () => void;
};

const NotificationsDrawer = ({ open, onClose }: Props) => {
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus back to whatever opened it on close. There is nothing to type in
  // here, so unlike the chats panel nothing is focused on the way in.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, [open]);

  // Fetched on every opening, not once on mount: the whole point of the badge
  // is that something arrived since the last look.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const load = async () => {
      // Also where the last failure is cleared: setState in the body of an
      // effect is what React's set-state-in-effect rule is about, and after
      // this await we are in a callback rather than the effect itself.
      await authReady;
      if (!live) return;
      setFailure(null);
      try {
        const { data } = await api.get("/auth/notifications");
        if (!live) return;
        setRows(data.notifications);
        // GET marks them all read server-side, so the rail badge is now stale
        // by definition. This is what empties it without a second request.
        window.dispatchEvent(new Event(NOTIFICATIONS_READ));
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
  // ends up with invisible things swallowing clicks — and since `open` only
  // ever becomes true from a click, the document the portal needs always
  // exists by then. The guard keeps a server render honest regardless.
  if (!open || typeof document === "undefined") return null;

  // The rows were read before the server marked them read — findMany runs
  // ahead of updateMany inside the transaction — so this one viewing can still
  // show which ones are new. The next opening will show them all as seen.
  const fresh = (rows ?? []).filter((row) => !row.isRead).length;

  return createPortal(
    // Portalled to <body> so no ancestor's transform, overflow or stacking
    // context can clip it or shrink it.
    <div className="fixed inset-0 z-[100] flex">
      {/* The scrim closes the panel from anywhere outside it, on every screen
          size — the close button should not be the only way out. */}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/40"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="relative z-10 flex h-full w-full max-w-[420px] flex-col border-r border-line bg-panel shadow-[0_24px_60px_-28px_rgba(48,32,68,0.45)]"
      >
        {/* ---------- head ---------- */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <h2 className="flex-1 font-display text-[18px]">
            Notifications
            {/* Total in muted, new in accent. The total comes from the list
                itself rather than from the server, because by the time this
                renders the whole list is already here — the only count worth
                a round trip is the one the badge needs before the list is
                fetched at all. */}
            {rows && rows.length > 0 && (
              <span className="ml-2 text-[13px] font-normal text-muted tabular-nums">
                {rows.length}
                {fresh > 0 && (
                  <span className="text-accent"> · {fresh} new</span>
                )}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ---------- the list ---------- */}
        {!rows && !failure && (
          <ul className="flex-1 space-y-1 px-2 py-3">
            {[0, 1, 2].map((key) => (
              <li key={key} className="space-y-2 px-3 py-3">
                <span className="block h-3.5 w-2/5 animate-pulse rounded bg-accent-soft" />
                <span className="block h-3 w-4/5 animate-pulse rounded bg-accent-soft" />
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
            <p className="font-display text-[15px]">Nothing yet</p>
            <p className="mt-1.5 text-[13.5px] text-muted">
              Updates about your account and your properties will show up here.
            </p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-2 py-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex gap-3 rounded-xl px-3 py-3.5 ${
                  row.isRead ? "" : "bg-accent-soft/40"
                }`}
              >
                {/* A dot, not a badge: there is one notification per row, so a
                    number would always read "1". */}
                <span
                  aria-hidden={row.isRead ? true : undefined}
                  aria-label={row.isRead ? undefined : "New"}
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    row.isRead ? "bg-transparent" : "bg-accent"
                  }`}
                />

                {/* min-w-0 is what lets the line below truncate: a flex child
                    defaults to min-width:auto and would push past the panel. */}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 text-[14.5px] font-medium text-ink">
                      {row.title}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-muted tabular-nums">
                      {inboxTime(row.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
                    {row.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>,
    document.body,
  );
};

export default NotificationsDrawer;
