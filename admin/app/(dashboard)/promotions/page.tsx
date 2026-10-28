"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// One row of GET /promotion/all, with the seller and the thing being promoted
// joined in. Exactly one of listing / project is set.
type Promotion = {
  id: string;
  isActive: boolean;
  createdAt: string;
  // Optional on purpose: the joins are new, and anything this page cannot find
  // is rendered as unknown rather than thrown over.
  image?: string;
  user?: { id: string; name: string; email: string } | null;
  listing?: {
    slug: string | null;
    title: string;
    price: string | number;
    locality: string | null;
    city: string | null;
    status: string;
    listingType: string;
  } | null;
  project?: {
    slug: string | null;
    name: string;
    locality: string | null;
    city: string | null;
    status: string;
  } | null;
};

// The two states the column can be in, which is the whole of the API's ?type=.
// "In review" first: it is the queue, the reason an operator opens this page.
const TABS = [
  { key: "review", label: "In review", active: false },
  { key: "live", label: "Live", active: true },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const MODE: Record<string, string> = {
  SALE: "For sale",
  RENT: "For rent",
  PG: "PG",
};

// A banner pointing at one of these is money spent sending buyers to a page
// that is gone, or was never published. It is the one thing on this screen an
// operator must not miss, so it is the one thing in red.
const NOT_LIVE: Record<string, string> = {
  DRAFT: "Draft — no public page",
  SOLD: "Sold",
  RENTED: "Rented",
  EXPIRED: "Expired",
};

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const seller = (promotion: Promotion) => ({
  name: promotion.user?.name ?? "Unknown seller",
  email: promotion.user?.email ?? "No email on the account",
});

const place = (item: { locality: string | null; city: string | null }) =>
  [item.locality, item.city].filter(Boolean).join(", ");

// What the banner is for, flattened so the two kinds render through one path.
const subject = (promotion: Promotion) => {
  if (promotion.listing) {
    const { title, price, status, listingType } = promotion.listing;
    return {
      kind: "Property",
      name: title,
      place: place(promotion.listing),
      detail: [MODE[listingType], rupees.format(Number(price))]
        .filter(Boolean)
        .join(" · "),
      warning: NOT_LIVE[status],
    };
  }
  if (promotion.project) {
    return {
      kind: "Project",
      name: promotion.project.name,
      place: place(promotion.project),
      // All three project statuses are things a builder advertises, so this is
      // information, not a warning.
      detail: promotion.project.status.toLowerCase(),
      warning: undefined,
    };
  }
  // Only reachable for a row written before the columns had foreign keys.
  return {
    kind: "Neither",
    name: "Target missing",
    place: "",
    detail: "",
    warning: "This banner points at nothing",
  };
};

const button =
  "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const focusable =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// min-h-11 even in a table: a 36px target is fine with a mouse and awkward with
// a thumb, and this page is read on a phone often enough.
const solidButton = `inline-flex min-h-11 items-center rounded-lg bg-accent px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

const quietButton = `inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink ${focusable}`;

const dangerButton = `inline-flex min-h-11 items-center rounded-lg bg-danger px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

type Result =
  | { key: string; promotions: Promotion[] }
  | { key: string; error: true };

// The API's own sentence when it sent one — "Promotion is already active" is
// more use to an operator than a status code.
const reason = (error: unknown, live: boolean) => {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string"
    ? message
    : live
      ? "Could not take it down"
      : "Could not switch it on";
};

/* The artwork is what is being judged, so it opens full size in its own tab
   rather than being squinted at in a thumbnail. */
const Banner = ({
  promotion,
  alt,
}: {
  promotion: Promotion;
  alt: string;
}) =>
  !promotion.image ? (
    <p className="rounded-lg bg-ground px-3 py-6 text-center text-[12px] text-muted">
      No image URL from the API
    </p>
  ) : (
  <a
    href={promotion.image}
    target="_blank"
    rel="noreferrer"
    title="Open full size"
    className={`block overflow-hidden rounded-lg bg-ground ring-1 ring-line transition hover:ring-accent ${focusable}`}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={promotion.image}
      alt={alt}
      className="aspect-[3/1] w-full object-contain"
    />
  </a>
  );

const Page = () => {
  const [tab, setTab] = useState<TabKey>("review");
  // Bumped by Try again, so asking for the same tab twice is a new request.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  // Which row is being asked about, and which is in flight. Ids rather than
  // booleans, because both questions are about one row out of many.
  const [asking, setAsking] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // What is on screen is whatever came back for THIS tab and attempt. Holding
  // the key beside the data is what lets loading and failure be derived rather
  // than stored, so the effect never calls setState in its body.
  const key = `${tab}:${attempt}`;

  useEffect(() => {
    let live = true;
    const wanted = TABS.find((option) => option.key === tab)!.active;
    // The API insists on the string "true" or "false"; axios writes a boolean
    // exactly that way.
    api.get("/promotion/all", { params: { type: wanted } }).then(
      ({ data }) => {
        if (live)
          setResult({
            key: `${tab}:${attempt}`,
            promotions: data.promotions ?? [],
          });
      },
      () => {
        if (live) setResult({ key: `${tab}:${attempt}`, error: true });
      },
    );
    return () => {
      // The operator switched tabs before this answered; its result is stale.
      live = false;
    };
  }, [tab, attempt]);

  // PATCH /promotion/:id flips isActive, whichever way it is pointing. One
  // endpoint for both directions, so this one function covers both buttons.
  const toggle = async (promotion: Promotion) => {
    // Which list this row was removed from. Without it, an operator who
    // activates and switches to Live before the answer lands has the row cut
    // out of the LIVE list instead — the banner they just approved appears to
    // vanish, which reads as the filter being broken.
    const from = key;
    // Where it was before the flip. Read now, not in the catch: by then the
    // row object is the only record of which way we were going.
    const live = promotion.isActive;
    setAsking(null);
    setWorking(promotion.id);
    try {
      const { data } = await api.patch(`/promotion/${promotion.id}`);
      setNotice({
        ok: true,
        text:
          data.message ??
          (live ? "The banner is switched off" : "The banner is live"),
      });
      // Its isActive is the opposite of this tab's filter now, so it belongs in
      // the other one. Dropping it here beats refetching: the operator watches
      // the queue get shorter.
      setResult((state) =>
        state && "promotions" in state && state.key === from
          ? {
              ...state,
              promotions: state.promotions.filter(
                (row) => row.id !== promotion.id,
              ),
            }
          : state,
      );
    } catch (error) {
      setNotice({ ok: false, text: reason(error, live) });
    } finally {
      setWorking(null);
    }
  };

  // The two directions are not the same act, so they do not get the same
  // control. Switching one ON is the queue's whole job, done many times in a
  // row, and now that the endpoint toggles, a mis-tap is undone from the Live
  // tab in one more — so it is a single tap. Taking one DOWN removes something
  // buyers are already being shown and a seller is watching, so that one asks
  // first and wears the red.
  //
  // isActive comes from the row, not from the tab: the row is the record of
  // what the API last said about it.
  const toggleControl = (promotion: Promotion) => {
    const live = promotion.isActive;

    if (working === promotion.id)
      return (
        <span className="text-[13px] text-muted">
          {live ? "Taking it down…" : "Switching on…"}
        </span>
      );

    // One at a time, in both directions: the queue is a sequence of decisions,
    // and two requests in flight makes it unclear which answer belongs to
    // which row.
    if (!live)
      return (
        <button
          type="button"
          onClick={() => toggle(promotion)}
          disabled={working !== null}
          className={solidButton}
        >
          Activate
        </button>
      );

    if (asking === promotion.id)
      return (
        <span className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => toggle(promotion)}
            className={dangerButton}
          >
            Yes, take it down
          </button>
          <button
            type="button"
            onClick={() => setAsking(null)}
            className={quietButton}
          >
            Cancel
          </button>
        </span>
      );

    return (
      <button
        type="button"
        onClick={() => setAsking(promotion.id)}
        disabled={working !== null}
        className={button}
      >
        Take down
      </button>
    );
  };

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && "error" in current;
  const promotions =
    current && "promotions" in current ? current.promotions : null;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
        Promotions
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted sm:text-[15px]">
        Banners sellers want shown to buyers. Every one arrives switched off,
        so <strong className="font-medium text-ink">In review</strong> is what
        is waiting on a decision; anything already up can be taken down again
        from <strong className="font-medium text-ink">Live</strong>. Newest
        first.
      </p>

      {/* ---------- which column of the table ---------- */}
      <div
        role="group"
        aria-label="Which promotions to show"
        className="mt-6 flex gap-1"
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

      {promotions !== null && (
        <p
          className="mt-5 text-[13px] tabular-nums text-muted"
          aria-live="polite"
        >
          {promotions.length === 0
            ? tab === "review"
              ? "Nothing waiting"
              : "Nothing live"
            : `${promotions.length} ${promotions.length === 1 ? "banner" : "banners"}`}
        </p>
      )}

      {/* ---------- loading ---------- */}
      {loading && (
        <div className="mt-5 space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading promotions</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[104px] animate-pulse rounded-xl border border-line bg-panel"
            />
          ))}
        </div>
      )}

      {/* ---------- failed ---------- */}
      {failed && (
        <div className="mt-5 rounded-xl border border-line bg-panel p-6">
          <h2 className="font-display text-[17px]">
            Could not load promotions
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            The request to the API did not come back. It may be down, or this
            session may no longer be an operator.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className={`mt-4 ${button}`}
          >
            Try again
          </button>
        </div>
      )}

      {/* ---------- empty ---------- */}
      {promotions?.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-panel p-8 text-center">
          <h2 className="font-display text-[17px]">
            {tab === "review" ? "The queue is clear" : "No banners are live"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {tab === "review"
              ? "Every banner sellers have submitted has been dealt with."
              : "Banners appear here once they are switched on, and can be switched off again from this tab."}
          </p>
        </div>
      )}

      {promotions && promotions.length > 0 && (
        <>
          {/* ---------- phones: one card per banner ---------- */}
          <ul className="mt-4 space-y-3 md:hidden">
            {promotions.map((promotion) => {
              const about = subject(promotion);
              return (
                <li
                  key={promotion.id}
                  className="overflow-hidden rounded-xl border border-line bg-panel"
                >
                  <Banner
                    promotion={promotion}
                    alt={`Banner for ${about.name}`}
                  />
                  <div className="space-y-1.5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                      {about.kind}
                    </p>
                    <p className="text-[14px] font-semibold">{about.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {[about.place, about.detail].filter(Boolean).join(" · ")}
                    </p>
                    {about.warning && (
                      <p className="text-[12.5px] font-medium text-danger">
                        {about.warning}
                      </p>
                    )}
                    <p className="pt-1 text-[12.5px]">
                      {seller(promotion).name}{" "}
                      <span className="text-muted">
                        {seller(promotion).email}
                      </span>
                    </p>
                    <p className="text-[12px] tabular-nums text-muted">
                      Submitted {when(promotion.createdAt)}
                    </p>
                    <div className="pt-2">{toggleControl(promotion)}</div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ---------- from md: a table, because this is a queue ---------- */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-panel md:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                {tab === "review" ? "Banners awaiting review" : "Live banners"},
                newest first
              </caption>
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="w-[24%] px-4 py-2.5">
                    Banner
                  </th>
                  <th scope="col" className="w-[28%] px-4 py-2.5">
                    For
                  </th>
                  <th scope="col" className="w-[20%] px-4 py-2.5">
                    Seller
                  </th>
                  <th scope="col" className="w-[13%] px-4 py-2.5">
                    Submitted
                  </th>
                  <th scope="col" className="w-[15%] px-4 py-2.5">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => {
                  const about = subject(promotion);
                  return (
                    <tr
                      key={promotion.id}
                      className="border-b border-line align-top last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Banner
                          promotion={promotion}
                          alt={`Banner for ${about.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                          {about.kind}
                        </p>
                        {/* The id lives in the tooltip: an operator needs it
                            about once a month, and it costs a line every time
                            it is on screen. */}
                        <p
                          className="mt-0.5 truncate text-[14px] font-medium"
                          title={promotion.id}
                        >
                          {about.name}
                        </p>
                        <p className="truncate text-[12.5px] text-muted">
                          {[about.place, about.detail]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {about.warning && (
                          <p className="mt-1 text-[12.5px] font-medium text-danger">
                            {about.warning}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-[13.5px]">
                          {seller(promotion).name}
                        </p>
                        <p
                          className="truncate text-[12.5px] text-muted"
                          title={seller(promotion).email}
                        >
                          {seller(promotion).email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] tabular-nums text-muted">
                        {when(promotion.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {toggleControl(promotion)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Page;
