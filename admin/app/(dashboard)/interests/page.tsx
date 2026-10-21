"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Interest = {
  id: string;
  createdAt: string;
  user: { name: string; email: string };
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

type Result =
  | { key: string; rows: Interest[]; total: number }
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
            rows: data.interests ?? [],
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
  const rows = current && "rows" in current ? current.rows : null;
  const total = current && "rows" in current ? current.total : 0;

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
        Every time someone signed in taps contact on a property, it is recorded
        here — who it was, which property, and when. Newest first.
      </p>

      {rows !== null && (
        <p className="mt-6 text-[13px] text-muted tabular-nums">
          {total === 0
            ? "No records"
            : `${total} record${total === 1 ? "" : "s"}`}
        </p>
      )}

      {/* ---------- loading ---------- */}
      {loading && (
        <div className="mt-6 space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading interests</span>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl border border-line bg-panel"
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
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </div>
      )}

      {/* ---------- empty ---------- */}
      {rows?.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-panel p-8 text-center">
          <h2 className="font-display text-[17px]">Nothing yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            The first time a signed-in visitor taps contact on a listing, they
            will appear here.
          </p>
        </div>
      )}

      {/* ---------- phones: one card each ---------- */}
      {rows && rows.length > 0 && (
        <ul className="mt-4 space-y-2 md:hidden">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-line bg-panel p-4"
            >
              <p className="truncate text-[15px] font-semibold">
                {row.user.name}
              </p>
              <p className="truncate text-[12.5px] text-muted">
                {row.user.email}
              </p>

              <p className="mt-3 border-t border-line pt-3 text-[13.5px] font-medium">
                {row.listing.title}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {place(row.listing)} &middot; {MODE[row.listing.listingType]}{" "}
                &middot;{" "}
                <span className="tabular-nums">
                  {rupees.format(row.listing.price)}
                </span>
              </p>

              <p className="mt-3 text-[12px] text-muted tabular-nums">
                {when(row.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* ---------- from md: a table, because this is tabular ---------- */}
      {rows && rows.length > 0 && (
        <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-panel md:block">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Visitors who tapped contact, newest first
            </caption>
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                <th scope="col" className="w-[26%] px-4 py-3">
                  Who
                </th>
                <th scope="col" className="w-[36%] px-4 py-3">
                  Property
                </th>
                <th scope="col" className="w-[20%] px-4 py-3">
                  Seller contact
                </th>
                <th scope="col" className="w-[18%] px-4 py-3">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-0 align-top"
                >
                  <td className="px-4 py-3">
                    <p className="truncate text-[14px] font-semibold">
                      {row.user.name}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">
                      {row.user.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate text-[14px]">{row.listing.title}</p>
                    <p className="truncate text-[12.5px] text-muted">
                      {place(row.listing)} &middot;{" "}
                      {MODE[row.listing.listingType]} &middot;{" "}
                      <span className="tabular-nums">
                        {rupees.format(row.listing.price)}
                      </span>
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate text-[13.5px]">
                      {row.listing.contactName ?? row.listing.owner.name}
                    </p>
                    <p className="truncate text-[12.5px] text-muted tabular-nums">
                      {row.listing.contactPhone ?? "No number"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted tabular-nums">
                    {when(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- pages ---------- */}
      {rows && rows.length > 0 && pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Previous
          </button>
          <p className="text-[13px] text-muted tabular-nums">
            Page {page} of {pages}
          </p>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
            disabled={page >= pages}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Page;
