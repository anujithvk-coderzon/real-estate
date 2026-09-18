import Link from "next/link";
import { formatNumber, formatRupeesShort } from "@/lib/format";
import { isRental, labelOf } from "@/lib/listing";
import type { PublicListingSummary } from "@/lib/types";

const HouseOutline = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="h-10 w-10 text-line">
    <path d="M7 22 24 9l17 13M11 19v20h26V19M20 39V28h8v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A listing as buyers see it: no status, no owner actions.
const PublicListingCard = ({ listing }: { listing: PublicListingSummary }) => {
  const cover = listing.listingImages?.[0]?.path;

  const facts = [
    typeof listing.bedrooms === "number" && `${listing.bedrooms} bed`,
    typeof listing.bathrooms === "number" && `${listing.bathrooms} bath`,
    `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}`,
  ].filter(Boolean);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(13,42,36,0.25)] hover:ring-accent/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[4/3] overflow-hidden bg-ground">
        {cover ? (
          <>
            {/* A blurred copy fills the frame, so the photo itself is never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={listing.title} loading="lazy" className="relative h-full w-full object-contain" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <HouseOutline />
            <span className="text-[13px] text-muted">No photos</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-panel/95 px-2.5 py-1 text-[12px] font-semibold text-accent shadow-sm">
          {labelOf(listing.listingType)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="font-mono text-[22px] font-medium leading-none tracking-tight">
          {formatRupeesShort(listing.price)}
          {isRental(listing.listingType) && <span className="font-sans text-[13px] font-normal text-muted"> /month</span>}
        </p>
        <h2 className="mt-2 line-clamp-2 text-[16px] font-semibold leading-snug">
          {listing.slug ? (
            // The link's overlay makes the whole card clickable.
            <Link href={`/property/${listing.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {listing.title}
            </Link>
          ) : (
            listing.title
          )}
        </h2>
        <p className="mt-1 truncate text-[14px] text-muted">
          {[listing.locality, listing.city].filter(Boolean).join(", ")}
        </p>
        <p className="mt-auto pt-4 text-[13px] text-muted">
          {labelOf(listing.propertyType)} · {facts.join(" · ")}
        </p>
      </div>
    </article>
  );
};

export default PublicListingCard;
