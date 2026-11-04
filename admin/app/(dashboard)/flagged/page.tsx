"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import RestoreButton from "@/components/RestoreButton";
import TakeDownDialog from "@/components/TakeDownDialog";
import { apiMessage, dangerButton, onDate, outlineButton } from "@/lib/ui";

// One row of GET /admin/listing/complaints — exactly the select the service
// makes: the complaint, the listing it is against, and who reported it.
type Complaint = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  status?: string | null;
  listing: {
    // The take-down endpoint is keyed on the id; the public listing payload has
    // none, which is why the admin query selects it explicitly.
    id: string;
    slug: string | null;
    status: string;
    title: string;
    locality: string;
    city: string;
    price: string;
    listingType: string;
    contactName: string | null;
    contactPhone: string | null;
    // The account that posted it. Not the same thing as the contact fields
    // below it: a broker's account often carries the site owner's number, and
    // an operator writing to "the seller" has to know which one they reach.
    owner: { name: string; email: string } | null;
  } | null;
  user: { id: string; name: string; email: string } | null;
};

// One listing and everything reported against it. The service sends a flat
// list, so the grouping happens here — and it has to happen somewhere, because
// the decision an operator makes is about a listing ("leave it up or take it
// down"), never about one complaint in isolation. Seven reports against one
// listing is near-certainty; seven rows down a page read as seven unrelated
// gripes.
type Flagged = {
  key: string;
  listing: NonNullable<Complaint["listing"]>;
  complaints: Complaint[];
};

const TABS = [
  { key: "PENDING", label: "Waiting" },
  // Not a complaint status but a listing one: once a listing is down its
  // reports are settled, and what the operator wants to see here is what was
  // removed and what was said about it.
  { key: "TAKEN_DOWN", label: "Taken down" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type Result =
  | { key: string; groups: Flagged[]; count: number }
  | { key: string; error: true };

const rupees = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString("en-IN")}`
    : `₹${value}`;
};

const where = (listing: NonNullable<Complaint["listing"]>) =>
  [listing.locality, listing.city].filter(Boolean).join(", ");

// Grouped by slug, which is what the payload carries instead of an id. A null
// slug (a listing from before slugs existed) falls back to the title, so those
// rows group together rather than collapsing into one bucket keyed on "null".
const group = (rows: Complaint[]): Flagged[] => {
  const byListing = new Map<string, Flagged>();
  for (const row of rows) {
    if (!row.listing) continue; // nothing to act on without the listing
    const key = row.listing.slug ?? `title:${row.listing.title}`;
    const found = byListing.get(key);
    if (found) found.complaints.push(row);
    else byListing.set(key, { key, listing: row.listing, complaints: [row] });
  }
  return (
    [...byListing.values()]
      // Most-reported first: the ordering is the triage. Ties go to whichever
      // was reported most recently, so a fresh pair outranks an old pair.
      .sort(
        (a, b) =>
          b.complaints.length - a.complaints.length ||
          +new Date(b.complaints[0]!.createdAt) -
            +new Date(a.complaints[0]!.createdAt),
      )
      .map((entry) => ({
        ...entry,
        complaints: [...entry.complaints].sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
        ),
      }))
  );
};

const Page = () => {
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  // Which card is being acted on, and which is in flight.
  const [asking, setAsking] = useState<Flagged | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // What is on screen is whatever came back for THIS tab and attempt, so
  // loading and failure are derived rather than stored and the effect never
  // calls setState in its body.
  const key = `${tab}:${attempt}`;

  useEffect(() => {
    let live = true;
    api.get("/admin/listing/complaints", { params: { type: tab } }).then(
      ({ data }) => {
        if (!live) return;
        const rows = (data.complaints ?? []) as Complaint[];
        setResult({
          key: `${tab}:${attempt}`,
          groups: group(rows),
          count: rows.length,
        });
      },
      (error) => {
        if (live) {
          setResult({ key: `${tab}:${attempt}`, error: true });
          console.error(apiMessage(error, "Could not load reports"));
        }
      },
    );
    return () => {
      // The operator switched tabs before this answered; its result is stale.
      live = false;
    };
  }, [tab, attempt]);

  const takeDown = async (entry: Flagged, reason: string) => {
    // Which list the card came from, so a slow answer cannot cut a row out of
    // a tab the operator has since switched to.
    const from = key;
    setWorking(entry.listing.id);
    try {
      const { data } = await api.patch(
        `/admin/listing/take-down/${entry.listing.id}`,
        { reason },
      );
      setAsking(null);
      setNotice({ ok: true, text: data.message ?? "Listing taken down" });
      // It belongs in the other tab now: its reports are settled and its
      // status is TAKEN_DOWN. Dropping it here beats refetching — the operator
      // watches the queue get shorter.
      setResult((state) =>
        state && "groups" in state && state.key === from
          ? {
              ...state,
              groups: state.groups.filter((row) => row.key !== entry.key),
              count: state.count - entry.complaints.length,
            }
          : state,
      );
    } catch (error) {
      // The dialog stays open with the reason still in it.
      setNotice({
        ok: false,
        text: apiMessage(error, "Could not take it down"),
      });
    } finally {
      setWorking(null);
    }
  };

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && "error" in current;
  const groups = current && "groups" in current ? current.groups : null;
  const count = current && "groups" in current ? current.count : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
        Flagged content
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
        What visitors have reported, one card per listing. A report is not a
        verdict — read the listing before you act on it, and remember that a
        listing which turns out to be fine stays up.
      </p>

      <div className="mt-4 max-w-2xl rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
        <p className="text-[13.5px] font-medium">
          Every report is acknowledged within 24 hours and settled within 15
          days.
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          That is what the listing page promises the person who reported it, and
          what the IT Rules require of us. The clock starts at the date on each
          report below — the oldest ones are the ones that matter, even when a
          newer listing has more of them.
        </p>
      </div>

      <div
        role="group"
        aria-label="Which reports to show"
        className="mt-6 flex flex-wrap gap-1"
      >
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={tab === option.key}
            onClick={() => {
              setTab(option.key);
              setAsking(null);
              setNotice(null);
            }}
            className={`flex min-h-11 items-center rounded-full px-4 text-[14px] font-medium transition-colors ${
              tab === option.key
                ? "bg-accent text-white"
                : "text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-5 rounded-lg border px-4 py-3 text-[13.5px] ${
            notice.ok
              ? "border-accent/30 bg-accent-soft text-accent"
              : "border-danger/30 text-danger"
          }`}
        >
          {notice.text}
        </p>
      )}

      {groups !== null && (
        <p
          className="mt-5 text-[13px] tabular-nums text-muted"
          aria-live="polite"
        >
          {groups.length === 0
            ? "Nothing here"
            : `${count} ${count === 1 ? "report" : "reports"} on ${groups.length} ${
                groups.length === 1 ? "listing" : "listings"
              }`}
        </p>
      )}

      {loading && (
        <div className="mt-5 space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading reports</span>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[120px] animate-pulse rounded-xl border border-line bg-panel"
            />
          ))}
        </div>
      )}

      {failed && (
        <div className="mt-5 rounded-xl border border-line bg-panel p-6">
          <h2 className="font-display text-[17px]">Could not load reports</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            The request to the API did not come back. It may be down, or this
            session may no longer be an operator.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className={`mt-4 ${outlineButton}`}
          >
            Try again
          </button>
        </div>
      )}

      {groups?.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-panel p-8 text-center">
          <h2 className="font-display text-[17px]">
            {tab === "PENDING" ? "Nothing waiting" : "Nothing taken down"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {tab === "PENDING"
              ? "Every report a visitor has sent has been dealt with."
              : "Listings you remove appear here, with the reports that led to it and the reason the seller was given."}
          </p>
        </div>
      )}

      {groups && groups.length > 0 && (
        <ul className="mt-4 space-y-4">
          {groups.map((entry) => (
            <li
              key={entry.key}
              className="overflow-hidden rounded-xl border border-line bg-panel"
            >
              {/* ---------- the listing the reports are about ---------- */}
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    {/* The title is the link, not the whole card: the card
                        holds a phone number, a button and the reports
                        themselves, and a stretched link over all of it would
                        swallow every one of them. */}
                    {/* Our own page, not the live site: a taken-down listing
                        404s out there, which is exactly the one an operator
                        needs to read. */}
                    {entry.listing.slug ? (
                      <Link
                        href={`/flagged/${entry.listing.slug}`}
                        className="text-[15px] font-semibold underline decoration-line decoration-1 underline-offset-[3px] transition-colors hover:text-accent hover:decoration-accent"
                      >
                        {entry.listing.title}
                      </Link>
                    ) : (
                      <span className="text-[15px] font-semibold">
                        {entry.listing.title}
                      </span>
                    )}
                    {/* The number is the signal. Two reports is a coincidence;
                        six is a pattern, and it should be readable without
                        counting rows. */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ${
                        entry.complaints.length > 2
                          ? "bg-danger/10 text-danger"
                          : "bg-ground text-muted"
                      }`}
                    >
                      {entry.complaints.length}{" "}
                      {entry.complaints.length === 1 ? "report" : "reports"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {where(entry.listing)}
                    {" · "}
                    {entry.listing.listingType === "SALE"
                      ? "For sale"
                      : entry.listing.listingType}
                    {" · "}
                    <span className="tabular-nums">
                      {rupees(entry.listing.price)}
                    </span>
                  </p>
                  {/* Who the account belongs to. The email is a link because
                      the first thing owed to a report is an acknowledgement,
                      and this is where that gets written from. */}
                  {entry.listing.owner && (
                    <p className="mt-1 text-[12.5px] text-muted">
                      <span className="font-medium text-ink">
                        {entry.listing.owner.name}
                      </span>
                      {" · "}
                      <a
                        href={`mailto:${entry.listing.owner.email}`}
                        className="underline decoration-line underline-offset-2 hover:text-ink"
                      >
                        {entry.listing.owner.email}
                      </a>
                    </p>
                  )}

                  {/* Who to call about it — the number buyers are given, which
                      may belong to somebody other than the account holder. */}
                  {(entry.listing.contactName ||
                    entry.listing.contactPhone) && (
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      On the listing: {entry.listing.contactName ?? "—"}
                      {entry.listing.contactPhone && (
                        <>
                          {" · "}
                          <a
                            href={`tel:${entry.listing.contactPhone}`}
                            className="tabular-nums underline decoration-line underline-offset-2 hover:text-ink"
                          >
                            {entry.listing.contactPhone}
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {entry.listing.slug && (
                    <Link
                      href={`/flagged/${entry.listing.slug}`}
                      className={outlineButton}
                    >
                      Open
                    </Link>
                  )}

                  {/* Already down: the only move left is the other
                      direction, and a second Take down button would be a
                      button that lies about the state. */}
                  {entry.listing.status === "TAKEN_DOWN" ? (
                    <RestoreButton
                      listingId={entry.listing.id}
                      onDone={(message) => {
                        setNotice({ ok: true, text: message });
                        // It is ACTIVE now, so it no longer belongs in the
                        // Taken down tab. Dropping the card beats refetching:
                        // the operator watches the list get shorter.
                        setResult((state) =>
                          state && "groups" in state
                            ? {
                                ...state,
                                groups: state.groups.filter(
                                  (row) => row.key !== entry.key,
                                ),
                                count: state.count - entry.complaints.length,
                              }
                            : state,
                        );
                      }}
                    />
                  ) : working === entry.listing.id ? (
                    <span className="text-[13px] text-muted">
                      Taking it down…
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setAsking(entry);
                      }}
                      disabled={working !== null}
                      className={dangerButton}
                    >
                      Take down
                    </button>
                  )}
                </div>
              </div>

              {/* ---------- what was reported ---------- */}
              <ul className="divide-y divide-line">
                {entry.complaints.map((complaint) => (
                  <li key={complaint.id} className="px-4 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14px] font-medium">
                        {complaint.title}
                      </span>
                      <span className="text-[12px] text-muted tabular-nums">
                        {onDate(complaint.createdAt)}
                      </span>
                      {complaint.status && complaint.status !== "PENDING" && (
                        <span className="rounded bg-ground px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
                          {complaint.status}
                        </span>
                      )}
                    </p>
                    {/* The reporter's own words, whole. A truncated complaint
                        is a complaint somebody has to click to understand, and
                        this is the one field the decision rests on. */}
                    <p className="mt-1 max-w-prose whitespace-pre-line text-[13.5px] leading-relaxed text-muted">
                      {complaint.body}
                    </p>
                    <p className="mt-1.5 text-[12px] text-muted">
                      Reported by {complaint.user?.name ?? "a deleted account"}
                      {complaint.user?.email && ` · ${complaint.user.email}`}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {asking && (
        <TakeDownDialog
          // A fresh box per listing: a reason typed about one must never be
          // sitting in the box for the next.
          key={asking.key}
          subject={{
            listingId: asking.listing.id,
            title: asking.listing.title,
            reasons: asking.complaints.map((complaint) => complaint.title),
          }}
          saving={working === asking.listing.id}
          failure={notice && !notice.ok ? notice.text : null}
          onCancel={() => setAsking(null)}
          onConfirm={(reason) => takeDown(asking, reason)}
        />
      )}
    </div>
  );
};

export default Page;
