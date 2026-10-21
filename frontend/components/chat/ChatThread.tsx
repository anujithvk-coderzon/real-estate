"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, authReady } from "@/lib/api";
import { clockTime, dayLabel } from "@/lib/chatTime";
import { CHAT_UNREAD_CHANGED } from "@/lib/events";
import { formatRupeesShort } from "@/lib/format";
import { errorToast } from "@/lib/toast";
import { apiMessage } from "@/lib/validation/apiError";

/* ---------------- hardcoded, until the API is wired in ---------------- */

// GET /chat/conversation/:id answers with this shape.
type ChatHeader = {
  listing: { slug: string | null; title: string; price: string };
  user?: { name?: string | null; avatarUrl?: string | null };
  type?: string;
};

// Defensive on purpose: a header that arrives without a name should leave the
// avatar blank, not blank the whole page.
const initialsOf = (name: string | null | undefined) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

// The API sends avatarUrl straight from the database, which is a storage key on
// accounts that uploaded a picture. Only a real URL is safe to put in an <img>.
const isUsableAvatar = (value: string | null | undefined) =>
  !!value?.startsWith("http");

// The input grows to here, then scrolls instead of pushing the thread away.
const MAX_INPUT_HEIGHT = 120;

// A row as /chat/conversation/:id/messages sends it.
type Message = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

/* ---------------------------------- icons ---------------------------------- */

const BackIcon = () => (
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
    <path d="M14 7l-5 5 5 5" />
  </svg>
);

const SendIcon = () => (
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
    <path d="M4.5 12 20 4.5 15.5 20 12 13.5Z" />
    <path d="M12 13.5 4.5 12" />
  </svg>
);

/* --------------------------------- screen --------------------------------- */

const ChatThread = ({ id }: { id: string }) => {
  const [header, setHeader] = useState<ChatHeader | null>(null);
  const [headerFailure, setHeaderFailure] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      // Without this the request can leave before the refresh token has been
      // exchanged, and a signed-in user gets a 401 on their own conversation.
      await authReady;
      try {
        // Three requests, one wait. The messages do not depend on the header,
        // so running them in series would only make the screen slower.
        const [header, thread, me] = await Promise.all([
          api.get(`/chat/conversation/${id}`),
          api.get(`/chat/conversation/${id}/messages`),
          api.get("/auth/me"),
        ]);
        if (!live) return;
        setHeader(header.data.header);
        setMessages(thread.data.messages);
        // Needed to tell your own bubbles from theirs: the rows carry senderId,
        // and nothing else on this page knows who you are.
        setMeId(me.data.user.id);
        // Having the thread on screen is what "read" means. Fire and forget on
        // purpose: a failed mark-read leaves a stale badge, which is not worth
        // an error in front of someone who is reading their messages.
        api
          .post(`/chat/conversation/${id}/read`)
          .then(() => window.dispatchEvent(new Event(CHAT_UNREAD_CHANGED)))
          .catch(() => {});
      } catch (error) {
        if (live) setHeaderFailure(apiMessage(error));
      } finally {
        if (live) setLoadingThread(false);
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [id]);

  // The newest message is at the bottom, so that is where the thread opens and
  // where it returns after every send.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/chat/conversation/${id}/message`, {
        body,
      });
      // The row the server stored, not a local copy of what was typed: the id
      // and the time are the real ones.
      setMessages((previous) => [...previous, data.data]);
      setDraft("");
      if (input.current) {
        input.current.style.height = "auto";
        input.current.style.overflowY = "hidden";
      }
    } catch (error) {
      // The draft stays in the box. A failed send must not eat what was typed.
      errorToast(apiMessage(error));
    } finally {
      setSending(false);
    }
  };

  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    const height = Math.min(element.scrollHeight, MAX_INPUT_HEIGHT);
    element.style.height = `${height}px`;
    element.style.overflowY =
      element.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col">
      {/* ---------- header: who, and about what ---------- */}
      <header className="sticky top-0 z-10 border-b border-line bg-panel/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
          <Link
            // Back belongs to the listing this conversation is about, not the
            // home page. Until the header arrives the slug is unknown, so home
            // is the fallback rather than a dead link.
            href={
              header?.listing?.slug
                ? `/property/${header.listing.slug}`
                : "/"
            }
            aria-label="Back to the property"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BackIcon />
          </Link>

          {header ? (
            isUsableAvatar(header.user?.avatarUrl) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={header.user?.avatarUrl as string}
                alt=""
                className="h-11 w-11 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-white">
                {initialsOf(header.user?.name)}
              </span>
            )
          ) : (
            <span className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-accent-soft" />
          )}

          <div className="min-w-0 flex-1">
            {header ? (
              <>
                <p className="truncate font-display text-[16px] leading-tight">
                  {header.user?.name ?? "Unknown"}
                </p>
                <p className="truncate text-[12.5px] text-muted">
                  {header.type}
                </p>
              </>
            ) : (
              <>
                <p className="h-4 w-32 animate-pulse rounded bg-accent-soft" />
                <p className="mt-1.5 h-3 w-16 animate-pulse rounded bg-accent-soft" />
              </>
            )}
          </div>
        </div>

        {/* The listing the conversation is about. Without it, two threads from
            the same seller are indistinguishable. */}
        {header && (
          <Link
            href={header.listing.slug ? `/property/${header.listing.slug}` : "#"}
            className="flex items-center gap-2 border-t border-line bg-accent-soft/50 px-3 py-2 text-[13px] hover:bg-accent-soft sm:px-4"
          >
            <span className="min-w-0 flex-1 truncate text-muted">
              {header.listing.title}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatRupeesShort(header.listing.price)}
            </span>
          </Link>
        )}

        {headerFailure && (
          <p className="border-t border-line bg-accent-soft/50 px-3 py-2 text-[13px] text-danger sm:px-4">
            {headerFailure}
          </p>
        )}
      </header>

      {/* ---------- the thread ---------- */}
      <div className="flex flex-1 flex-col gap-2 px-3 py-4 sm:px-4">
        {loadingThread && (
          <>
            <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-accent-soft" />
            <div className="ml-auto h-10 w-2/5 animate-pulse rounded-2xl bg-accent-soft" />
            <div className="h-10 w-1/2 animate-pulse rounded-2xl bg-accent-soft" />
          </>
        )}

        {!loadingThread && messages.length === 0 && (
          <p className="py-10 text-center text-[14px] text-muted">
            No messages yet. Say hello — ask about the price, the location or a
            visit.
          </p>
        )}

        {messages.map((message, index) => {
          const mine = message.senderId === meId;
          const previous = messages[index - 1];
          // A date divider only where the day actually changes.
          const newDay =
            !previous ||
            new Date(previous.createdAt).toDateString() !==
              new Date(message.createdAt).toDateString();

          return (
            <div key={message.id}>
              {newDay && (
                <p className="py-2 text-center text-[12px] text-muted">
                  {dayLabel(message.createdAt)}
                </p>
              )}
              <div
                className={mine ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2 text-[15px] leading-6 ${
                    mine
                      ? "rounded-2xl rounded-br-md bg-accent text-white"
                      : "rounded-2xl rounded-bl-md bg-panel text-ink ring-1 ring-line"
                  }`}
                >
                  {/* Addresses and links get pasted in without spaces; without
                      break-words they widen the bubble past the screen. */}
                  <p className="whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <p
                    className={`mt-1 text-right text-[11px] tabular-nums ${
                      mine ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {clockTime(message.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* ---------- composer ---------- */}
      <div className="sticky bottom-0 border-t border-line bg-panel/95 px-3 py-3 backdrop-blur sm:px-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            value={draft}
            rows={1}
            onChange={(event) => {
              setDraft(event.target.value);
              grow(event.target);
            }}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line — the convention every
              // chat app shares, so nobody has to be told.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={
              header?.user?.name
                ? `Message ${header.user.name.split(" ")[0]}`
                : "Message"
            }
            maxLength={4000}
            className="max-h-[120px] min-h-11 w-full resize-none overflow-hidden rounded-xl border border-line bg-ground px-3.5 py-2.5 text-[16px] leading-6 outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-[15px]"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || draft.trim().length === 0}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatThread;
