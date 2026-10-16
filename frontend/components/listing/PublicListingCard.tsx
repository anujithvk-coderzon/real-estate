import Link from "next/link";
import TypeGlyph from "@/components/public/TypeGlyph";
import { formatDate, formatNumber, formatRupeesShort } from "@/lib/format";
import { TYPE_COLOUR, isRental, labelOf } from "@/lib/listing";
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

// "650 m" or "2.4 km"
const formatDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`;

// A listing as buyers see it: photograph, what it is, where, what it has, what
// it costs. The colour dot before the type is the same colour the property's pin
// takes on the map, so a card and its pin are recognisably the same thing.
const PublicListingCard = ({
  listing,
  showMode = true,
  highlighted = false,
  onHoverChange,
}: Props) => {
  const cover = listing.listingImages?.[0]?.path;

  // The three figures people line up across cards, on their own ruled row.
  const details = [
    typeof listing.bedrooms === "number" && `${listing.bedrooms} beds`,
    typeof listing.bathrooms === "number" && `${listing.bathrooms} baths`,
    listing.areaValue &&
      `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit).toLowerCase()}`,
  ].filter(Boolean) as string[];

  const place = [listing.locality, listing.city].filter(Boolean).join(", ");

  return (
    <article
      onMouseEnter={onHoverChange && (() => onHoverChange(true))}
      onMouseLeave={onHoverChange && (() => onHoverChange(false))}
      // Lifts 4px on approach with the shadow directly beneath it. No scale: a
      // photograph that grows on hover crops itself, and the price moves.
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl bg-panel ring-1 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_32px_-16px_rgba(48,32,68,0.28)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        highlighted
          ? "shadow-[0_14px_32px_-16px_rgba(48,32,68,0.28)] ring-2 ring-accent"
          : "ring-line"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ground">
        {cover ? (
          <>
            {/* A blurred copy fills the frame, so the photo itself is never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
              className="relative h-full w-full object-contain"
            />
          </>
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center gap-1">
            <div
              aria-hidden="true"
              className="survey-grid pointer-events-none absolute inset-0"
            />
            <TypeGlyph
              type={listing.propertyType}
              className="relative h-14 w-14 text-muted"
            />
            <span className="relative text-[12px] text-muted">
              No photographs
            </span>
          </div>
        )}
        {showMode && (
          <span className="absolute left-3 top-3 rounded-lg bg-panel/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink backdrop-blur-sm">
            {listing.listingType === "SALE"
              ? "For sale"
              : listing.listingType === "PG"
                ? "PG"
                : "For rent"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* The type, with the colour its pin wears on the map. */}
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
          <span
            aria-hidden="true"
            style={{ background: TYPE_COLOUR[listing.propertyType] }}
            className="h-[7px] w-[7px] shrink-0 rounded-full"
          />
          {labelOf(listing.propertyType)}
        </p>

        <h3 className="mt-2 truncate text-[15px] font-semibold text-ink">
          {listing.slug ? (
            // The link's overlay makes the whole card clickable.
            <Link
              href={`/property/${listing.slug}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
              title={listing.title}
            >
              {listing.title}
            </Link>
          ) : (
            listing.title
          )}
        </h3>

        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
          <span aria-hidden="true">&#8982;</span>
          <span className="min-w-0 truncate">{place}</span>
          {typeof listing.distanceKm === "number" && (
            <span className="shrink-0 tabular-nums">
              &middot; {formatDistance(listing.distanceKm)}
              <span className="sr-only"> from the searched place</span>
            </span>
          )}
        </p>

        {details.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-b border-line pb-3 text-[12px] text-muted">
            {details.map((item) => (
              <span key={item} className="tabular-nums">
                {item}
              </span>
            ))}
          </p>
        )}

        {/* Who listed it and when: buyers use both to judge how fresh it is. */}
        <p className="mt-2.5 text-[11px] text-muted">
          {labelOf(listing.postedBy)} &middot;{" "}
          <time dateTime={listing.createdAt} className="tabular-nums">
            {formatDate(listing.createdAt)}
          </time>
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <p className="text-[19px] font-bold leading-none tabular-nums text-ink">
            {formatRupeesShort(listing.price)}
            {isRental(listing.listingType) && (
              <span className="text-[12px] font-normal text-muted">
                {" "}
                /month
              </span>
            )}
          </p>
          {/* Not a second link — the card is already one. A visual affordance
              that the card opens, which slides on approach. */}
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          >
            &#8599;
          </span>
        </div>
      </div>
    </article>
  );
};

export default PublicListingCard;
