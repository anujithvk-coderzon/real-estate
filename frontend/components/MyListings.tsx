"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ListingCard from "@/components/listing/ListingCard";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import type { ListingStatus, ListingSummary } from "@/lib/types";
import { inputClass, primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// Each filter is one value of the API's ?status= parameter; All sends none.
const FILTERS: { label: string; one: string; many: string; status?: ListingStatus }[] = [
  { label: "All", one: "property", many: "properties" },
  { label: "Live", one: "live listing", many: "live listings", status: "ACTIVE" },
  { label: "Drafts", one: "draft", many: "drafts", status: "DRAFT" },
  { label: "Sold", one: "sold listing", many: "sold listings", status: "SOLD" },
  { label: "Rented", one: "rented listing", many: "rented listings", status: "RENTED" },
  { label: "Expired", one: "expired listing", many: "expired listings", status: "EXPIRED" },
];

// Each sort is a value of the API's ?price= parameter; the default sends none.
const SORTS = {
  updated: { label: "Recently updated", price: undefined },
  priceLow: { label: "Price: low to high", price: "asc" },
  priceHigh: { label: "Price: high to low", price: "desc" },
} as const;

type SortKey = keyof typeof SORTS;
type View = { status?: ListingStatus; sort: SortKey; search?: string };
type PageResponse = { lists: ListingSummary[]; total: number };

const fetchPage = async (page: number, { status, sort, search }: View) => {
  // axios leaves out undefined params, so "All" and the default sort send nothing.
  const response = await api.get("/list/owner/all", {
    params: { page, status, price: SORTS[sort].price, search: search || undefined },
  });
  return response.data as PageResponse;
};




const MyListings = () => {
  const [view, setView] = useState<View>({ sort: "updated" });
  const [listings, setListings] = useState<ListingSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [reloading, setReloading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  // Every new view gets a number. A response is used only if no newer view has
  // been requested since, so a slow answer cannot overwrite a newer one.
  const latestView = useRef(0);

  const loadView = (nextView: View) => {
    const request = ++latestView.current;
    fetchPage(1, nextView)
      .then((data) => {
        if (request !== latestView.current) return;
        setListings(data.lists);
        setTotal(data.total);
        setPage(1);
        setReloading(false);
      })
      .catch((error) => {
        if (request !== latestView.current) return;
        setReloading(false);
        setFailed(true);
        errorToast(apiMessage(error));
      });
  };



  // Runs once when the page opens; later loads come from changeView and loadMore.
  useEffect(() => {
    loadView({ sort: "updated" });
  }, []);

  const changeView = (nextView: View) => {
    setView(nextView);
    setReloading(true); // keep the toolbar and cards visible, dimmed, until the new results arrive
    loadView(nextView);
  };

  // Search 500 ms after the user stops typing, keeping the current status and sort.
  useEffect(() => {
    if (search === (view.search ?? "")) return; // nothing new, including the first render
    const timer = setTimeout(() => changeView({ ...view, search }), 500);
    return () => clearTimeout(timer);
    // Only typing should trigger a search; view and changeView change on every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const loadMore = async () => {
    const request = latestView.current;
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1, view);
      // Ignore the page if the filter or sort changed while it was loading.
      if (request !== latestView.current) return;
      setListings((prev) => [...(prev ?? []), ...data.lists]);
      setTotal(data.total);
      setPage(page + 1);
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setLoadingMore(false);
    }
  };

  const loaded = listings ?? [];
  const hasMore = loaded.length < total;
  const filter = FILTERS.find((f) => f.status === view.status) ?? FILTERS[0];
  const nounFor = (count: number) => (count === 1 ? filter.one : filter.many);


  // Only a broker with no listings at all sees the welcome screen. An empty
  // filter or search keeps the toolbar, so they can change it back.
  const isFirstVisit = listings !== null && total === 0 && !view.status && !view.search;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      {/* ---------- heading ---------- */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[40px] leading-none tracking-tight lg:text-[48px]">My listings</h1>
          <p className="mt-2 text-[15px] text-muted">
            {listings === null
              ? "Loading your properties…"
              : hasMore
                ? `Showing ${loaded.length} of ${total} ${nounFor(total)}`
                : `${total} ${nounFor(total)}`}
          </p>
        </div>
        <Link href="/list/create" className={primaryButton}>
          List a property
        </Link>
      </header>

      {failed ? (
        <div className="mt-10 rounded-2xl bg-panel p-10 text-center ring-1 ring-line">
          <h2 className="text-[18px] font-semibold">Your listings could not be loaded</h2>
          <p className="mt-2 text-[15px] text-muted">Check your connection and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className={`mt-5 ${secondaryButton}`}>
            Try again
          </button>
        </div>
      ) : listings === null ? (
        /* ---------- first load ---------- */
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
              <div className="aspect-[4/3] animate-pulse bg-line/60" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-line" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
                <div className="h-5 w-20 animate-pulse rounded bg-line" />
              </div>
            </li>
          ))}
        </ul>
      ) : isFirstVisit ? (
        /* ---------- no listings at all ---------- */
        <div className="mt-10 rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
          <h2 className="font-display text-[30px] leading-tight">No properties yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
            Add your first property. It stays a draft, visible only to you, until you publish it.
          </p>
          <Link href="/list/create" className={`mt-6 inline-block ${primaryButton}`}>
            List your first property
          </Link>
        </div>
      ) : (
        <>
          {/* ---------- toolbar ---------- */}
          <div className="mt-8 flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto">
              {FILTERS.map((option) => {
                const selected = option.status === view.status;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={selected}
                    disabled={reloading}
                    onClick={() => changeView({ ...view, status: option.status })}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                      selected ? "bg-rail text-rail-ink" : "text-muted hover:bg-panel hover:text-ink"
                    }`}
                  >
                    {option.label}
                    {/* The API returns the count for the selected filter. */}
                    {selected && !reloading && (
                      <span className="rounded-full bg-rail-raised px-1.5 font-mono text-[12px] text-rail-accent">
                        {total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="search"
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                placeholder="Search title or place"
                aria-label="Search your listings"
                className={`${inputClass} lg:w-60`}
              />
              <select
                value={view.sort}
                disabled={reloading}
                onChange={(event) => changeView({ ...view, sort: event.target.value as SortKey })}
                aria-label="Sort listings"
                className={`${inputClass} w-auto`}
              >
                {Object.entries(SORTS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ---------- results ---------- */}
          {total === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-[15px] text-muted">
                {view.search ? `No ${filter.many} match “${view.search}”.` : `You have no ${filter.many}.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (view.search) {
                    // Clear only the search; stay on the current filter.
                    setSearch("");
                    changeView({ ...view, search: undefined });
                  } else {
                    changeView({ ...view, status: undefined });
                  }
                }}
                className={`mt-4 ${secondaryButton}`}
              >
                {view.search ? "Clear search" : "Show all listings"}
              </button>
            </div>
          ) : loaded.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-[15px] text-muted">
                No {hasMore ? "loaded " : ""}
                {filter.many} match “{search}”.
              </p>
              <button type="button" onClick={() => setSearch("")} className={`mt-4 ${secondaryButton}`}>
                Clear search
              </button>
            </div>
          ) : (
            <ul
              aria-busy={reloading}
              className={`mt-6 grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${reloading ? "opacity-50" : ""}`}
            >
              {loaded.map((listing) => (
                <li key={listing.id}>
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>
          )}

          {/* ---------- more ---------- */}
          {total > 0 && (
            <div className="mt-10 flex flex-col items-center gap-3">
              {hasMore ? (
                <>
                  <p className="text-[13px] text-muted">
                    {loaded.length} of {total} loaded
                  </p>
                  <button type="button" onClick={loadMore} disabled={loadingMore || reloading} className={secondaryButton}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </>
              ) : (
                <p className="text-[13px] text-muted">
                  That&apos;s everything: all {total} {nounFor(total)} shown.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default MyListings;
