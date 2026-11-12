"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import RestoreButton from "@/components/RestoreButton";
import TakeDownDialog from "@/components/TakeDownDialog";
import { api } from "@/lib/api";
import { apiMessage, dangerButton, onDate, outlineButton } from "@/lib/ui";

// GET /admin/listing/single/:slug — the whole row, whatever its status, with
// its complaints. Deliberately not the public payload: that one hides ids and
// the exact address, and 404s the moment a listing is taken down.
type Listing = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  status: string;
  listingType: string;
  propertyType: string;
  postedBy: string;
  price: string;
  isNegotiable: boolean;
  securityDeposit: string | null;
  maintenance: string | null;
  areaValue: string;
  areaUnit: string;
  areaSqft: string;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number | null;
  furnishing: string | null;
  floorNumber: number | null;
  totalFloors: number | null;
  propertyStatus: string | null;
  availableFrom: string | null;
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
  createdAt: string;
  updatedAt: string;
  projectNameText: string | null;
  projectReraText: string | null;
  builderNameText: string | null;
  owner: {
    id: string;
    name: string;
    email: string;
    slug: string | null;
    accountType: string | null;
    agentReraNumber: string | null;
    agentReraState: string | null;
    agentReraStatus: string;
  };
  project: {
    name: string;
    slug: string | null;
    reraNumber: string | null;
    reraStatus: string;
    isReraExempt: boolean;
    exemptReason: string | null;
    builder: { name: string; slug: string | null };
  } | null;
  listingImages: { position: number; path: string }[];
  listingVideo: { url: string } | null;
  amenities: { name: string; category: string }[];
  complaints: {
    id: string;
    title: string;
    body: string;
    status: string;
    createdAt: string;
    user: { id: string; name: string; email: string } | null;
  }[];
};

// Only for "see it as a visitor does", which is a different question from the
// one this page answers — so it is an extra, not the way in.
const SITE = process.env.NEXT_PUBLIC_SITE_URL;

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-accent text-white",
  DRAFT: "bg-warn/10 text-warn",
  TAKEN_DOWN: "bg-danger text-white",
};

const rupees = (value: string | null) => {
  if (value === null) return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString("en-IN")}` : value;
};

const titleCase = (value: string | null) =>
  value
    ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ")
    : "—";

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="border-t border-line py-2.5">
    <dt className="text-[12px] text-muted">{label}</dt>
    <dd className="mt-0.5 text-[14px]">{value}</dd>
  </div>
);

const ORIGINS = {
  listings: { href: "/listings", label: "Photo approvals" },
  flagged: { href: "/flagged", label: "Flagged content" },
} as const;

const Page = () => {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const search = useSearchParams();
  const from = search.get("from");
  const tab = search.get("tab");
  const base = from === "listings" ? ORIGINS.listings : ORIGINS.flagged;
  const origin = {
    ...base,
    href:
      from === "listings" && tab
        ? `${base.href}?tab=${encodeURIComponent(tab)}`
        : base.href,
  };
  const [listing, setListing] = useState<Listing | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    api.get(`/admin/listing/single/${slug}`).then(
      ({ data }) => {
        if (live) setListing(data.listing);
      },
      (error) => {
        if (live) setFailure(apiMessage(error, "Could not load the listing"));
      },
    );
    return () => {
      live = false;
    };
  }, [slug, attempt]);

  const takeDown = async (reason: string) => {
    if (!listing) return;
    setWorking(true);
    try {
      const { data } = await api.patch(
        `/admin/listing/take-down/${listing.id}`,
        { reason },
      );
      setAsking(false);
      setNotice({ ok: true, text: data.message ?? "Listing taken down" });
      // Refetched rather than patched in place: the take-down also settles
      // every open complaint, and this page shows those too.
      setAttempt((n) => n + 1);
    } catch (error) {
      setNotice({
        ok: false,
        text: apiMessage(error, "Could not take it down"),
      });
    } finally {
      setWorking(false);
    }
  };

  if (failure)
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href={origin.href}
          className="text-[13px] text-muted hover:text-ink"
        >
          ← {origin.label}
        </Link>
        <div className="mt-5 rounded-xl border border-line bg-panel p-6">
          <h1 className="font-display text-[20px]">
            This listing could not be loaded
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">{failure}</p>
          <button
            type="button"
            onClick={() => {
              setFailure(null);
              setAttempt((n) => n + 1);
            }}
            className={`mt-4 ${outlineButton}`}
          >
            Try again
          </button>
        </div>
      </div>
    );

  if (!listing)
    return (
      <div className="mx-auto max-w-5xl" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded bg-line" />
        <div className="mt-5 h-9 w-2/3 animate-pulse rounded bg-line" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-line" />
      </div>
    );

  const open = listing.complaints.filter(
    (complaint) => complaint.status === "PENDING",
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={origin.href} className="text-[13px] text-muted hover:text-ink">
        ← {origin.label}
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] ${
                STATUS_TONE[listing.status] ?? "bg-ground text-muted"
              }`}
            >
              {titleCase(listing.status)}
            </span>
            <span className="rounded-full bg-ground px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">
              {listing.listingType === "SALE"
                ? "For sale"
                : titleCase(listing.listingType)}
            </span>
            <span className="text-[12.5px] text-muted">
              {titleCase(listing.propertyType)} · posted by{" "}
              {titleCase(listing.postedBy)} · {onDate(listing.createdAt)}
            </span>
          </p>
          <h1 className="mt-2 font-display text-[24px] leading-tight sm:text-[30px]">
            {listing.title}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {[listing.locality, listing.city, listing.state]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SITE && listing.slug && listing.status === "ACTIVE" && (
            <a
              href={`${SITE}/property/${listing.slug}`}
              target="_blank"
              rel="noreferrer"
              className={outlineButton}
            >
              See it live ↗
            </a>
          )}
          {listing.status === "TAKEN_DOWN" ? (
            // Refetched rather than patched: putting it back changes the
            // status chip, the live link and this very button.
            <RestoreButton
              listingId={listing.id}
              onDone={(message) => {
                setNotice({ ok: true, text: message });
                setAttempt((n) => n + 1);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setAsking(true);
              }}
              disabled={working}
              className={dangerButton}
            >
              Take down
            </button>
          )}
        </div>
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

      <div className="mt-6">
        {listing.listingImages.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line bg-panel text-[13px] text-muted">
            No photos on this listing
          </div>
        ) : (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {listing.listingImages.map((image) => (
              <li key={image.path} className="shrink-0">
                {/* object-contain, not cover. Everywhere else a cropped photo
                    is a tidier grid; here it is evidence. A report saying the
                    photos are not of this property, or that something was
                    cropped out of frame, cannot be judged against an image
                    this page has cropped again. Clicking opens the original at
                    full size for the same reason. */}
                <a href={image.path} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.path}
                    alt=""
                    loading="lazy"
                    className="h-48 w-72 rounded-xl bg-ground object-contain ring-1 ring-line transition-opacity hover:opacity-90"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <section aria-labelledby="reports-heading">
            <h2
              id="reports-heading"
              className="font-display text-[18px] leading-tight"
            >
              Reports
              <span className="ml-2 text-[13px] font-normal text-muted tabular-nums">
                {listing.complaints.length} in all
                {open > 0 && `, ${open} open`}
              </span>
            </h2>

            {listing.complaints.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-muted">
                Nobody has reported this listing.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-panel">
                {listing.complaints.map((complaint) => (
                  <li key={complaint.id} className="px-4 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14px] font-medium">
                        {complaint.title}
                      </span>
                      <span className="text-[12px] tabular-nums text-muted">
                        {onDate(complaint.createdAt)}
                      </span>
                      {complaint.status !== "PENDING" && (
                        <span className="rounded bg-ground px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
                          {titleCase(complaint.status)}
                        </span>
                      )}
                    </p>
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
            )}
          </section>

          <section aria-labelledby="facts-heading" className="mt-8">
            <h2
              id="facts-heading"
              className="font-display text-[18px] leading-tight"
            >
              What it claims
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              <Fact label="Price" value={rupees(listing.price)} />
              <Fact
                label="Negotiable"
                value={listing.isNegotiable ? "Yes" : "No"}
              />
              <Fact
                label="Area"
                value={`${listing.areaValue} ${listing.areaUnit.toLowerCase()} (${Number(
                  listing.areaSqft,
                ).toLocaleString("en-IN")} sq ft)`}
              />
              <Fact label="Bedrooms" value={listing.bedrooms ?? "—"} />
              <Fact label="Bathrooms" value={listing.bathrooms ?? "—"} />
              <Fact label="Balconies" value={listing.balconies ?? "—"} />
              <Fact label="Furnishing" value={titleCase(listing.furnishing)} />
              <Fact
                label="Floor"
                value={
                  listing.floorNumber === null
                    ? "—"
                    : `${listing.floorNumber} of ${listing.totalFloors ?? "?"}`
                }
              />
              <Fact
                label="Construction"
                value={titleCase(listing.propertyStatus)}
              />
              {listing.securityDeposit && (
                <Fact label="Deposit" value={rupees(listing.securityDeposit)} />
              )}
              {listing.maintenance && (
                <Fact label="Maintenance" value={rupees(listing.maintenance)} />
              )}
              <Fact label="Last edited" value={onDate(listing.updatedAt)} />
            </dl>
          </section>

          <section aria-labelledby="description-heading" className="mt-8">
            <h2
              id="description-heading"
              className="font-display text-[18px] leading-tight"
            >
              Description
            </h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-[14px] leading-relaxed text-muted">
              {listing.description}
            </p>
          </section>

          {listing.amenities.length > 0 && (
            <section aria-labelledby="amenities-heading" className="mt-8">
              <h2
                id="amenities-heading"
                className="font-display text-[18px] leading-tight"
              >
                Amenities claimed
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {listing.amenities.map((amenity) => (
                  <li
                    key={amenity.name}
                    className="rounded-full bg-ground px-2.5 py-1 text-[12.5px] text-muted"
                  >
                    {amenity.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              The account
            </p>
            <p className="mt-1.5 text-[14px] font-medium">
              {listing.owner.name}
            </p>
            <a
              href={`mailto:${listing.owner.email}`}
              className="text-[13px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
            >
              {listing.owner.email}
            </a>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {titleCase(listing.owner.accountType)}
              {" · RERA "}
              {titleCase(listing.owner.agentReraStatus)}
              {listing.owner.agentReraNumber &&
                ` · ${listing.owner.agentReraNumber}`}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              On the listing
            </p>
            <p className="mt-1.5 text-[14px]">{listing.contactName ?? "—"}</p>
            {listing.contactPhone && (
              <a
                href={`tel:${listing.contactPhone}`}
                className="text-[13px] tabular-nums text-muted underline decoration-line underline-offset-2 hover:text-ink"
              >
                {listing.contactPhone}
              </a>
            )}
          </div>

          <div className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Address
            </p>
            {/* The exact address, which a visitor never sees. A report of
                "the photos are not of this property" is answered here. */}
            <p className="mt-1.5 text-[13.5px] leading-relaxed">
              {listing.addressLine}
              {listing.landmark && <>, {listing.landmark}</>}
              <br />
              {listing.locality}, {listing.city}
              <br />
              {listing.district}, {listing.state} {listing.pincode}
            </p>
            {listing.latitude !== null && listing.longitude !== null && (
              <a
                href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[12.5px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
              >
                Open the pin ↗
              </a>
            )}
          </div>

          <div className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Project
            </p>
            {listing.project ? (
              <>
                <p className="mt-1.5 text-[14px] font-medium">
                  {listing.project.name}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {listing.project.builder.name}
                  {" · RERA "}
                  {listing.project.isReraExempt
                    ? "exempt"
                    : titleCase(listing.project.reraStatus)}
                </p>
                {listing.project.reraNumber && (
                  <p className="text-[12.5px] tabular-nums text-muted">
                    {listing.project.reraNumber}
                  </p>
                )}
              </>
            ) : listing.projectNameText ? (
              <>
                {/* Typed in by the lister, not a project of ours — which is
                    itself worth knowing when the complaint is about the
                    project's registration. */}
                <p className="mt-1.5 text-[14px] font-medium">
                  {listing.projectNameText}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  Typed in by the lister
                  {listing.builderNameText && ` · ${listing.builderNameText}`}
                </p>
                {listing.projectReraText && (
                  <p className="text-[12.5px] tabular-nums text-muted">
                    {listing.projectReraText}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-[13.5px] text-muted">
                Not part of a project
              </p>
            )}
          </div>
        </aside>
      </div>

      {asking && (
        <TakeDownDialog
          subject={{
            listingId: listing.id,
            title: listing.title,
            reasons: listing.complaints.map((complaint) => complaint.title),
          }}
          saving={working}
          failure={notice && !notice.ok ? notice.text : null}
          onCancel={() => setAsking(false)}
          onConfirm={takeDown}
        />
      )}
    </div>
  );
};

export default Page;
