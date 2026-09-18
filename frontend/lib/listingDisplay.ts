import { formatDate, formatNumber } from "@/lib/format";
import { labelOf } from "@/lib/listing";
import type { PublicListing } from "@/lib/types";

// Rows for the listing pages, shared by the owner's page and the public one.
// They take PublicListing, the smaller shape, so a full Listing works too.

type Row = [label: string, value: string | undefined];

// Keeps only the rows that have a value, so empty fields are not shown.
export const withValues = (rows: Row[]) => rows.filter((row): row is [string, string] => Boolean(row[1]));

// The headline numbers under the title.
export const keyFacts = (listing: PublicListing) =>
  withValues([
    ["Area", `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}`],
    ["Bedrooms", listing.bedrooms?.toString()],
    ["Bathrooms", listing.bathrooms?.toString()],
    ["Furnishing", labelOf(listing.furnishing)],
  ]);

// Everything else worth showing in the Details section.
export const detailRows = (listing: PublicListing) => {
  const { floorNumber, totalFloors } = listing;
  const floor =
    floorNumber !== null && totalFloors !== null
      ? `${floorNumber} of ${totalFloors}`
      : (floorNumber ?? totalFloors)?.toString();

  return withValues([
    ["Area in sq ft", listing.areaUnit === "SQFT" ? undefined : `${formatNumber(listing.areaSqft)} sq ft`],
    ["Balconies", listing.balconies?.toString()],
    [floorNumber === null ? "Total floors" : "Floor", floor],
    ["Construction", labelOf(listing.propertyStatus)],
    ["Available from", formatDate(listing.availableFrom)],
  ]);
};

type Amenity = PublicListing["amenities"][number];

export const groupAmenities = <T extends Amenity>(amenities: T[]) => {
  const groups: Record<string, T[]> = {};
  for (const amenity of amenities) (groups[amenity.category] ??= []).push(amenity);
  return groups;
};

export const googleMapsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
