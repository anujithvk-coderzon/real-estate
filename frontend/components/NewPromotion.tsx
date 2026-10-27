"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePreview } from "@/components/FilePreview";
import { api } from "@/lib/api";
import { checkImage, IMAGE_TYPES } from "@/lib/media";
import { errorToast, successToast } from "@/lib/toast";
import {
  inputClass,
  primaryButton,
  secondaryButton,
  textButton,
} from "@/lib/ui";
import type { ListingSummary } from "@/lib/types";
import { apiMessage } from "@/lib/validation/apiError";

// POST /promotion/create takes listingId OR projectId, never both and never
// neither. Making it a mode rather than two pickers is what guarantees that:
// there is only ever one selection to send.
type Mode = "listing" | "project";

// Only what the picker needs: something to read, and enough to tell two
// properties with the same title apart.
type Choice = { id: string; label: string; place: string; status: string };

// What OwnerListsFetchingService sends per page, hard-coded there. The projects
// endpoint sends everything at once, so this paginates that list here too —
// same page size, so the two modes behave identically to the person using them.
const PAGE_SIZE = 10;

// A banner is an advertisement pointing at a page. A draft has no public page
// for it to point at, and the other three are no longer on the market, so
// promoting any of them spends money sending buyers nowhere.
const UNPROMOTABLE: Record<string, string> = {
  DRAFT: "Publish it first",
  SOLD: "Sold",
  RENTED: "Rented",
  EXPIRED: "Expired",
};

const NOUN = {
  listing: { one: "property", many: "properties" },
  project: { one: "project", many: "projects" },
} as const;

const place = (item: { locality?: string | null; city?: string | null }) =>
  [item.locality, item.city].filter(Boolean).join(", ");

const asChoice = (listing: ListingSummary): Choice => ({
  id: listing.id,
  label: listing.title,
  place: place(listing),
  status: listing.status,
});

type Project = {
  id: string;
  name: string;
  status: string;
  locality?: string | null;
  city?: string | null;
};

// A page of properties, carrying the question it answers. Holding the key with
// the data is what lets "loading" and "showing an older page" be derived rather
// than stored, so the effect never calls setState in its body.
type Loaded = { key: string; items: Choice[]; total: number };

type Props = {
  // The new banner is in the list now: the page refetches and closes this form.
  onCreated: () => void;
  onCancel: () => void;
};

const NewPromotion = ({ onCreated, onCancel }: Props) => {
  const [mode, setMode] = useState<Mode>("listing");
  const [query, setQuery] = useState(""); // what they are typing
  const [search, setSearch] = useState(""); // what the server has been asked
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [projects, setProjects] = useState<Choice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<Choice | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A slow answer to an older question is dropped instead of overwriting a
  // newer one. The key check below does the same for the render; this stops
  // the stale write from ever reaching state.
  const request = useRef(0);

  const noun = NOUN[mode];
  const typed = query.trim();
  const key = `${search}:${page}`;

  // Search 350 ms after they stop typing, not on every keystroke. Resetting
  // the page here, in the timer, rather than in the fetching effect keeps that
  // effect free of a setState in its body.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typed === search) return;
      setSearch(typed);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [typed, search]);

  // The properties: searched and paged on the server, because the endpoint
  // sends ten at a time and a broker may have hundreds.
  useEffect(() => {
    if (mode !== "listing") return;
    const id = ++request.current;
    api
      .get("/list/owner/all", {
        params: { page, search: search || undefined },
      })
      .then(
        ({ data }) => {
          if (id !== request.current) return;
          setLoaded({
            key: `${search}:${page}`,
            items: (data.lists as ListingSummary[]).map(asChoice),
            total: data.total ?? 0,
          });
        },
        () => {
          if (id === request.current) setFailed(true);
        },
      );
  }, [mode, search, page]);

  // The projects: /project/mine has no page and no search, so this runs once
  // and the searching and paging below happen in the browser.
  useEffect(() => {
    if (mode !== "project" || projects !== null) return;
    api.get("/project/mine").then(
      ({ data }) =>
        setProjects(
          (data.projects as Project[]).map((project) => ({
            id: project.id,
            label: project.name,
            place: place(project),
            status: project.status,
          })),
        ),
      () => setFailed(true),
    );
  }, [mode, projects]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    // The selection belonged to the old mode, so it goes: what is left is one
    // choice from one list, which is exactly what the API accepts.
    setTarget(null);
    setQuery("");
    setSearch("");
    setPage(1);
    setLoaded(null);
    setFailed(false);
  };

  // ---------- one shape for both modes, however the data arrived ----------
  // Projects are filtered on the typed text, not the debounced copy: there is
  // no request to spare, so waiting 350 ms would only feel slow.
  const matching =
    mode === "project"
      ? (projects ?? []).filter((project) =>
          `${project.label} ${project.place}`
            .toLowerCase()
            .includes(typed.toLowerCase()),
        )
      : [];

  const total = mode === "listing" ? (loaded?.total ?? 0) : matching.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A filter can shrink the list under the page being viewed. Clamping here
  // keeps the view valid without an effect that corrects state after the fact.
  const current = Math.min(page, pages);
  const items =
    mode === "listing"
      ? (loaded?.items ?? [])
      : matching.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Nothing has arrived yet: show the shape of the list, not an empty box.
  const first = mode === "listing" ? loaded === null : projects === null;
  // A page or a search is in the air, but an older answer is on screen. Dim it
  // rather than blanking it: a list that flickers to skeletons on every page
  // is harder to read than one that fades.
  const stale = mode === "listing" && loaded !== null && loaded.key !== key;

  const pickBanner = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = ""; // picking the same file again still fires onChange
    if (!picked) return;
    const problem = checkImage(picked); // JPG, PNG or WebP under 10 MB: the backend's own limits
    if (problem) {
      errorToast(problem);
      return;
    }
    setBanner(picked);
  };

  const submit = async () => {
    if (!target || !banner) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("banner", banner);
      const { data } = await api.post("/promotion/create", form, {
        params:
          mode === "listing"
            ? { listingId: target.id }
            : { projectId: target.id },
        // The default 10 s is for JSON. A 10 MB banner on a phone connection
        // needs longer, and a timeout here would look like a failed upload
        // while the server went on to save it.
        timeout: 60_000,
      });
      successToast(data.message ?? "Banner submitted");
      onCreated();
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="new-promotion"
      className="mt-8 rounded-2xl bg-panel p-5 ring-1 ring-line sm:p-6"
    >
      <h2 id="new-promotion" className="font-display text-[22px] leading-tight">
        New promotion
      </h2>
      <p className="mt-1.5 text-[14px] text-muted">
        Pick what the banner is for, then upload it. Our team checks every
        banner before it goes live.
      </p>

      {/* ---------- step 1: a property or a project ---------- */}
      <div
        role="group"
        aria-label="What the banner is for"
        className="mt-5 flex gap-1"
      >
        {(["listing", "project"] as Mode[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => switchMode(option)}
            className={`flex min-h-11 items-center rounded-full px-4 text-[14px] font-medium transition-colors ${
              mode === option
                ? "bg-accent text-white"
                : "text-muted hover:bg-ground hover:text-ink"
            }`}
          >
            {option === "listing" ? "A property" : "A project"}
          </button>
        ))}
      </div>

      {/* ---------- step 2: which one ---------- */}
      <div className="mt-4 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search your ${noun.many}`}
          aria-label={`Search your ${noun.many}`}
          aria-controls="promotion-targets"
          className={`${inputClass} min-w-0 flex-1`}
        />
        {typed !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className={secondaryButton}
          >
            Clear
          </button>
        )}
      </div>

      {/* The chosen one stays in view even when a later search or page hides
          its row. Without this, you can pick a property, search for another,
          and upload a banner for something you can no longer see. */}
      {target && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-accent/10 px-3 py-2 text-[13.5px]">
          <span className="text-muted">Selected</span>
          <span className="font-medium">{target.label}</span>
          <button
            type="button"
            onClick={() => setTarget(null)}
            className={`ml-auto ${textButton}`}
          >
            Clear selection
          </button>
        </p>
      )}

      {failed ? (
        <p className="mt-4 text-[14px] text-danger">
          Your {noun.many} could not be loaded. Reload the page and try again.
        </p>
      ) : first ? (
        <div className="mt-3 space-y-1" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading your {noun.many}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-11 animate-pulse rounded-lg bg-line/60"
            />
          ))}
        </div>
      ) : (
        <>
          {/* The count, announced: a search that narrows the list silently
              leaves a screen reader with no idea anything happened. */}
          <p
            className="mt-3 text-[13px] tabular-nums text-muted"
            aria-live="polite"
          >
            {total === 0
              ? typed
                ? `No ${noun.many} match “${typed}”`
                : `No ${noun.many} yet`
              : `${total} ${total === 1 ? noun.one : noun.many}${typed ? ` matching “${typed}”` : ""}`}
          </p>

          {total === 0 ? (
            typed !== "" && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className={`mt-3 ${secondaryButton}`}
              >
                Clear search
              </button>
            )
          ) : (
            <>
              {/* A radio group, not checkboxes: one name is the whole answer,
                  and the browser enforces that for us. */}
              <ul
                id="promotion-targets"
                role="radiogroup"
                aria-label={`Choose a ${noun.one}`}
                aria-busy={stale}
                className={`mt-2 space-y-1 rounded-xl border border-line p-1 transition-opacity ${
                  stale ? "opacity-50" : ""
                }`}
              >
                {items.map((choice) => {
                  // Only properties have a status that rules them out; all
                  // three project statuses are things a builder advertises.
                  const reason =
                    mode === "listing" ? UNPROMOTABLE[choice.status] : undefined;
                  const selected = target?.id === choice.id;
                  return (
                    <li key={choice.id}>
                      <label
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
                          reason
                            ? "cursor-not-allowed opacity-50"
                            : `cursor-pointer ${selected ? "bg-accent/10" : "hover:bg-ground"}`
                        }`}
                      >
                        <input
                          type="radio"
                          name="promotion-target"
                          value={choice.id}
                          checked={selected}
                          disabled={Boolean(reason) || stale}
                          onChange={() => setTarget(choice)}
                          className="size-4 shrink-0 accent-accent"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {choice.label}
                          {choice.place && (
                            <span className="text-muted">
                              {" · "}
                              {choice.place}
                            </span>
                          )}
                        </span>
                        {reason && (
                          <span className="shrink-0 text-[12px] text-muted">
                            {reason}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>

              {/* ---------- pages ---------- */}
              {pages > 1 && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPage(current - 1)}
                    disabled={current === 1 || stale}
                    className={secondaryButton}
                  >
                    Previous
                  </button>
                  <p className="text-[13px] tabular-nums text-muted">
                    Page {current} of {pages}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage(current + 1)}
                    disabled={current >= pages || stale}
                    className={secondaryButton}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---------- step 3: the banner, once there is something to promote ---------- */}
      {target && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-[14px]">
            Banner for <span className="font-medium">{target.label}</span>
          </p>

          {banner ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
              {/* The preview creates its own object URL and revokes it when it
                  unmounts, so nothing is left holding the file in memory. */}
              <ImagePreview
                file={banner}
                className="max-h-40 w-full rounded-lg bg-ground object-contain sm:w-64"
              />
              <div className="text-[13px] text-muted">
                <p className="break-all text-ink">{banner.name}</p>
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  className={`mt-1 ${textButton}`}
                >
                  Choose a different image
                </button>
              </div>
            </div>
          ) : (
            <label
              className={`mt-3 inline-flex ${secondaryButton} cursor-pointer`}
            >
              Choose banner image
              <input
                type="file"
                accept={IMAGE_TYPES.join(",")}
                onChange={pickBanner}
                className="sr-only"
              />
            </label>
          )}
          <p className="mt-2 text-[12.5px] text-muted">
            JPG, PNG or WebP, up to 10 MB. A wide image reads best.
          </p>
        </div>
      )}

      {/* ---------- submit ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          // Both halves of the request have to exist before this means
          // anything: the server rejects a banner with no target and a target
          // with no banner, so the button says so before the trip.
          disabled={!target || !banner || submitting}
          className={primaryButton}
        >
          {submitting ? "Uploading…" : "Submit for review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={secondaryButton}
        >
          Cancel
        </button>
        {!target ? (
          <p className="text-[13px] text-muted">
            Choose a {noun.one} to continue.
          </p>
        ) : !banner ? (
          <p className="text-[13px] text-muted">
            Add a banner image to continue.
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default NewPromotion;
