"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// One property a person tapped contact on.
type Interest = {
  id: string;
  createdAt: string;
  listing: {
    slug: string;
    title: string;
    locality: string | null;
    city: string | null;
    price: number;
    listingType: string;
    contactName: string | null;
    contactPhone: string | null;
    owner: { name: string; email: string };
  };
};

// GET /admin/interests groups by account: one row per person, their properties
// nested, ordered by the last time they tapped anything.
type InterestedUser = {
  id: string;
  name: string;
  email: string;
  // How many properties this person has tapped contact on. Sent by the server
  // rather than counted here, because a page may carry only the newest few.
  count: number;
  lastAt: string;
  interests: Interest[];
};

// Accounts per page, not records: the pages count people now.
const TAKE = 25;

const MODE: Record<string, string> = {
  SALE: "For sale",
  RENT: "For rent",
  PG: "PG",
};

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Date and time both: two taps from the same person an hour apart is a
// different story from two a week apart, and the time is what tells them apart.
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const place = (listing: Interest["listing"]) =>
  [listing.locality, listing.city].filter(Boolean).join(", ");

const button =
  "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Result =
  | { key: string; users: InterestedUser[]; total: number }
  | { key: string; error: true };

const Page = () => {
  const [page, setPage] = useState(1);
  // Bumped by the retry button, so asking again for the same page is a new
  // request rather than a no-op.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  // What is on screen is whatever came back for THIS page and attempt. Holding
  // the key with the data is what lets loading and failure be derived rather
  // than stored: no flag to set before the request, so the effect never calls
  // setState synchronously and cannot cascade renders.
  const key = `${page}:${attempt}`;

  useEffect(() => {
    let live = true;
    api.get("/admin/interests", { params: { page, take: TAKE } }).then(
      ({ data }) => {
        if (live) {
          setResult({
            key: `${page}:${attempt}`,
            users: data.users ?? [],
            total: data.total ?? 0,
          });
        }
      },
      () => {
        if (live) setResult({ key: `${page}:${attempt}`, error: true });
      },
    );
    return () => {
      // The page was changed again before this answered; its result is stale.
      live = false;
    };
  }, [page, attempt]);

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && "error" in current;
  const users = current && "users" in current ? current.users : null;
  const total = current && "users" in current ? current.total : 0;

  const pages = Math.max(1, Math.ceil(total / TAKE));

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
        User interests
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted sm:text-[15px]">
        Everyone signed in who has tapped contact on a property, grouped by
        account. Open a person to see what they were looking at. The most
        recently active are first.
      </p>

      {users !== null && (
        <p className="mt-6 text-[13px] tabular-nums text-muted">
          {total === 0
            ? "Nobody yet"
            : `${total} ${total === 1 ? "person" : "people"}`}
        </p>
      )}

      {/* ---------- loading ---------- */}
      {loading && (
        <div className="mt-6 space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading interests</span>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[72px] animate-pulse rounded-xl border border-line bg-panel"
            />
          ))}
        </div>
      )}

      {/* ---------- failed ---------- */}
      {failed && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-6">
          <h2 className="font-display text-[17px]">Could not load interests</h2>
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
      {users?.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-panel p-8 text-center">
          <h2 className="font-display text-[17px]">Nothing yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            The first time a signed-in visitor taps contact on a listing, they
            will appear here.
          </p>
        </div>
      )}

      {/* ---------- one person per row, opening to their properties ---------- */}
      {users && users.length > 0 && (
        <ul className="mt-4 space-y-2">
          {users.map((user) => (
            <li key={user.id}>
              {/* A native <details> rather than a useState: it is a button to a
                  screen reader, answers Enter and Space, and keeps no state of
                  ours to get out of step with the page. Every row starts shut,
                  so the list stays a list however many people are on it. */}
              <details
                className="group overflow-hidden rounded-xl border border-line bg-panel open:border-accent/30"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {user.name}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">
                      {user.email}
                    </p>
                  </div>

                  {/* The two numbers an operator is actually scanning for:
                      how keen, and how recently. */}
                  <div className="shrink-0 text-right">
                    <p className="text-[13.5px] font-medium tabular-nums">
                      {user.count}{" "}
                      <span className="font-normal text-muted">
                        {user.count === 1 ? "property" : "properties"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted">
                      {when(user.lastAt)}
                    </p>
                  </div>

                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  >
                    <path
                      d="M5 7.5 10 12.5 15 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>

                {/* ---------- phones: one card per property ---------- */}
                <ul className="divide-y divide-line border-t border-line md:hidden">
                  {user.interests.map((interest) => (
                    <li key={interest.id} className="p-4">
                      <p className="text-[13.5px] font-medium">
                        {interest.listing.title}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {place(interest.listing)} &middot;{" "}
                        {MODE[interest.listing.listingType]} &middot;{" "}
                        <span className="tabular-nums">
                          {rupees.format(interest.listing.price)}
                        </span>
                      </p>
                      <p className="mt-2.5 text-[12.5px]">
                        {interest.listing.contactName ??
                          interest.listing.owner.name}{" "}
                        <span className="tabular-nums text-muted">
                          {interest.listing.contactPhone ?? "No number"}
                        </span>
                      </p>
                      <p className="mt-2 text-[12px] tabular-nums text-muted">
                        {when(interest.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>

                {/* ---------- from md: a table, because this is tabular ---------- */}
                <div className="hidden border-t border-line md:block">
                  <table className="w-full table-fixed border-collapse text-left">
                    <caption className="sr-only">
                      Properties {user.name} tapped contact on, newest first
                    </caption>
                    <thead>
                      <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                        <th scope="col" className="w-[46%] px-4 py-2.5">
                          Property
                        </th>
                        <th scope="col" className="w-[28%] px-4 py-2.5">
                          Seller contact
                        </th>
                        <th scope="col" className="w-[26%] px-4 py-2.5">
                          When
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.interests.map((interest) => (
                        <tr
                          key={interest.id}
                          className="border-b border-line align-top last:border-0"
                        >
                          <td className="px-4 py-3">
                            <p className="truncate text-[14px]">
                              {interest.listing.title}
                            </p>
                            <p className="truncate text-[12.5px] text-muted">
                              {place(interest.listing)} &middot;{" "}
                              {MODE[interest.listing.listingType]} &middot;{" "}
                              <span className="tabular-nums">
                                {rupees.format(interest.listing.price)}
                              </span>
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate text-[13.5px]">
                              {interest.listing.contactName ??
                                interest.listing.owner.name}
                            </p>
                            <p className="truncate text-[12.5px] tabular-nums text-muted">
                              {interest.listing.contactPhone ?? "No number"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[12.5px] tabular-nums text-muted">
                            {when(interest.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {/* ---------- pages ---------- */}
      {users && users.length > 0 && pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className={button}
          >
            Previous
          </button>
          <p className="text-[13px] tabular-nums text-muted">
            Page {page} of {pages}
          </p>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
            disabled={page >= pages}
            className={button}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Page;
