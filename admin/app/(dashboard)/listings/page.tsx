"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ApprovalDecision, {
  type Decision,
  type DecisionSubject,
} from "@/components/ApprovalDecision";
import { apiMessage, focusable, goodButton, onDate } from "@/lib/ui";

type Pending = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  listingType: string;
  propertyType: string;
  postedBy: string;
  price: string;
  areaValue: string;
  areaUnit: string;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: string | null;
  propertyStatus: string | null;
  addressLine: string;
  landmark: string | null;
  locality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  listingImages: {
    id: string;
    path: string;
    position: number;
    approved: boolean;
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  listingVideo: {
    id: string;
    url: string;
    approved: boolean;
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  amenities: { name: string; category: string }[];
  owner: {
    id: string;
    name: string;
    email: string;
    slug: string | null;
    avatarUrl: string | null;
    accountType: string | null;
    agentReraNumber: string | null;
    agentReraStatus: string | null;
  };
  project: {
    name: string;
    slug: string | null;
    reraNumber: string | null;
    reraStatus: string | null;
    isReraExempt: boolean | null;
  } | null;
};

const TABS = [
  { key: "LIVE", label: "Live, photos hidden" },
  { key: "DRAFTS", label: "Drafts" },
  { key: "REJECTED", label: "Sent back" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type Result =
  | { key: string; rows: Pending[] }
  | { key: string; error: true };

const rupees = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString("en-IN")}`
    : `₹${value}`;
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const waiting = (since: string) => {
  const days = Math.floor((Date.now() - +new Date(since)) / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor((Date.now() - +new Date(since)) / 3_600_000);
  return hours >= 1 ? `${hours} hour${hours === 1 ? "" : "s"}` : "under an hour";
};

const photoAction =
  ` disabled:opacity-40 sm:w-auto ${focusable}`;

const PHONE_IN_TEXT = /(?:\+?91)?[6-9]\d{9}/;
const LINK_IN_TEXT = /(https?:\/\/|www\.)/i;
const textFlags = (description: string) => {
  const compact = description.replace(/[\s\-()]/g, "");
  return {
    phone: PHONE_IN_TEXT.test(compact),
    link: LINK_IN_TEXT.test(description),
  };
};

const decisionSubject = (listing: Pending) => ({
  listingId: listing.id,
  title: listing.title,
  live: listing.status !== "DRAFT",
  pendingImages: listing.listingImages.filter(
    (image) => !image.approved && !image.reviewNote,
  ).length,
  pendingVideo:
    listing.listingVideo !== null &&
    !listing.listingVideo.approved &&
    !listing.listingVideo.reviewNote,
});

const Page = () => {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("tab");
  const initial = TABS.some((t) => t.key === fromUrl)
    ? (fromUrl as TabKey)
    : "LIVE";
  const [tab, setTab] = useState<TabKey>(initial);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [asking, setAsking] = useState<{
    decision: Decision;
    subject: DecisionSubject;
  } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [openMedia, setOpenMedia] = useState<
    Record<string, "photos" | "video" | undefined>
  >({});
  const [counts, setCounts] = useState<{
    live: number;
    drafts: number;
    sentBack: number;
  } | null>(null);

  const readCounts = useCallback(() => {
    api
      .get("/admin/listing/approvals/count")
      .then(({ data }) => setCounts(data?.counts ?? null))
      .catch(() => {
      });
  }, []);

  const key = `${tab}:${attempt}`;

  useEffect(() => {
    let live = true;
    api.get("/admin/listing/approvals", { params: { queue: tab } }).then(
      ({ data }) => {
        if (!live) return;
        setResult({ key: `${tab}:${attempt}`, rows: data.listings ?? [] });
      },
      (error) => {
        if (live) {
          setResult({ key: `${tab}:${attempt}`, error: true });
          console.error(apiMessage(error, "Could not load the queue"));
        }
      },
    );
    return () => {
      live = false;
    };
  }, [tab, attempt]);

  useEffect(readCounts, [readCounts]);

  const decide = async (note: string) => {
    if (!asking) return;
    const from = key;
    const { decision, subject } = asking;
    setWorking(subject.listingId);
    setFailure(null);
    try {
      const { data } =
        decision === "APPROVE"
          ? subject.target
            ? await api.patch(
                `/admin/listing/media/allow/${subject.target.kind}/${subject.target.id}`,
              )
            : await api.patch(
                `/admin/listing/media/approve/${subject.listingId}`,
              )
          : await api.patch(
              `/admin/listing/media/reject/${subject.target!.kind}/${subject.target!.id}`,
              { note },
            );
      setAsking(null);
      setNotice({ ok: true, text: data.message ?? "Done" });
      readCounts();
      if (decision === "APPROVE" && !subject.target) {
        setResult((state) =>
          state && "rows" in state && state.key === from
            ? {
                ...state,
                rows: state.rows.filter((row) => row.id !== subject.listingId),
              }
            : state,
        );
      } else {
        setResult((state) =>
          state && "rows" in state && state.key === from
            ? {
                ...state,
                rows: state.rows.map((row) =>
                  row.id !== subject.listingId
                    ? row
                    : {
                        ...row,
                        listingImages: row.listingImages.map((image) =>
                          image.id === subject.target!.id
                            ? { ...image, reviewNote: note }
                            : image,
                        ),
                        listingVideo:
                          row.listingVideo &&
                          row.listingVideo.id === subject.target!.id
                            ? { ...row.listingVideo, reviewNote: note }
                            : row.listingVideo,
                      },
                ),
              }
            : state,
        );
      }
    } catch (error) {
      setFailure(apiMessage(error, "Could not save that"));
    } finally {
      setWorking(null);
    }
  };

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && "error" in current;
  const rows = current && "rows" in current ? current.rows : null;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
        Photo approvals
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
        Sellers publish their own listings; what waits here are the photographs
        and videos. Approving shows them to buyers — it does not publish
        anything, and sending one back hides nothing that is already showing.
      </p>

      <div className="mt-4 max-w-2xl rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
        <p className="text-[13.5px] font-medium">
          The first tab is somebody&rsquo;s live listing with no picture on it.
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Clear those first; the drafts are not costing anyone anything. What
          you are
          looking for is a screenshot lifted from another site, a watermark, or
          a phone number painted across the picture — all of it on the card,
          nothing to click through to.
        </p>
      </div>

      <div className="mt-6 -mx-4 flex gap-1.5 overflow-x-auto border-b border-line px-4 pb-px sm:mx-0 sm:px-0">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key);
                setNotice(null);
                router.replace(`/listings?tab=${item.key}`, { scroll: false });
              }}
              aria-current={active ? "true" : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
              {(() => {
                const n = counts
                  ? item.key === "LIVE"
                    ? counts.live
                    : item.key === "DRAFTS"
                      ? counts.drafts
                      : counts.sentBack
                  : null;
                return typeof n === "number" && n > 0 ? (
                  <span className="ml-1.5 tabular-nums opacity-70">{n}</span>
                ) : null;
              })()}
            </button>
          );
        })}
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-4 rounded-lg border px-3.5 py-2.5 text-[13.5px] ${
            notice.ok
              ? "border-good/30 text-good"
              : "border-danger/30 text-danger"
          }`}
        >
          {notice.text}
        </p>
      )}

      {loading && (
        <div className="mt-6 space-y-4" aria-busy="true">
          {[0, 1].map((n) => (
            <div key={n} className="h-64 animate-pulse rounded-xl bg-line/60" />
          ))}
        </div>
      )}

      {failed && (
        <div className="mt-6 rounded-xl border border-danger/30 px-4 py-5">
          <p className="text-[14px] text-danger">
            The queue could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className={`mt-3 ${goodButton}`}
          >
            Try again
          </button>
        </div>
      )}

      {rows?.length === 0 && (
        <p className="mt-8 rounded-xl border border-line px-4 py-8 text-center text-[14px] text-muted">
          {tab === "LIVE"
            ? "Nothing live is waiting on a photo. This is the one to keep at zero."
            : tab === "DRAFTS"
              ? "No unpublished listing has photos waiting."
              : "Nothing has been sent back."}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {rows?.map((listing) => {
          const busy = working === listing.id;
          const where = [
            ...new Set(
              [listing.locality, listing.city, listing.district].filter(
                Boolean,
              ),
            ),
          ].join(", ");

          const kind = [
            listing.bedrooms ? `${listing.bedrooms} BHK` : null,
            titleCase(listing.propertyType).toLowerCase(),
          ]
            .filter(Boolean)
            .join(" ");
          const headline = `${rupees(listing.price)} — ${kind}, ${listing.areaValue} ${listing.areaUnit.toLowerCase()}`;
          const aside = [
            listing.listingType === "SALE" ? "for sale" : "to rent",
            `listed by ${titleCase(listing.postedBy).toLowerCase()}`,
            listing.furnishing
              ? titleCase(listing.furnishing).toLowerCase()
              : null,
          ]
            .filter(Boolean)
            .join(", ");

          const live = listing.status !== "DRAFT";

          return (
            <article
              key={listing.id}
              className="rounded-xl border border-line bg-panel"
            >
              <div className="sticky top-[69px] z-10 flex flex-col gap-2.5 rounded-t-xl border-b border-line bg-panel/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-5 lg:top-0">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        live ? "bg-good" : "bg-muted"
                      }`}
                    />
                    <span className={live ? "text-good" : "text-muted"}>
                      {live ? "In search now" : "Not published yet"}
                    </span>
                  </p>
                  <h2 className="mt-1 break-words font-display text-[18px] leading-snug">
                    {listing.title}
                  </h2>
                  <p className="mt-1 text-[13.5px]">{headline}</p>
                  <p className="text-[13px] text-muted">
                    {where || "No locality given"} · {aside}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  {(() => {
                    const media = [
                      ...listing.listingImages,
                      ...(listing.listingVideo ? [listing.listingVideo] : []),
                    ];
                    const back = media.filter(
                      (m) => !m.approved && m.reviewNote,
                    );
                    if (tab === "REJECTED" && back.length > 0) {
                      const when = back
                        .map((m) => m.updatedAt)
                        .sort()
                        .at(-1) as string;
                      return (
                        <p className="text-[12.5px] text-muted sm:text-right">
                          You sent {back.length === 1 ? "a photo" : `${back.length} items`} back{" "}
                          <span className="font-medium tabular-nums text-ink">
                            {waiting(when)}
                          </span>{" "}
                          ago
                        </p>
                      );
                    }
                    const pending = media.filter(
                      (m) => !m.approved && !m.reviewNote,
                    );
                    if (pending.length === 0) {
                      return (
                        <p className="text-[12.5px] text-muted sm:text-right">
                          Nothing is waiting on you
                        </p>
                      );
                    }
                    const oldest = pending
                      .map((m) => m.createdAt)
                      .sort()
                      .at(0) as string;
                    return (
                      <p className="text-[12.5px] text-muted sm:text-right">
                        Oldest has waited{" "}
                        <span className="font-medium tabular-nums text-ink">
                          {waiting(oldest)}
                        </span>
                      </p>
                    );
                  })()}
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (decisionSubject(listing).pendingImages === 0 &&
                        !decisionSubject(listing).pendingVideo)
                    }
                    onClick={() => {
                      setFailure(null);
                      setAsking({
                        decision: "APPROVE",
                        subject: decisionSubject(listing),
                      });
                    }}
                    className={`w-full justify-center sm:w-auto ${goodButton}`}
                  >
                    {(() => {
                      const n = decisionSubject(listing).pendingImages;
                      const v = decisionSubject(listing).pendingVideo;
                      if (n > 0 && v) return `Show ${n} photos and the video`;
                      if (v) return "Show the video";
                      if (n > 0)
                        return `Show ${n === 1 ? "this photo" : `these ${n} photos`}`;
                      return "Nothing waiting";
                    })()}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5 sm:px-5">
                {(
                  [
                    listing.listingImages.length > 0 && {
                      key: "photos" as const,
                      label:
                        listing.listingImages.length === 1
                          ? "1 photo"
                          : `${listing.listingImages.length} photos`,
                      waiting: listing.listingImages.filter(
                        (image) => !image.approved && !image.reviewNote,
                      ).length,
                      sentBack: listing.listingImages.filter(
                        (image) => !image.approved && image.reviewNote,
                      ).length,
                    },
                    listing.listingVideo && {
                      key: "video" as const,
                      label: "Video",
                      waiting:
                        !listing.listingVideo.approved &&
                        !listing.listingVideo.reviewNote
                          ? 1
                          : 0,
                      sentBack:
                        !listing.listingVideo.approved &&
                        listing.listingVideo.reviewNote
                          ? 1
                          : 0,
                    },
                  ] as const
                )
                  .filter(Boolean)
                  .map((entry) => {
                    // `as` is what hid the missing `key` on both literals
                    // above: the cast promised a field neither object had, so
                    // item.key was undefined, React had no key to render with
                    // and the open/closed comparison could never match.
                    // Narrowing by exclusion instead lets the compiler check
                    // the objects rather than take our word for them.
                    if (!entry) return null;
                    const item = entry;
                    const open = openMedia[listing.id] === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setOpenMedia((state) => ({
                            ...state,
                            // Clicking the open one closes it; clicking the
                            // other switches across. One panel at a time, so
                            // a card never grows taller than the screen.
                            [listing.id]: open ? undefined : item.key,
                          }))
                        }
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors ${focusable} ${
                          open
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line text-muted hover:text-ink"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`transition-transform ${open ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                        {item.label}
                        {item.waiting > 0 && (
                          <span className="rounded-full bg-warn/15 px-1.5 text-[11px] font-bold tabular-nums text-warn">
                            {item.waiting} waiting
                          </span>
                        )}
                        {item.sentBack > 0 && (
                          <span className="rounded-full bg-danger/15 px-1.5 text-[11px] font-bold tabular-nums text-danger">
                            {item.sentBack} sent back
                          </span>
                        )}
                      </button>
                    );
                  })}
                {listing.listingImages.length === 0 && !listing.listingVideo && (
                  <p className="text-[13px] text-muted">
                    No photos or video on this listing.
                  </p>
                )}
              </div>

              {openMedia[listing.id] === "photos" &&
              listing.listingImages.length > 0 ? (
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pb-4 pt-2 sm:px-5 sm:pt-3">
                  {listing.listingImages.map((image) => (
                    <div
                      key={image.id}
                      className="w-[72vw] max-w-72 shrink-0 snap-start sm:w-72"
                    >
                    <a
                      href={image.path}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.path}
                        alt={`Photo ${image.position + 1} of ${listing.title}`}
                        loading="lazy"
                        className={`h-44 w-full rounded-lg bg-ground object-contain ring-1 transition-opacity hover:opacity-90 sm:h-48 ${
                          image.approved
                            ? "ring-line"
                            : image.reviewNote
                              ? "ring-danger/60"
                              : "ring-warn/60"
                        }`}
                      />

                      <span
                        className={`absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white backdrop-blur-sm ${
                          image.approved
                            ? "bg-good/90"
                            : image.reviewNote
                              ? "bg-danger/90"
                              : "bg-warn/90"
                        }`}
                      >
                        {image.position + 1}
                        <span aria-hidden="true">
                          {image.approved ? "✓" : image.reviewNote ? "✕" : "·"}
                        </span>
                        <span className="sr-only">
                          {image.approved
                            ? "showing"
                            : image.reviewNote
                              ? "sent back"
                              : "waiting for a decision"}
                        </span>
                      </span>
                    </a>

                      <div className="mt-2 flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        {!image.approved && image.reviewNote && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setFailure(null);
                              setAsking({
                                decision: "APPROVE",
                                subject: {
                                  ...decisionSubject(listing),
                                  target: {
                                    kind: "image",
                                    id: image.id,
                                    label: `Photo ${image.position + 1}`,
                                  },
                                },
                              });
                            }}
                            className={`${photoAction} border-good/40 text-good hover:bg-good/10`}
                          >
                            Allow it
                          </button>
                        )}
                        {!image.approved && !image.reviewNote && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setFailure(null);
                              setAsking({
                                decision: "REJECT",
                                subject: {
                                  ...decisionSubject(listing),
                                  target: {
                                    kind: "image",
                                    id: image.id,
                                    label: `Photo ${image.position + 1}`,
                                  },
                                },
                              });
                            }}
                            className={`${photoAction} border-line text-muted hover:border-danger/50 hover:text-danger`}
                          >
                            Send back
                          </button>
                        )}
                      </div>
                      {image.reviewNote && (
                        <p className="mt-1.5 break-words text-[12px] leading-relaxed text-muted">
                          {image.reviewNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {openMedia[listing.id] === "video" && listing.listingVideo && (
                <div className="px-4 pb-4 sm:px-5">
                  <div className="mb-1.5 flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white ${
                        listing.listingVideo.approved
                          ? "bg-good/90"
                          : listing.listingVideo.reviewNote
                            ? "bg-danger/90"
                            : "bg-warn/90"
                      }`}
                    >
                      Video
                      <span aria-hidden="true">
                        {listing.listingVideo.approved
                          ? "✓"
                          : listing.listingVideo.reviewNote
                            ? "✕"
                            : "·"}
                      </span>
                      <span className="sr-only">
                        {listing.listingVideo.approved
                          ? "showing"
                          : listing.listingVideo.reviewNote
                            ? "sent back"
                            : "waiting for a decision"}
                      </span>
                    </span>
                    {!listing.listingVideo.approved &&
                      !listing.listingVideo.reviewNote && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setFailure(null);
                            setAsking({
                              decision: "REJECT",
                              subject: {
                                ...decisionSubject(listing),
                                target: {
                                  kind: "video",
                                  id: listing.listingVideo!.id,
                                  label: "The video",
                                },
                              },
                            });
                          }}
                          className={`text-[11px] font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:text-danger ${focusable}`}
                        >
                          Send back
                        </button>
                      )}
                  </div>
                  {listing.listingVideo.reviewNote && (
                    <p className="mb-1.5 text-[12px] leading-relaxed text-muted">
                      {listing.listingVideo.reviewNote}
                    </p>
                  )}
                  <iframe
                    src={listing.listingVideo.url}
                    title={`Video of ${listing.title}`}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full max-w-md rounded-lg border border-line"
                  />
                </div>
              )}

              <div className="border-t border-line px-4 py-4 sm:px-5">
                {(() => {
                  const flags = textFlags(listing.description);
                  return (
                    (flags.phone || flags.link) && (
                      <p className="mb-2 inline-flex flex-wrap items-center gap-x-1.5 rounded-lg bg-warn/10 px-2.5 py-1 text-[12.5px] text-warn">
                        <span aria-hidden="true">⚠</span>
                        {flags.phone && flags.link
                          ? "The description looks like it contains a phone number and a link"
                          : flags.phone
                            ? "The description looks like it contains a phone number"
                            : "The description looks like it contains a link"}
                      </p>
                    )
                  );
                })()}

                <details className="group/desc">
                  <summary
                    className={`cursor-pointer list-none whitespace-pre-line break-words text-[13.5px] leading-relaxed group-open/desc:line-clamp-none line-clamp-4 ${focusable}`}
                  >
                    {listing.description}
                  </summary>
                </details>

                <details className="group mt-3">
                  <summary
                    className={`inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink ${focusable}`}
                  >
                    <span
                      aria-hidden="true"
                      className="transition-transform group-open:rotate-90"
                    >
                      ▸
                    </span>
                    Address, contact and dates
                  </summary>

                <dl className="mt-3 grid gap-x-6 gap-y-2 break-words text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Address given</dt>
                    <dd>
                      {[
                        listing.addressLine,
                        listing.landmark,
                        listing.locality,
                        listing.city,
                        listing.state,
                        listing.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Pin on the map</dt>
                    <dd>
                      {listing.latitude !== null &&
                      listing.longitude !== null ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-line underline-offset-2 hover:text-accent"
                        >
                          {listing.latitude.toFixed(5)},{" "}
                          {listing.longitude.toFixed(5)}
                        </a>
                      ) : (
                        <span className="text-warn">
                          None — the owner cannot publish without it
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Contact on the listing</dt>
                    <dd>
                      {listing.contactName || listing.contactPhone ? (
                        <>
                          {listing.contactName}
                          {listing.contactPhone && (
                            <span className="tabular-nums">
                              {listing.contactName ? " · " : ""}
                              {listing.contactPhone}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-warn">None given</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Account</dt>
                    <dd>
                      {listing.contactName !== listing.owner.name && (
                        <>{listing.owner.name} </>
                      )}
                      <span className="text-muted">
                        {listing.owner.email}
                      </span>
                      {listing.owner.accountType && (
                        <span className="text-muted">
                          {" "}
                          · {titleCase(listing.owner.accountType)}
                        </span>
                      )}
                      {listing.owner.agentReraNumber && (
                        <span className="text-muted">
                          {" "}
                          · RERA {listing.owner.agentReraNumber} (
                          {titleCase(listing.owner.agentReraStatus ?? "none")})
                        </span>
                      )}
                    </dd>
                  </div>
                  {listing.project && (
                    <div className="sm:col-span-2">
                      <dt className="text-muted">Project</dt>
                      <dd>
                        {listing.project.name}
                        {listing.project.reraNumber
                          ? ` · RERA ${listing.project.reraNumber} (${titleCase(listing.project.reraStatus ?? "none")})`
                          : listing.project.isReraExempt
                            ? " · exempt"
                            : " · no RERA number"}
                      </dd>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <dt className="text-muted">Created</dt>
                    <dd>
                      {onDate(listing.createdAt)}
                      {listing.updatedAt !== listing.createdAt &&
                        `, last edited ${onDate(listing.updatedAt)}`}
                    </dd>
                  </div>
                </dl>

                {listing.amenities.length > 0 && (
                  <p className="mt-3 text-[12.5px] text-muted">
                    Amenities: {listing.amenities.map((a) => a.name).join(", ")}
                  </p>
                )}
                </details>
              </div>

              {listing.slug && listing.status !== "DRAFT" && (
                <div className="rounded-b-xl border-t border-line px-4 py-2.5 sm:px-5">
                  <Link
                    href={`/flagged/${listing.slug}?from=listings&tab=${tab}`}
                    className="text-[13px] text-muted underline decoration-line underline-offset-2 hover:text-accent"
                  >
                    Open the full record
                  </Link>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {asking && (
        <ApprovalDecision
          decision={asking.decision}
          subject={asking.subject}
          saving={working === asking.subject.listingId}
          failure={failure}
          onCancel={() => {
            setAsking(null);
            setFailure(null);
          }}
          onConfirm={decide}
        />
      )}
    </div>
  );
};

export default Page;
