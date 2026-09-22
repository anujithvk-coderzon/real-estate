import Link from "next/link";
import { formatNumber, formatRupeesShort } from "@/lib/format";
import { isRental, labelOf } from "@/lib/listing";
import type { PublicListingSummary } from "@/lib/types";

type Props = {
  listing: PublicListingSummary;
  // Search results already say "for sale" in the heading, so the badge would repeat it.
  showMode?: boolean;
  // Search results: the card whose pin is hovered or selected on the map.
  highlighted?: boolean;
  // Search results: tell the map which card the pointer is on.
  onHoverChange?: (hovered: boolean) => void;
};

const HouseOutline = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="h-9 w-9 text-line">
    <path d="M7 22 24 9l17 13M11 19v20h26V19M20 39V28h8v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// "650 m" or "2.4 km"
const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`);

// A listing as buyers see it. Ordered by what people compare first:
// photo → price → size and rooms → title → where it is.
const PublicListingCard = ({ listing, showMode = true, highlighted = false, onHoverChange }: Props) => {
  const cover = listing.listingImages?.[0]?.path;

  // "Apartment · 3 bd · 2 ba · 1,450 sq ft": the numbers people line up across cards.
  const specs = [
    labelOf(listing.propertyType),
    typeof listing.bedrooms === "number" && `${listing.bedrooms} bd`,
    typeof listing.bathrooms === "number" && `${listing.bathrooms} ba`,
    listing.areaValue && `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}`,
  ].filter(Boolean);

  const place = [listing.locality, listing.city].filter(Boolean).join(", ");

  return (
    <article
      onMouseEnter={onHoverChange && (() => onHoverChange(true))}
      onMouseLeave={onHoverChange && (() => onHoverChange(false))}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl bg-panel ring-1 transition-shadow duration-150 hover:shadow-[0_8px_24px_-12px_rgba(13,42,36,0.35)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent ${
        highlighted ? "shadow-[0_8px_24px_-12px_rgba(13,42,36,0.35)] ring-2 ring-accent" : "ring-line"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ground">
        {cover ? (
          <>
            {/* A blurred copy fills the frame, so the photo itself is never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" loading="lazy" decoding="async" className="relative h-full w-full object-contain" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <HouseOutline />
            <span className="text-[12px] text-muted">No photos yet</span>
          </div>
        )}
        {showMode && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-panel/95 px-2 py-0.5 text-[12px] font-semibold text-accent">
            {labelOf(listing.listingType)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <p className="text-[20px] font-semibold leading-none tracking-tight tabular-nums">
          {formatRupeesShort(listing.price)}
          {isRental(listing.listingType) && <span className="text-[13px] font-normal text-muted"> /month</span>}
        </p>
        <p className="mt-1.5 truncate text-[14px] text-ink">{specs.join(" · ")}</p>

        <h3 className="mt-2 truncate text-[14px] font-medium text-muted">
          {listing.slug ? (
            // The link's overlay makes the whole card clickable.
            <Link href={`/property/${listing.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none" title={listing.title}>
              {listing.title}
            </Link>
          ) : (
            listing.title
          )}
        </h3>

        <p className="mt-auto flex items-center gap-1.5 pt-2 text-[13px] text-muted">
          <span className="truncate">{place}</span>
          {typeof listing.distanceKm === "number" && (
            <span className="shrink-0 rounded bg-ground px-1.5 py-px text-[12px] tabular-nums">
              {formatDistance(listing.distanceKm)}
              <span className="sr-only"> from the searched place</span>
            </span>
          )}
        </p>
      </div>
    </article>
  );
};

export default PublicListingCard;
