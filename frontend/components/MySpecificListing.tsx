"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Gallery from "@/components/listing/Gallery";
import { api } from "@/lib/api";
import { formatDate, formatRupees, formatRupeesShort } from "@/lib/format";
import { amenityCategoryLabel, isRental, labelOf, listingLocation } from "@/lib/listing";
import { detailRows, googleMapsUrl, groupAmenities, keyFacts, withValues } from "@/lib/listingDisplay";
import { errorToast, successToast } from "@/lib/toast";
import type { Listing, ListingStatus } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type Props = { id: string };

const STATUS_DISPLAY: Record<ListingStatus, { text: string; badge: string; note: string }> = {
  DRAFT: {
    text: "Draft",
    badge: "border-warn/30 bg-warn/10 text-warn",
    note: "Buyers cannot see this listing until you publish it.",
  },
  ACTIVE: {
    text: "Live",
    badge: "border-accent/30 bg-accent-soft text-accent",
    note: "This listing is visible to buyers in search.",
  },
  SOLD: { text: "Sold", badge: "border-line bg-ground text-muted", note: "Marked as sold." },
  RENTED: { text: "Rented", badge: "border-line bg-ground text-muted", note: "Marked as rented." },
  EXPIRED: {
    text: "Expired",
    badge: "border-line bg-ground text-muted",
    note: "This listing has expired and is hidden from search.",
  },
};

const sectionHeading = "text-[20px] font-semibold tracking-tight";

const MySpecificListing = ({ id }: Props) => {
  const router = useRouter();
  const [listing, setListing] = useState<Listing>();
  const [failed, setFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Deleting removes the listing and its photos and video for good.
  const handleDelete = async (id:string) => {
    setDeleting(true);
    try {
      const response = await api.delete(`/list/delete/${id}`);
      successToast(response.data.message);
      // replace, not push: going Back must not return to the deleted listing.
      router.replace("/list/my/listings");
    } catch (error) {
      errorToast(apiMessage(error));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  useEffect(() => {
    api
      .get(`/list/owner/${id}`)
      .then((response) => setListing(response.data.response))
      .catch((error) => {
        setFailed(true);
        errorToast(apiMessage(error));
      });
  }, [id]);

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">This listing could not be loaded</h1>
        <p className="mt-2 text-[15px] text-muted">It may have been deleted, or the link is incorrect.</p>
        <Link href="/list/create" className={`mt-6 inline-block ${secondaryButton}`}>
          Create a listing
        </Link>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8" aria-busy="true">
        <div className="h-14 animate-pulse rounded-lg bg-line" />
        <div className="mt-6 aspect-[4/3] animate-pulse rounded-xl bg-line sm:aspect-[16/9]" />
        <div className="mt-8 h-24 animate-pulse rounded-lg bg-line" />
      </main>
    );
  }

  const status = STATUS_DISPLAY[listing.status];
  const location = listingLocation(listing);
  const editHref = `/list/my/listings/edit/${listing.id}`;

  const checklist: [string, boolean][] = [
    ["At least one photo", listing.listingImages.length > 0],
    ["Pin placed on the map", location !== null],
    ["Description of 30+ characters", listing.description.trim().length >= 30],
  ];
  const readyToPublish = checklist.every(([, done]) => done);

  const facts = keyFacts(listing);
  const details = detailRows(listing);
  const amenitiesByCategory = groupAmenities(listing.amenities);

  const handlePublish = async () => {
    try {
      const response = await api.patch(`/list/publish/${id}`);
      successToast(response.data.message);
      // Update the page too, so the badge and buttons change without a reload.
      setListing((prev) => prev && { ...prev, status: "ACTIVE" });
    } catch (error) {
      errorToast(apiMessage(error));
    }
  };
  

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-6 lg:px-8 lg:pt-8">
      {/* ---------- owner bar ---------- */}
      <div className="sticky top-3 z-10 flex flex-col gap-3 rounded-lg border border-line bg-panel/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${status.badge}`}>
            {status.text}
          </span>
          <p className="text-[14px] text-muted">{status.note}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting}
            className={secondaryButton}
          >
            Delete
          </button>
          <Link href={editHref} className={secondaryButton}>
            Edit listing
          </Link>
          {listing.status === "DRAFT" && (
            <button
               onClick={handlePublish}
              type="button"
              disabled={!readyToPublish}
              aria-describedby="publish-checklist"
              className={primaryButton}
            >
              Publish listing
            </button>
          )}
        </div>
      </div>

      {/* ---------- photos ---------- */}
      <section className="mt-6">
        {listing.listingImages.length > 0 ? (
          <Gallery images={listing.listingImages} title={listing.title} />
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-panel px-6 text-center ring-1 ring-line sm:aspect-[16/9]">
            <p className="max-w-sm text-[15px] text-muted">
              No photos yet. Listings with photos get far more enquiries.
            </p>
            <Link href={editHref} className={primaryButton}>
              Add photos
            </Link>
          </div>
        )}
      </section>

      {/* ---------- title and price ---------- */}
      <header className="mt-8 flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-accent">
            {labelOf(listing.listingType)} · {labelOf(listing.propertyType)}
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight lg:text-[36px]">
            {listing.title}
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {[listing.locality, listing.city, listing.district].join(", ")}
          </p>
        </div>

        <div className="shrink-0 lg:text-right">
          <p className="text-[13px] text-muted">{isRental(listing.listingType) ? "Monthly rent" : "Price"}</p>
          <p className="mt-0.5 font-mono text-[34px] font-medium leading-none tracking-tight lg:text-[40px]">
            {formatRupeesShort(listing.price)}
          </p>
          <p className="mt-2 text-[13px] text-muted">
            <span className="font-mono">{formatRupees(listing.price)}</span>
            {listing.isNegotiable && " · Negotiable"}
          </p>
          {listing.securityDeposit && (
            <p className="mt-1 text-[13px] text-muted">
              Deposit <span className="font-mono text-ink">{formatRupees(listing.securityDeposit)}</span>
            </p>
          )}
          {listing.maintenance && (
            <p className="mt-1 text-[13px] text-muted">
              Maintenance <span className="font-mono text-ink">{formatRupees(listing.maintenance)}</span> a month
            </p>
          )}
        </div>
      </header>

      {/* ---------- key facts ---------- */}
      <ul className="flex flex-wrap gap-x-10 gap-y-4 border-b border-line py-6">
        {facts.map(([name, value]) => (
          <li key={name}>
            <p className="text-[20px] font-semibold leading-none">{value}</p>
            <p className="mt-1.5 text-[13px] text-muted">{name}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_320px]">
        {/* ---------- main column ---------- */}
        <div className="min-w-0 space-y-12">
          <section>
            <h2 className={sectionHeading}>About this property</h2>
            <p className="mt-4 max-w-prose whitespace-pre-line text-[16px] leading-[1.7]">
              {listing.description}
            </p>
          </section>

          {details.length > 0 && (
            <section>
              <h2 className={sectionHeading}>Details</h2>
              <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                {details.map(([name, value]) => (
                  <div key={name}>
                    <dt className="text-[13px] text-muted">{name}</dt>
                    <dd className="mt-1 text-[15px] font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {listing.amenities.length > 0 && (
            <section>
              <h2 className={sectionHeading}>Amenities</h2>
              <div className="mt-5 space-y-5">
                {Object.entries(amenitiesByCategory).map(([category, amenities]) => (
                  <div key={category}>
                    <h3 className="text-[13px] font-medium text-muted">{amenityCategoryLabel(category)}</h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {amenities.map((amenity) => (
                        <li key={amenity.id} className="rounded-full bg-accent-soft px-3 py-1 text-[14px]">
                          {amenity.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {listing.listingVideo && (
            <section>
              <h2 className={sectionHeading}>Video tour</h2>
              <iframe
                src={listing.listingVideo.url}
                title={`${listing.title} — video tour`}
                loading="lazy"
                allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
                allowFullScreen
                className="mt-5 aspect-video w-full rounded-xl ring-1 ring-line"
              />
            </section>
          )}

          <section>
            <h2 className={sectionHeading}>Location</h2>
            <address className="mt-4 text-[15px] not-italic leading-relaxed">
              {listing.addressLine}
              {listing.landmark && <span className="text-muted"> · Near {listing.landmark}</span>}
              <br />
              {listing.locality}, {listing.city}
              <br />
              {listing.district}, {listing.state} <span className="font-mono">{listing.pincode}</span>
            </address>
            {location ? (
              <a
                href={googleMapsUrl(location[1], location[0])}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-4 inline-block ${secondaryButton}`}
              >
                Open in Google Maps
              </a>
            ) : (
              <p className="mt-4 text-[14px] text-warn">
                No pin placed. This listing will not appear in map search.
              </p>
            )}
          </section>
        </div>

        {/* ---------- sidebar ---------- */}
        <aside className="divide-y divide-line self-start rounded-xl bg-panel ring-1 ring-line lg:sticky lg:top-24">
          {listing.status === "DRAFT" && (
            <div className="p-5">
              <h2 className="text-[15px] font-semibold">Before you publish</h2>
              <ul id="publish-checklist" className="mt-3 space-y-2.5">
                {checklist.map(([name, done]) => (
                  <li key={name} className={`flex items-center gap-2.5 text-[14px] ${done ? "" : "text-muted"}`}>
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        done ? "bg-accent text-white" : "ring-1 ring-line"
                      }`}
                    >
                      {done && "✓"}
                    </span>
                    {name}
                    <span className="sr-only">{done ? "— done" : "— not done"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-5">
            <h2 className="text-[15px] font-semibold">Contact shown to buyers</h2>
            {listing.contactName || listing.contactPhone ? (
              <div className="mt-2 text-[15px]">
                {listing.contactName && <p>{listing.contactName}</p>}
                {listing.contactPhone && <p className="font-mono text-muted">{listing.contactPhone}</p>}
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-muted">No contact details added.</p>
            )}
          </div>

          <dl className="space-y-2 p-5 text-[13px]">
            {withValues([
              ["Posted by", labelOf(listing.postedBy)],
              ["Created", formatDate(listing.createdAt)],
              ["Last updated", formatDate(listing.updatedAt)],
              ["Expires", formatDate(listing.expiresAt)],
            ]).map(([name, value]) => (
              <div key={name} className="flex justify-between">
                <dt className="text-muted">{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this listing?"
        message={
          <>
            <span className="font-medium text-ink">“{listing.title}”</span> and all its photos and
            video will be deleted. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={() => handleDelete(id)}
        onCancel={() => setConfirmingDelete(false)}
      />
    </main>
  );
};

export default MySpecificListing;
