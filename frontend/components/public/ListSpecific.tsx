"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Gallery from "@/components/listing/Gallery";
import SimilarListings from "@/components/public/SimilarListings";
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
import { errorToast } from "@/lib/toast";
import { apiMessage } from "@/lib/validation/apiError";
import {
  formatDate,
  formatNumber,
  formatRupees,
  formatRupeesShort,
  formatTimeAgo,
} from "@/lib/format";
import {
  amenityCategoryLabel,
  contactChannels,
  isRental,
  labelOf,
  listingLocation,
} from "@/lib/listing";
import {
  availabilityText,
  googleMapsUrl,
  groupAmenities,
  landmarkText,
  placeName,
} from "@/lib/listingDisplay";
import type { PublicListing } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";

type Props = { slug: string };

// Long descriptions and amenity lists start collapsed, so the page stays easy to scan.
const LONG_DESCRIPTION = 320;
const AMENITIES_PREVIEW = 8;

const sectionHeading = "font-display text-[20px] leading-tight";
const newTabNote = <span className="sr-only"> (opens in a new tab)</span>;

/* ---------- pieces of the page ---------- */

type Fact = {
  label: string;
  value: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

// The tiles under "At a glance". Anything the seller left empty is skipped.
const glanceFacts = (listing: PublicListing): Fact[] => {
  const { floorNumber, totalFloors } = listing;
  const floor =
    floorNumber !== null && totalFloors !== null
      ? `${floorNumber} of ${totalFloors}`
      : (floorNumber ?? totalFloors)?.toString();
  const areaInSqft =
    listing.areaUnit === "SQFT"
      ? ""
      : ` (${formatNumber(listing.areaSqft)} sq ft)`;

  const facts: (Fact | false)[] = [
    {
      label: "Area",
      value: `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}${areaInSqft}`,
      Icon: AreaIcon,
    },
    listing.bedrooms !== null && {
      label: "Bedrooms",
      value: String(listing.bedrooms),
      Icon: BedIcon,
    },
    listing.bathrooms !== null && {
      label: "Bathrooms",
      value: String(listing.bathrooms),
      Icon: BathIcon,
    },
    listing.balconies !== null && {
      label: "Balconies",
      value: String(listing.balconies),
      Icon: BalconyIcon,
    },
    !!listing.furnishing && {
      label: "Furnishing",
      value: labelOf(listing.furnishing),
      Icon: SofaIcon,
    },
    !!floor && {
      label: floorNumber === null ? "Total floors" : "Floor",
      value: floor,
      Icon: FloorIcon,
    },
    !!listing.propertyStatus && {
      label: "Construction",
      value: labelOf(listing.propertyStatus),
      Icon: ClockIcon,
    },
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
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const rental = isRental(listing.listingType);
  const pricePerSqft =
    !rental && Number(listing.areaSqft) > 0
      ? Math.round(Number(listing.price) / Number(listing.areaSqft))
      : null;

  // The backend only sends contact fields to signed-in users.
  const signedIn = "contactPhone" in listing;
  // Phone numbers are stored as 10 digits; tel: and WhatsApp need the +91 country code.
  const phone = listing.contactPhone?.replace(/\D/g, "").slice(-10);
  const whatsappText = encodeURIComponent(
    `Hi, I saw "${listing.title}" and would like to know more.`,
  );

  // What the seller left switched on. Call and WhatsApp also need a number to
  // dial, so both are gated on the phone as well as on the toggle; chat only
  // needs an account, which is why a listing with no number still has one way in.
  const channels = contactChannels(listing);
  const canCall = Boolean(phone) && channels.call;
  const canWhatsapp = Boolean(phone) && channels.whatsapp;
  const canChat = signedIn && !listing.isOwner && channels.chat;
  // Phrased as the seller reads it, for the owner's own copy of this card.
  const ownerChannels = [
    Boolean(phone) && channels.call && "call you",
    Boolean(phone) && channels.whatsapp && "message you on WhatsApp",
    channels.chat && "chat here",
  ].filter(Boolean) as string[];

  // Feeds the admin interest table, which answers "who tried to reach this
  // seller". The server upserts on (user, listing), so a buyer who taps Call
  // and then WhatsApp still counts once.
  //
  // Deliberately not awaited, and its failure is swallowed: this is bookkeeping
  // on the side, and it must never delay or block the contact the buyer asked
  // for. Without the .catch it would raise an unhandled rejection in the
  // console on every flaky network.
  const recordInterest = () => {
    api.post(`/admin/interest/create/${listing.slug}`).catch(() => {});
  };

  // The server upserts on (listing, buyer), so a second click returns the same
  // chat id rather than starting a new thread.
  const openChat = async () => {
    setOpening(true);
    try {
      const { data } = await api.post("/chat/conversation", {
        listingSlug: listing.slug,
      });
      router.push(`/list/messages/${data.chatId}`);
    } catch (error) {
      errorToast(apiMessage(error));
      setOpening(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-panel shadow-[0_10px_34px_-20px_rgba(48,32,68,0.35)] ring-1 ring-line">
      {/* ---------- price ---------- */}
      <div className="p-5">
        <p className="text-[13px] text-muted">
          {rental ? "Monthly rent" : "Price"}
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[36px] leading-none tabular-nums">
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
          <span className="tabular-nums">{formatRupees(listing.price)}</span>
          {pricePerSqft !== null && (
            <>
              {" · "}
              <span className="tabular-nums">
                {formatRupees(pricePerSqft)}
              </span>{" "}
              per sq ft
            </>
          )}
        </p>

        {rental && (listing.maintenance || listing.securityDeposit) && (
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
            {listing.maintenance && (
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-muted">Maintenance</dt>
                <dd>
                  <span className="tabular-nums">
                    {formatRupees(listing.maintenance)}
                  </span>
                  <span className="text-muted"> / month</span>
                </dd>
              </div>
            )}
            {listing.securityDeposit && (
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-muted">Security deposit</dt>
                <dd>
                  <span className="tabular-nums">
                    {formatRupees(listing.securityDeposit)}
                  </span>
                  <span className="text-muted"> one-time</span>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* ---------- contact ---------- */}
      <div className="border-t border-line bg-accent-soft/50 p-5">
        <h2 className="font-display text-[15px]">Contact the seller</h2>

        {listing.isOwner ? (
          // Your own listing. Offering you a button to ring your own phone is
          // worse than useless — it suggests the page does not know who you
          // are. Show what a buyer sees, and the way to change it.
          <>
            <p className="mt-1.5 text-[14px] text-muted">
              This is your listing. Buyers see these details here.
            </p>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex gap-2">
                <dt className="text-muted">Name</dt>
                <dd>{listing.contactName || listing.owner?.name}</dd>
              </div>
              {phone && (
                <div className="flex gap-2">
                  <dt className="text-muted">Phone</dt>
                  <dd className="tabular-nums">+91 {phone}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">Buyers can</dt>
                <dd>
                  {ownerChannels.length > 0
                    ? ownerChannels.join(", ")
                    : "do nothing — every option is switched off"}
                </dd>
              </div>
            </dl>
            <Link
              href="/list/my/listings"
              className={`mt-4 block text-center bg-panel ${secondaryButton}`}
            >
              Manage your listings
            </Link>
          </>
        ) : !signedIn ? (
          <>
            <p className="mt-1.5 flex gap-2 text-[14px] text-muted">
              <LockIcon className="mt-0.5 h-4 w-4" />
              Sign in to see the phone number and message the seller.
            </p>
            <Link
              href="/auth/login"
              className={`mt-4 block text-center ${primaryButton}`}
            >
              Login to contact
            </Link>
          </>
        ) : (
          <>
            {/* The name is required on new listings, so the fallback is only
                for rows created before that rule. Kept, because a phone number
                with nobody attached reads like a number scraped from somewhere. */}
            {(canCall || canWhatsapp || canChat) && (
              <p className="mt-1.5 text-[15px]">
                {listing.contactName || listing.owner?.name}
              </p>
            )}

            {(canCall || canWhatsapp) && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                {canCall && (
                  <a
                    onClick={recordInterest}
                    href={`tel:+91${phone}`}
                    className={`flex items-center justify-center gap-2 ${primaryButton}`}
                  >
                    <PhoneIcon className="h-4 w-4" />
                    Call <span className="tabular-nums">+91 {phone}</span>
                  </a>
                )}
                {canWhatsapp && (
                  <a
                    onClick={recordInterest}
                    href={`https://wa.me/91${phone}?text=${whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    // Whichever channel comes first is the solid button: with
                    // Call switched off, a card of outline buttons reads as
                    // though nothing on it is the thing to do.
                    className={`flex items-center justify-center gap-2 ${
                      canCall ? `bg-panel ${secondaryButton}` : primaryButton
                    }`}
                  >
                    <ChatIcon className="h-4 w-4" />
                    Message on WhatsApp
                    {newTabNote}
                  </a>
                )}
              </div>
            )}

            {/* Two different situations, and a buyer deserves to know which:
                the seller closed every door, or the listing predates the rule
                that one must carry a number. */}
            {!canCall && !canWhatsapp && !canChat && (
              <p className="mt-1.5 text-[14px] text-muted">
                {phone
                  ? "The seller has turned off every way of being contacted on this listing."
                  : "No phone number on this listing yet. Published listings always carry one."}
              </p>
            )}
          </>
        )}

        {/* Chat sits outside the phone branches on purpose: a listing with no
            number is the one where messaging matters most. */}
        {canChat && (
          <button
            type="button"
            onClick={() => {
              recordInterest();
              openChat();
            }}
            disabled={opening}
            className={`mt-2 w-full gap-2 ${
              canCall || canWhatsapp
                ? `bg-panel ${secondaryButton}`
                : primaryButton
            }`}
          >
            <ChatIcon className="h-4 w-4" />
            {opening ? "Opening chat…" : "Chat now"}
          </button>
        )}

        {/* Who is selling, and a way to see everything else they have listed. */}
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[13px] text-muted">
            Listed by{" "}
            {listing.owner.slug ? (
              <Link
                href={`/seller/${listing.owner.slug}`}
                className="font-medium text-ink hover:text-accent hover:underline"
              >
                {listing.owner.name}
              </Link>
            ) : (
              <span className="font-medium text-ink">{listing.owner.name}</span>
            )}{" "}
            ({labelOf(listing.postedBy).toLowerCase()}){" · "}
            <time dateTime={listing.createdAt}>
              {formatDate(listing.createdAt)}
            </time>
          </p>

          {/* The agent's own licence, not the project's registration, and only on a
              listing they posted as an agent: on their own property they are the
              owner, and the number would read as if the property were registered. */}
          {listing.postedBy === "BROKER" && listing.owner.agentReraNumber && (
            <p className="mt-1 text-[12px] text-muted">
              Agent RERA{" "}
              <span className="tabular-nums">
                {listing.owner.agentReraNumber}
              </span>
              {listing.owner.agentReraStatus === "VERIFIED"
                ? " · checked against the state register"
                : " · as provided by the agent"}
            </p>
          )}

          {listing.owner.slug && (
            <Link
              href={`/seller/${listing.owner.slug}`}
              className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline"
            >
              See their other properties
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- the page ---------- */

// Public page for one listing, found by its slug. Built to answer a buyer's
// questions in order: what is it, what does it cost, how do I reach the seller,
// then the details.
// Which project the unit is in. The colour says where the words came from: a
// project the builder registered here is read from our records, while a name an
// agent typed in is only their claim, and a buyer must be able to tell apart.
const ProjectBlock = ({
  project,
}: {
  project: NonNullable<PublicListing["project"]>;
}) => {
  const registered = project.inRecords;
  const tone = registered
    ? { box: "bg-accent-soft", heading: "text-accent", rule: "ring-accent/20" }
    : { box: "bg-warn/10", heading: "text-warn", rule: "ring-warn/20" };

  return (
    <section aria-labelledby="project-heading">
      <h2 id="project-heading" className={sectionHeading}>
        Project
      </h2>

      <div
        className={`mt-5 rounded-xl px-5 py-4 ring-1 ${tone.box} ${tone.rule}`}
      >
        <p className={`font-display text-[17px] ${tone.heading}`}>
          {project.name}
        </p>

        {/* Who the builder is, and whose word the RERA number is. A name on its own
            would not tell a buyer which of the two they are reading. */}
        <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-current/10 pt-4 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-muted">Builder</dt>
            <dd className="mt-0.5">
              {registered && project.builderSlug ? (
                <Link
                  href={`/seller/${project.builderSlug}`}
                  className="font-medium text-ink hover:text-accent hover:underline"
                >
                  {project.builderName}
                </Link>
              ) : project.builderName ? (
                <span className="font-medium">{project.builderName}</span>
              ) : (
                <span className="text-muted">Not given</span>
              )}
            </dd>
          </div>

          {/* The number, or plainly why there is none. Never a badge: nobody checked it. */}
          <div>
            <dt className="text-[13px] text-muted">RERA registration</dt>
            <dd className="mt-0.5">
              {project.reraNumber ? (
                <>
                  <span className="tabular-nums font-medium">
                    {project.reraNumber}
                  </span>
                  <span className="text-muted">
                    {project.reraStatus === "VERIFIED"
                      ? " · checked against the state register"
                      : registered
                        ? " · as given by the builder"
                        : ""}
                  </span>
                </>
              ) : project.isReraExempt ? (
                <span className="text-muted">
                  Exempt: the builder states the project has 8 units or fewer
                </span>
              ) : (
                <span className="text-muted">Not given</span>
              )}
            </dd>
          </div>
        </dl>

        {!registered && (
          <p className="mt-4 text-[13px] leading-snug text-muted">
            The project name, the builder and the number above were given by the{" "}
            {labelOf(project.statedBy).toLowerCase() || "lister"}, not by the
            builder, who has not registered this project on our site. Check the
            number on your state RERA website before you pay anything.
          </p>
        )}
      </div>
    </section>
  );
};

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
        <h1 className="font-display text-[22px] leading-tight">
          This property is not available
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          It may have been sold, rented or removed.
        </p>
        <Link href="/" className={`mt-6 inline-block ${secondaryButton}`}>
          See all properties
        </Link>
      </main>
    );
  }

  if (!listing) {
    return (
      <main
        className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8"
        aria-busy="true"
      >
        <p className="sr-only">Loading property…</p>
        <div className="aspect-[4/3] animate-pulse rounded-xl bg-line sm:aspect-[16/9]" />
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
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
  const shownAmenities = amenitiesOpen
    ? listing.amenities
    : listing.amenities.slice(0, AMENITIES_PREVIEW);
  const hiddenAmenities = listing.amenities.length - shownAmenities.length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-6 lg:px-8 lg:pt-8">
      <Link
        href="/"
        className="text-[14px] font-medium text-muted transition-colors hover:text-ink"
      >
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
            <li className="rounded-full bg-accent-soft px-3 py-1 text-accent">
              {labelOf(listing.listingType)}
            </li>
            <li className="rounded-full bg-panel px-3 py-1 ring-1 ring-line">
              {labelOf(listing.propertyType)}
            </li>
          </ul>
          <h1 className="mt-3 font-display text-[28px] leading-[1.1] lg:text-[36px]">
            {listing.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] text-muted">
            <PinIcon className="h-4 w-4" />
            {placeName(listing.locality, listing.city, listing.district)}
            <span aria-hidden="true">·</span>
            <span className="text-[14px]">
              Posted{" "}
              <time dateTime={listing.createdAt}>
                {formatTimeAgo(listing.createdAt)}
              </time>
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
      <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[1fr_360px]">
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
            <h2 id="glance-heading" className={sectionHeading}>
              At a glance
            </h2>
            {/* One column at base: two 134px tiles minus padding and the icon
                leave 54px for the text, which clips "Bathrooms". */}
            <dl className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {facts.map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-xl bg-panel p-4 ring-1 ring-line"
                >
                  <span className="rounded-lg bg-accent-soft p-2 text-accent">
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[13px] text-muted">{label}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold">
                      {value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          {listing.project && <ProjectBlock project={listing.project} />}

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className={sectionHeading}>
              About this property
            </h2>
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
                {Object.entries(groupAmenities(shownAmenities)).map(
                  ([category, amenities]) => (
                    <div key={category}>
                      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                        {amenityCategoryLabel(category)}
                      </h3>
                      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                        {amenities.map((amenity) => (
                          <li
                            key={amenity.name}
                            className="flex items-center gap-2.5 text-[15px]"
                          >
                            <CheckIcon className="h-4 w-4 text-accent" />
                            {amenity.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>
              {listing.amenities.length > AMENITIES_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setAmenitiesOpen(!amenitiesOpen)}
                  aria-expanded={amenitiesOpen}
                  aria-controls="amenity-list"
                  className={`mt-5 ${secondaryButton}`}
                >
                  {amenitiesOpen
                    ? "Show fewer"
                    : `Show all ${listing.amenities.length} amenities (${hiddenAmenities} more)`}
                </button>
              )}
            </section>
          )}

          {listing.listingVideo && (
            <section aria-labelledby="video-heading">
              <h2 id="video-heading" className={sectionHeading}>
                Video tour
              </h2>
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
            <h2 id="location-heading" className={sectionHeading}>
              Location
            </h2>
            <div className="mt-5 rounded-xl bg-panel p-5 ring-1 ring-line">
              <div className="flex gap-3">
                <span className="h-fit rounded-lg bg-accent-soft p-2 text-accent">
                  <PinIcon />
                </span>
                {/* The house address stays private; buyers get it from the seller. */}
                <address className="text-[15px] not-italic leading-relaxed">
                  {listing.landmark && (
                    <span className="block font-medium">
                      Near {landmarkText(listing.landmark)}
                    </span>
                  )}
                  <span className="block">
                    {placeName(listing.locality, listing.city)}
                  </span>
                  <span className="block text-muted">
                    {placeName(listing.district, listing.state)}{" "}
                    <span className="tabular-nums">{listing.pincode}</span>
                  </span>
                </address>
              </div>
              <p className="mt-4 text-[13px] text-muted">
                The exact address is shared by the seller when you get in touch.
              </p>
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

      {/* Renders itself only when the API has something to suggest. */}
      <SimilarListings
        key={slug}
        slug={slug}
        place={listing.locality ?? listing.city ?? listing.district}
      />
    </main>
  );
};

export default ListSpecific;
