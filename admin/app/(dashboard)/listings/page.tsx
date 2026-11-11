"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ApprovalDecision, {
  type Decision,
  type DecisionSubject,
} from "@/components/ApprovalDecision";
import { apiMessage, focusable, goodButton, onDate } from "@/lib/ui";

// One row of GET /admin/listing/approvals — the service's select, verbatim.
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
  }[];
  listingVideo: {
    id: string;
    url: string;
    approved: boolean;
    reviewNote: string | null;
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
  // First and default. These listings are in search RIGHT NOW with their
  // photographs hidden, so a buyer is looking at a property with no picture of
  // it while the seller loses enquiries for a wait that is entirely ours.
  { key: "LIVE", label: "Live, photos hidden" },
  // Not published. Nobody can see it, nobody is losing anything, and the
  // seller is not blocked — they can publish whenever they like. Genuinely
  // second, which is the opposite of how this page was first built.
  { key: "DRAFTS", label: "Drafts" },
  // What we sent back. Kept visible so a decision can be looked up when the
  // seller writes in about it.
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

// How long it has sat here. The queue is ordered by it, so it is the number an
// operator triages on — and "3 days" lands differently from a date.
const waiting = (since: string) => {
  const days = Math.floor((Date.now() - +new Date(since)) / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor((Date.now() - +new Date(since)) / 3_600_000);
  return hours >= 1 ? `${hours} hour${hours === 1 ? "" : "s"}` : "just now";
};

// The part of a decision subject that is the same whichever item it is aimed
// at. Built in one place because the counts are what the approve preview reads,
// and three copies of this expression is three chances to get them wrong.
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
  const [tab, setTab] = useState<TabKey>("LIVE");
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

  const decide = async (note: string) => {
    if (!asking) return;
    const from = key;
    const { decision, subject } = asking;
    setWorking(subject.listingId);
    setFailure(null);
    try {
      // Approve is keyed on the listing and clears everything waiting on it.
      // Reject is keyed on the one photograph or video it is aimed at.
      const { data } =
        decision === "APPROVE"
          ? subject.target
            // Undoing a rejection on one item, not clearing the listing.
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
      if (decision === "APPROVE" && !subject.target) {
        // Everything waiting on this listing is cleared, so it leaves this
        // queue. Dropping the card beats refetching — the operator watches the
        // list get shorter, which is the only feedback that matters in a queue
        // you are working through.
        setResult((state) =>
          state && "rows" in state && state.key === from
            ? {
                ...state,
                rows: state.rows.filter((row) => row.id !== subject.listingId),
              }
            : state,
        );
      } else {
        // A rejection is aimed at ONE photograph, and the others on the card
        // still need a decision — so the card stays and only that item moves.
        // Removing the whole listing here would quietly skip them.
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
      // The dialog stays open with the note still in it.
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
          Those are in search this minute, so a buyer is looking at a property
          they cannot see and the seller is losing the enquiry. Clear those
          first; the drafts are not costing anyone anything. What you are
          looking for is a screenshot lifted from another site, a watermark, or
          a phone number painted across the picture — all of it on the card,
          nothing to click through to.
        </p>
      </div>

      {/* ---------- tabs ---------- */}
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
              }}
              aria-current={active ? "true" : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
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

      {/* ---------- the queue ---------- */}
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
          const where = [listing.locality, listing.city, listing.district]
            .filter(Boolean)
            .join(", ");
          const facts = [
            titleCase(listing.listingType),
            titleCase(listing.propertyType),
            listing.bedrooms ? `${listing.bedrooms} BHK` : null,
            `${listing.areaValue} ${listing.areaUnit}`,
            listing.furnishing ? titleCase(listing.furnishing) : null,
            `By ${titleCase(listing.postedBy)}`,
          ].filter(Boolean) as string[];

          return (
            <article
              key={listing.id}
              className="overflow-hidden rounded-xl border border-line bg-panel"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <h2 className="font-display text-[18px] leading-snug break-words">
                    {listing.title}
                  </h2>
                  <p className="mt-1 text-[13px] text-muted">
                    {rupees(listing.price)} · {where || "No locality given"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    {tab === "REJECTED" ? "Sent back" : "Waiting"}
                  </p>
                  <p className="text-[13.5px] font-medium tabular-nums">
                    {waiting(listing.updatedAt)}
                  </p>
                </div>
              </div>

              {/* ---------- media ----------
                  The review itself. Horizontal scroll rather than a grid: a
                  listing can carry ten of these, and a grid of ten pushes the
                  decision buttons off the bottom of the screen. */}
              {listing.listingImages.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto px-4 py-4 sm:px-5">
                  {listing.listingImages.map((image) => (
                    <div key={image.id} className="shrink-0">
                    <a href={image.path} target="_blank" rel="noreferrer">
                      {/* object-contain, not cover, and a plain img rather
                          than next/image — both copied from the flagged record
                          page on purpose.
                          
                          Contain, because here the photo is the evidence: the
                          commonest reason to send a listing back is something
                          IN the image, and a queue that crops the image before
                          the operator sees it is a queue that hides exactly
                          the watermark or pasted phone number it exists to
                          catch. Clicking opens the original at full size for
                          the same reason — a number painted across a picture
                          is often unreadable at this size.
                          
                          And a plain img because this panel has no
                          images.remotePatterns configured, so next/image would
                          refuse a Bunny URL outright. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.path}
                        alt={`Photo ${image.position + 1} of ${listing.title}`}
                        loading="lazy"
                        className={`h-40 w-56 rounded-lg bg-ground object-contain ring-1 transition-opacity hover:opacity-90 sm:h-48 sm:w-72 ${
                          image.approved
                            ? "ring-line"
                            : image.reviewNote
                              ? "ring-danger/60"
                              : "ring-warn/60"
                        }`}
                      />
                    </a>
                      {/* Three states, said in words. On a second visit the
                          only other way to tell the new photo from the eight
                          already passed is to remember, and nobody working a
                          queue remembers. */}
                      <div className="mt-1.5 flex w-56 flex-wrap items-start justify-between gap-x-2 gap-y-1 sm:w-72">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-[0.1em] ${
                            image.approved
                              ? "text-muted"
                              : image.reviewNote
                                ? "text-danger"
                                : "text-warn"
                          }`}
                        >
                          {image.approved
                            ? "Showing"
                            : image.reviewNote
                              ? "Sent back"
                              : `Photo ${image.position + 1} · hidden`}
                        </span>
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
                            className={`text-[11px] font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:text-good ${focusable}`}
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
                            className={`text-[11px] font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:text-danger ${focusable}`}
                          >
                            Send back
                          </button>
                        )}
                      </div>
                      {image.reviewNote && (
                        <p className="mt-1 w-56 text-[12px] leading-relaxed text-muted sm:w-72">
                          {image.reviewNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-4 text-[13.5px] text-muted sm:px-5">
                  No photos on this listing. Nothing here to decide — it is in
                  this queue because of its video.
                </p>
              )}

              {listing.listingVideo && (
                <div className="px-4 pb-4 sm:px-5">
                  <div className="mb-1.5 flex items-center gap-3">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-[0.1em] ${
                        listing.listingVideo.approved
                          ? "text-muted"
                          : listing.listingVideo.reviewNote
                            ? "text-danger"
                            : "text-warn"
                      }`}
                    >
                      {listing.listingVideo.approved
                        ? "Video · showing"
                        : listing.listingVideo.reviewNote
                          ? "Video · sent back"
                          : "Video · hidden"}
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

              {/* ---------- the listing in words ---------- */}
              <div className="border-t border-line px-4 py-4 sm:px-5">
                <ul className="flex flex-wrap gap-x-2 gap-y-1.5 text-[12.5px] text-muted">
                  {facts.map((fact) => (
                    <li
                      key={fact}
                      className="rounded-full border border-line px-2.5 py-0.5"
                    >
                      {fact}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 whitespace-pre-line break-words text-[13.5px] leading-relaxed">
                  {listing.description}
                </p>

                <dl className="mt-4 grid gap-x-6 gap-y-2 break-words text-[13px] sm:grid-cols-2">
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
                        // Worth saying out loud: without a pin the listing
                        // cannot be found by a radius search at all, and the
                        // owner's own checklist blocks publishing.
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
                    <dt className="text-muted">Posted by</dt>
                    <dd>
                      {listing.owner.name}{" "}
                      <span className="text-muted">
                        ({listing.owner.email})
                      </span>
                      {listing.owner.accountType && (
                        <span className="text-muted">
                          {" "}
                          · {titleCase(listing.owner.accountType)}
                        </span>
                      )}
                      {/* The agent's own RERA, where there is one. Not a gate
                          on anything — see the RERA queues for what it does
                          buy — but an operator reading a broker's listing
                          should be able to see it without leaving the page. */}
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
                        ` · last edited ${onDate(listing.updatedAt)}`}
                      {` · status ${titleCase(listing.status)}`}
                    </dd>
                  </div>
                </dl>

                {listing.amenities.length > 0 && (
                  <p className="mt-3 text-[12.5px] text-muted">
                    Amenities: {listing.amenities.map((a) => a.name).join(", ")}
                  </p>
                )}

              </div>

              {/* ---------- the decision ---------- */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3.5 [&>button]:grow sm:px-5 sm:[&>button]:grow-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setFailure(null);
                    setAsking({
                      decision: "APPROVE",
                      subject: decisionSubject(listing),
                    });
                  }}
                  className={goodButton}
                >
                  Approve what is waiting
                </button>
                {/* Only once it is live does it have a public page to look at.
                    A draft has no slug and nothing to open. */}
                {listing.slug && listing.status !== "DRAFT" && (
                  <Link
                    href={`/flagged/${listing.slug}`}
                    className="ml-auto text-[13px] text-muted underline decoration-line underline-offset-2 hover:text-accent"
                  >
                    Open full record
                  </Link>
                )}
              </div>
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
