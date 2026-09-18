import Link from "next/link";
import { formatNumber, formatRupeesShort, formatTimeAgo } from "@/lib/format";
import { isRental, labelOf } from "@/lib/listing";
import type { ListingStatus, ListingSummary } from "@/lib/types";

const STATUS_BADGE: Record<ListingStatus, { text: string; className: string }> = {
  DRAFT: { text: "Draft", className: "bg-panel/95 text-warn" },
  ACTIVE: { text: "Live", className: "bg-accent text-white" },
  SOLD: { text: "Sold", className: "bg-panel/95 text-muted" },
  RENTED: { text: "Rented", className: "bg-panel/95 text-muted" },
  EXPIRED: { text: "Expired", className: "bg-panel/95 text-muted" },
};

const HouseOutline = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="h-10 w-10 text-line">
    <path d="M7 22 24 9l17 13M11 19v20h26V19M20 39V28h8v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ListingCard = ({ listing }: { listing: ListingSummary }) => {
  const cover = listing.listingImages?.[0]?.path;
  const badge = STATUS_BADGE[listing.status];

  const facts = [
    typeof listing.bedrooms === "number" && `${listing.bedrooms} bed`,
    typeof listing.bathrooms === "number" && `${listing.bathrooms} bath`,
    `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}`,
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-panel ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(13,42,36,0.25)] hover:ring-accent/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-ground">
        {cover ? (
          <>
            {/* A blurred copy fills the frame, so the photo itself is never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
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
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[12px] font-semibold shadow-sm ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      {/* details */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[13px] font-medium text-accent">
          {labelOf(listing.listingType)} · {labelOf(listing.propertyType)}
        </p>

        {/* The whole card is clickable through this link's stretched overlay. */}
        <h2 className="mt-1 line-clamp-2 text-[17px] font-semibold leading-snug">
          <Link href={`/list/my/listings/${listing.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {listing.title}
          </Link>
        </h2>

        <p className="mt-1 truncate text-[14px] text-muted">
          {[listing.locality, listing.city].filter(Boolean).join(", ")}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="font-mono text-[20px] font-medium leading-none tracking-tight">
            {formatRupeesShort(listing.price)}
            {isRental(listing.listingType) && <span className="font-sans text-[13px] font-normal text-muted"> /month</span>}
          </p>
          <p className="shrink-0 text-[12.5px] text-muted">{facts.join(" · ")}</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
          <span className="text-muted">Updated {formatTimeAgo(listing.updatedAt)}</span>
          {/* Sits above the card's link overlay so it stays clickable on its own. */}
          <Link
            href={`/list/my/listings/edit/${listing.id}`}
            className="relative z-10 rounded-md px-2 py-1 font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            {listing.status === "DRAFT" ? "Continue editing" : "Edit"}
          </Link>
        </div>
      </div>

      {/* Keyboard focus shows around the whole card. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-accent opacity-0 group-has-[a:focus-visible]:opacity-100" />
    </article>
  );
};

export default ListingCard;
