"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Gallery from "@/components/listing/Gallery";
import { api, authReady } from "@/lib/api";
import { formatDate, formatRupees, formatRupeesShort } from "@/lib/format";
import { amenityCategoryLabel, isRental, labelOf, listingLocation } from "@/lib/listing";
import { detailRows, googleMapsUrl, groupAmenities, keyFacts } from "@/lib/listingDisplay";
import type { PublicListing } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";

type Props = { slug: string };

const sectionHeading = "text-[20px] font-semibold tracking-tight";

// Public page for one listing, found by its slug. Buyers see the details and
// can call or WhatsApp the contact.
const ListSpecific = ({ slug }: Props) => {
  const [listing, setListing] = useState<PublicListing>();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Wait for the sign-in check, so signed-in users get the contact details.
    authReady
      .then(() => api.get(`/list/${slug}`))
      .then((response) => setListing(response.data.lists))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-dvh">
        <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
          <h1 className="text-[22px] font-semibold tracking-tight">This property is not available</h1>
          <p className="mt-2 text-[15px] text-muted">It may have been sold, rented or removed.</p>
          <Link href="/" className={`mt-6 inline-block ${secondaryButton}`}>
            See all properties
          </Link>
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-dvh">
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8" aria-busy="true">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-line sm:aspect-[16/9]" />
          <div className="mt-8 h-24 animate-pulse rounded-lg bg-line" />
        </main>
      </div>
    );
  }

  const location = listingLocation(listing);
  const facts = keyFacts(listing);
  const details = detailRows(listing);
  const amenitiesByCategory = groupAmenities(listing.amenities);

  // The backend only sends contact fields to signed-in users.
  const signedIn = "contactPhone" in listing;

  // Phone numbers are stored as 10 digits; tel: and WhatsApp need the +91 country code.
  const phone = listing.contactPhone?.replace(/\D/g, "").slice(-10);
  const whatsappText = encodeURIComponent(`Hi, I saw "${listing.title}" and would like to know more.`);

  return (
    <div className="min-h-dvh">
      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-6 lg:px-8 lg:pt-8">
        <Link href="/" className="text-[14px] font-medium text-muted transition-colors hover:text-ink">
          ← All properties
        </Link>

        {/* ---------- photos ---------- */}
        <section className="mt-4">
          {listing.listingImages.length > 0 ? (
            <Gallery images={listing.listingImages} title={listing.title} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-panel text-[15px] text-muted ring-1 ring-line sm:aspect-[16/9]">
              No photos yet
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
              <p className="mt-4 max-w-prose whitespace-pre-line text-[16px] leading-[1.7]">{listing.description}</p>
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
                          <li key={amenity.name} className="rounded-full bg-accent-soft px-3 py-1 text-[14px]">
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
              {/* The house address stays private; buyers get it from the contact. */}
              <address className="mt-4 text-[15px] not-italic leading-relaxed">
                {listing.landmark && (
                  <>
                    Near {listing.landmark}
                    <br />
                  </>
                )}
                {listing.locality}, {listing.city}
                <br />
                {listing.district}, {listing.state} <span className="font-mono">{listing.pincode}</span>
              </address>
              {location && (
                <a
                  href={googleMapsUrl(location[1], location[0])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-4 inline-block ${secondaryButton}`}
                >
                  Open in Google Maps
                </a>
              )}
            </section>
          </div>

          {/* ---------- contact ---------- */}
          <aside className="self-start rounded-xl bg-panel p-5 ring-1 ring-line lg:sticky lg:top-6">
            <h2 className="text-[15px] font-semibold">Contact</h2>
            {!signedIn ? (
              <>
                <p className="mt-2 text-[14px] text-muted">Sign in to see the phone number and message the seller.</p>
                <Link href="/auth/login" className={`mt-4 block text-center ${primaryButton}`}>
                  Login to contact
                </Link>
              </>
            ) : phone ? (
              <>
                {listing.contactName && <p className="mt-2 text-[15px]">{listing.contactName}</p>}
                <div className="mt-4 flex flex-col gap-2">
                  <a href={`tel:+91${phone}`} className={`text-center ${primaryButton}`}>
                    Call <span className="font-mono">+91 {phone}</span>
                  </a>
                  <a
                    href={`https://wa.me/91${phone}?text=${whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-center ${secondaryButton}`}
                  >
                    WhatsApp
                  </a>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[14px] text-muted">No contact number added.</p>
            )}

            <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
              Listed by {listing.owner.name} · {labelOf(listing.postedBy)}
              <br />
              Posted {formatDate(listing.createdAt)}
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ListSpecific;
