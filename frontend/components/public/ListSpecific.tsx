"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Gallery from "@/components/listing/Gallery";
import {
  AreaIcon,
  BalconyIcon,
  BathIcon,
  BedIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  ExternalIcon,
  FloorIcon,
  LockIcon,
  PhoneIcon,
  PinIcon,
  SofaIcon,
} from "@/components/public/icons";
import { api, authReady } from "@/lib/api";
import { formatDate, formatNumber, formatRupees, formatRupeesShort, formatTimeAgo } from "@/lib/format";
import { amenityCategoryLabel, isRental, labelOf, listingLocation } from "@/lib/listing";
import { availabilityText, googleMapsUrl, groupAmenities, landmarkText, placeName } from "@/lib/listingDisplay";
import type { PublicListing } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";

type Props = { slug: string };

// Long descriptions and amenity lists start collapsed, so the page stays easy to scan.
const LONG_DESCRIPTION = 320;
const AMENITIES_PREVIEW = 8;

const sectionHeading = "text-[20px] font-semibold tracking-tight";
const newTabNote = <span className="sr-only"> (opens in a new tab)</span>;

/* ---------- pieces of the page ---------- */

type Fact = { label: string; value: string; Icon: (props: { className?: string }) => React.ReactNode };

// The tiles under "At a glance". Anything the seller left empty is skipped.
const glanceFacts = (listing: PublicListing): Fact[] => {
  const { floorNumber, totalFloors } = listing;
  const floor =
    floorNumber !== null && totalFloors !== null
      ? `${floorNumber} of ${totalFloors}`
      : (floorNumber ?? totalFloors)?.toString();
  const areaInSqft = listing.areaUnit === "SQFT" ? "" : ` (${formatNumber(listing.areaSqft)} sq ft)`;

  const facts: (Fact | false)[] = [
    { label: "Area", value: `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}${areaInSqft}`, Icon: AreaIcon },
    listing.bedrooms !== null && { label: "Bedrooms", value: String(listing.bedrooms), Icon: BedIcon },
    listing.bathrooms !== null && { label: "Bathrooms", value: String(listing.bathrooms), Icon: BathIcon },
    listing.balconies !== null && { label: "Balconies", value: String(listing.balconies), Icon: BalconyIcon },
    !!listing.furnishing && { label: "Furnishing", value: labelOf(listing.furnishing), Icon: SofaIcon },
    !!floor && { label: floorNumber === null ? "Total floors" : "Floor", value: floor, Icon: FloorIcon },
    !!listing.propertyStatus && { label: "Construction", value: labelOf(listing.propertyStatus), Icon: ClockIcon },
    !!listing.availableFrom && {
      label: "Available from",
      value: availabilityText(listing.availableFrom) ?? "",
      Icon: CalendarIcon,
    },
  ];
  return facts.filter((fact): fact is Fact => Boolean(fact));
};

// Price, the running costs for rentals, and how to reach the seller.
const PriceAndContact = ({ listing }: { listing: PublicListing }) => {
  const rental = isRental(listing.listingType);
  const pricePerSqft =
    !rental && Number(listing.areaSqft) > 0 ? Math.round(Number(listing.price) / Number(listing.areaSqft)) : null;

  // The backend only sends contact fields to signed-in users.
  const signedIn = "contactPhone" in listing;
  // Phone numbers are stored as 10 digits; tel: and WhatsApp need the +91 country code.
  const phone = listing.contactPhone?.replace(/\D/g, "").slice(-10);
  const whatsappText = encodeURIComponent(`Hi, I saw "${listing.title}" and would like to know more.`);

  return (
    <div className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
      {/* ---------- price ---------- */}
      <div className="p-5">
        <p className="text-[13px] text-muted">{rental ? "Monthly rent" : "Price"}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[34px] font-medium leading-none tracking-tight">
            {formatRupeesShort(listing.price)}
          </span>
          {rental && <span className="text-[14px] text-muted">/ month</span>}
          {listing.isNegotiable && (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent">
              Negotiable
            </span>
          )}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          <span className="font-mono">{formatRupees(listing.price)}</span>
          {pricePerSqft !== null && (
            <>
              {" · "}
              <span className="font-mono">{formatRupees(pricePerSqft)}</span> per sq ft
            </>
          )}
        </p>

        {rental && (listing.maintenance || listing.securityDeposit) && (
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
            {listing.maintenance && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Maintenance</dt>
                <dd>
                  <span className="font-mono">{formatRupees(listing.maintenance)}</span>
                  <span className="text-muted"> / month</span>
                </dd>
              </div>
            )}
            {listing.securityDeposit && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Security deposit</dt>
                <dd>
                  <span className="font-mono">{formatRupees(listing.securityDeposit)}</span>
                  <span className="text-muted"> one-time</span>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* ---------- contact ---------- */}
      <div className="border-t border-line bg-ground/60 p-5">
        <h2 className="text-[15px] font-semibold">Contact the seller</h2>

        {!signedIn ? (
          <>
            <p className="mt-1.5 flex gap-2 text-[14px] text-muted">
              <LockIcon className="mt-0.5 h-4 w-4" />
              Sign in to see the phone number and message the seller.
            </p>
            <Link href="/auth/login" className={`mt-4 block text-center ${primaryButton}`}>
              Login to contact
            </Link>
          </>
        ) : phone ? (
          <>
            {listing.contactName && <p className="mt-1.5 text-[15px]">{listing.contactName}</p>}
            <div className="mt-4 grid gap-2">
              <a href={`tel:+91${phone}`} className={`flex items-center justify-center gap-2 ${primaryButton}`}>
                <PhoneIcon className="h-4 w-4" />
                Call <span className="font-mono">+91 {phone}</span>
              </a>
              <a
                href={`https://wa.me/91${phone}?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 bg-panel ${secondaryButton}`}
              >
                <ChatIcon className="h-4 w-4" />
                Message on WhatsApp
                {newTabNote}
              </a>
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-[14px] text-muted">The seller has not added a phone number.</p>
        )}

        <p className="mt-4 text-[13px] text-muted">
          Listed by <span className="font-medium text-ink">{listing.owner.name}</span> ({labelOf(listing.postedBy).toLowerCase()})
          {" · "}
          <time dateTime={listing.createdAt}>{formatDate(listing.createdAt)}</time>
        </p>
      </div>
    </div>
  );
};

/* ---------- the page ---------- */

// Public page for one listing, found by its slug. Built to answer a buyer's
// questions in order: what is it, what does it cost, how do I reach the seller,
// then the details.
const ListSpecific = ({ slug }: Props) => {
  const [listing, setListing] = useState<PublicListing>();
  const [notFound, setNotFound] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);

  useEffect(() => {
    // Wait for the sign-in check, so signed-in users get the contact details.
    authReady
      .then(() => api.get(`/list/${slug}`))
      .then((response) => setListing(response.data.lists))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">This property is not available</h1>
        <p className="mt-2 text-[15px] text-muted">It may have been sold, rented or removed.</p>
        <Link href="/" className={`mt-6 inline-block ${secondaryButton}`}>
          See all properties
        </Link>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8" aria-busy="true">
        <p className="sr-only">Loading property…</p>
        <div className="aspect-[4/3] animate-pulse rounded-xl bg-line sm:aspect-[16/9]" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-line" />
            <div className="h-9 w-3/4 animate-pulse rounded bg-line" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-line" />
        </div>
      </main>
    );
  }

  const location = listingLocation(listing);
  const facts = glanceFacts(listing);

  const longDescription = listing.description.length > LONG_DESCRIPTION;
  const shownAmenities = amenitiesOpen ? listing.amenities : listing.amenities.slice(0, AMENITIES_PREVIEW);
  const hiddenAmenities = listing.amenities.length - shownAmenities.length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-6 lg:px-8 lg:pt-8">
      <Link href="/" className="text-[14px] font-medium text-muted transition-colors hover:text-ink">
        ← All properties
      </Link>

      {/* Phones: photo first, since a phone-width photo is short and the title
          sits right below it. Desktop: title first, so a tall photo never hides
          what the property is. The header stays first in the page's reading
          order, so screen readers always start with the title. */}
      <div className="mt-4 flex flex-col gap-6 lg:gap-8">
        {/* ---------- what it is ---------- */}
        <header className="order-2 min-w-0 lg:order-1">
          <ul className="flex flex-wrap gap-2 text-[13px] font-medium">
            <li className="rounded-full bg-accent-soft px-3 py-1 text-accent">{labelOf(listing.listingType)}</li>
            <li className="rounded-full bg-panel px-3 py-1 ring-1 ring-line">{labelOf(listing.propertyType)}</li>
          </ul>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight lg:text-[36px]">{listing.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] text-muted">
            <PinIcon className="h-4 w-4" />
            {placeName(listing.locality, listing.city, listing.district)}
            <span aria-hidden="true">·</span>
            <span className="text-[14px]">
              Posted <time dateTime={listing.createdAt}>{formatTimeAgo(listing.createdAt)}</time>
            </span>
          </p>
        </header>

        {/* ---------- photos ---------- */}
        <section aria-label="Photos" className="order-1 lg:order-2">
          {listing.listingImages.length > 0 ? (
            <Gallery images={listing.listingImages} title={listing.title} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-panel text-[15px] text-muted ring-1 ring-line sm:aspect-[16/9] lg:max-h-[460px]">
              The seller has not added photos yet
            </div>
          )}
        </section>
      </div>

      {/* Price and contact come before the details in the reading order; on
          large screens they move to a sticky right column. */}
      <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[1fr_360px]">
        {/* ---------- what it costs, who to call ---------- */}
        <aside
          aria-label="Price and contact"
          className="self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1"
        >
          <PriceAndContact listing={listing} />
        </aside>

        {/* ---------- the details ---------- */}
        <div className="min-w-0 space-y-12 lg:col-start-1 lg:row-start-1">
          <section aria-labelledby="glance-heading">
            <h2 id="glance-heading" className={sectionHeading}>At a glance</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map(({ label, value, Icon }) => (
                <div key={label} className="flex items-start gap-3 rounded-xl bg-panel p-4 ring-1 ring-line">
                  <span className="rounded-lg bg-accent-soft p-2 text-accent">
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[13px] text-muted">{label}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className={sectionHeading}>About this property</h2>
            <p
              id="description"
              className={`mt-4 max-w-prose whitespace-pre-line text-[16px] leading-[1.75] ${
                longDescription && !descriptionOpen ? "line-clamp-5" : ""
              }`}
            >
              {listing.description}
            </p>
            {longDescription && (
              <button
                type="button"
                onClick={() => setDescriptionOpen(!descriptionOpen)}
                aria-expanded={descriptionOpen}
                aria-controls="description"
                className="mt-2 text-[14px] font-medium text-accent hover:underline"
              >
                {descriptionOpen ? "Show less" : "Read more"}
              </button>
            )}
          </section>

          {listing.amenities.length > 0 && (
            <section aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className={sectionHeading}>
                What this place offers
              </h2>
              <div id="amenity-list" className="mt-5 space-y-6">
                {Object.entries(groupAmenities(shownAmenities)).map(([category, amenities]) => (
                  <div key={category}>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                      {amenityCategoryLabel(category)}
                    </h3>
                    <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {amenities.map((amenity) => (
                        <li key={amenity.name} className="flex items-center gap-2.5 text-[15px]">
                          <CheckIcon className="h-4 w-4 text-accent" />
                          {amenity.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {listing.amenities.length > AMENITIES_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setAmenitiesOpen(!amenitiesOpen)}
                  aria-expanded={amenitiesOpen}
                  aria-controls="amenity-list"
                  className={`mt-5 ${secondaryButton}`}
                >
                  {amenitiesOpen ? "Show fewer" : `Show all ${listing.amenities.length} amenities (${hiddenAmenities} more)`}
                </button>
              )}
            </section>
          )}

          {listing.listingVideo && (
            <section aria-labelledby="video-heading">
              <h2 id="video-heading" className={sectionHeading}>Video tour</h2>
              <iframe
                src={listing.listingVideo.url}
                title={`${listing.title}: video tour`}
                loading="lazy"
                allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
                allowFullScreen
                className="mt-5 aspect-video w-full rounded-xl ring-1 ring-line"
              />
            </section>
          )}

          <section aria-labelledby="location-heading">
            <h2 id="location-heading" className={sectionHeading}>Location</h2>
            <div className="mt-5 rounded-xl bg-panel p-5 ring-1 ring-line">
              <div className="flex gap-3">
                <span className="h-fit rounded-lg bg-accent-soft p-2 text-accent">
                  <PinIcon />
                </span>
                {/* The house address stays private; buyers get it from the seller. */}
                <address className="text-[15px] not-italic leading-relaxed">
                  {listing.landmark && (
                    <span className="block font-medium">Near {landmarkText(listing.landmark)}</span>
                  )}
                  <span className="block">{placeName(listing.locality, listing.city)}</span>
                  <span className="block text-muted">
                    {placeName(listing.district, listing.state)} <span className="font-mono">{listing.pincode}</span>
                  </span>
                </address>
              </div>
              <p className="mt-4 text-[13px] text-muted">The exact address is shared by the seller when you get in touch.</p>
              {location && (
                <a
                  href={googleMapsUrl(location[1], location[0])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-4 inline-flex items-center gap-2 ${secondaryButton}`}
                >
                  Open in Google Maps
                  <ExternalIcon className="h-4 w-4" />
                  {newTabNote}
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default ListSpecific;
