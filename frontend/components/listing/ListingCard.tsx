import Link from "next/link";
import AvailabilityActions from "@/components/listing/AvailabilityActions";
import { formatNumber, formatRupeesShort, formatTimeAgo } from "@/lib/format";
import { isRental, labelOf, STATUS_LABEL } from "@/lib/listing";
import type { ListingStatus, ListingSummary } from "@/lib/types";

// Solid, not the hairline chip the dashboard and edit pages use: this one sits
// over a photograph, where a border alone disappears. The words come from
// STATUS_LABEL so all three surfaces say the same thing.
const BADGE_COLOUR: Record<ListingStatus, string> = {
  DRAFT: "bg-panel/95 text-warn",
  ACTIVE: "bg-accent text-white",
  SOLD: "bg-panel/95 text-muted",
  RENTED: "bg-panel/95 text-muted",
  EXPIRED: "bg-panel/95 text-muted",
  // Loud on purpose. Every other status here is something the seller did;
  // this one was done to them, and it is the one they have to notice.
  TAKEN_DOWN: "bg-danger text-white",
};

const HouseOutline = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="h-10 w-10 text-line">
    <path
      d="M7 22 24 9l17 13M11 19v20h26V19M20 39V28h8v11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// onStatusChange is optional so the card stays usable on a page that has no
// way to react to the change — without it the card simply offers no
// availability button, rather than offering one that silently lies.
const ListingCard = ({
  listing,
  onStatusChange,
}: {
  listing: ListingSummary;
  onStatusChange?: (next: ListingStatus) => void;
}) => {
  const cover = listing.listingImages?.[0]?.path;
  // Falls back rather than throwing. The status comes from a database enum
  // that can grow at any time, and a missing key used to white-screen the
  // seller's whole listings page over one unknown word.
  const badge = {
    text: STATUS_LABEL[listing.status] ?? listing.status,
    className: BADGE_COLOUR[listing.status] ?? "bg-panel/95 text-muted",
  };

  const facts = [
    typeof listing.bedrooms === "number" && `${listing.bedrooms} bed`,
    typeof listing.bathrooms === "number" && `${listing.bathrooms} bath`,
    `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}`,
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(48,32,68,0.25)] hover:ring-accent/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-ground">
        {cover ? (
          <>
            {/* A blurred copy fills the frame, so the photo itself is never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              className="relative h-full w-full object-contain transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <HouseOutline />
            <span className="text-[13px] text-muted">No photos yet</span>
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[12px] font-semibold shadow-sm ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>

      {/* details */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[13px] font-medium text-accent">
          {labelOf(listing.listingType)} · {labelOf(listing.propertyType)}
        </p>

        {/* The whole card is clickable through this link's stretched overlay. */}
        <h2 className="font-display mt-1 line-clamp-2 text-[17px] leading-snug">
          <Link
            href={`/list/my/listings/${listing.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {listing.title}
          </Link>
        </h2>

        <p className="mt-1 truncate text-[14px] text-muted">
          {[listing.locality, listing.city].filter(Boolean).join(", ")}
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p className="font-display text-[20px] leading-none tabular-nums">
            {formatRupeesShort(listing.price)}
            {isRental(listing.listingType) && (
              <span className="font-sans text-[13px] font-normal text-muted">
                {" "}
                /month
              </span>
            )}
          </p>
          <p className="min-w-0 text-[12.5px] text-muted">
            {facts.join(" · ")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-3 text-[13px]">
          <span className="text-muted">
            Updated {formatTimeAgo(listing.updatedAt)}
          </span>
          {/* Both sit above the card's link overlay so they stay clickable on
              their own; without relative z-10 the stretched title link covers
              them and every tap opens the listing instead. */}
          <div className="relative z-10 flex items-center gap-1">
            {/* Renders nothing on a draft, an expired listing or a taken-down
                one, and owns its own confirmation. */}
            {onStatusChange && (
              <AvailabilityActions
                variant="inline"
                id={listing.id}
                title={listing.title}
                listingType={listing.listingType}
                status={listing.status}
                onChange={onStatusChange}
              />
            )}
            <Link
              href={`/list/my/listings/edit/${listing.id}`}
              className="rounded-lg bg-accent-soft px-2.5 py-1.5 font-medium text-accent transition-colors hover:bg-accent/15"
            >
              {listing.status === "DRAFT" ? "Continue editing" : "Edit"}
            </Link>
          </div>
        </div>
      </div>

      {/* Keyboard focus shows around the whole card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-accent opacity-0 group-has-[a:focus-visible]:opacity-100"
      />
    </article>
  );
};

export default ListingCard;
