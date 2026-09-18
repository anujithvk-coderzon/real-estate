import type { Listing, ListingFormData, LngLat } from "@/lib/types";

/* ---------- choices (values match the Prisma enums) ---------- */

export type Option = { value: string; label: string };

export const LISTING_TYPES: Option[] = [
  { value: "SALE", label: "For sale" },
  { value: "RENT", label: "For rent" },
  { value: "PG", label: "PG or hostel" },
];

export const PROPERTY_TYPES: Option[] = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "INDEPENDENT_HOUSE", label: "Independent house" },
  { value: "VILLA", label: "Villa" },
  { value: "PLOT", label: "Plot or land" },
  { value: "COMMERCIAL", label: "Commercial space" },
  { value: "OFFICE", label: "Office" },
  { value: "ROOM", label: "Room" },
];

export const POSTED_BY: Option[] = [
  { value: "OWNER", label: "Owner" },
  { value: "BROKER", label: "Broker" },
  { value: "BUILDER", label: "Builder" },
  { value: "DEALER", label: "Dealer" },
];

export const FURNISHING: Option[] = [
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI_FURNISHED", label: "Semi furnished" },
  { value: "FULLY_FURNISHED", label: "Fully furnished" },
];

export const PROPERTY_STATUS: Option[] = [
  { value: "READY_TO_MOVE", label: "Ready to move" },
  { value: "UNDER_CONSTRUCTION", label: "Under construction" },
];

export const AREA_UNITS: Option[] = [
  { value: "SQFT", label: "sq ft" },
  { value: "SQM", label: "sq m" },
  { value: "CENT", label: "cent" },
  { value: "ACRE", label: "acre" },
];

const LABELS: Record<string, string> = Object.fromEntries(
  [LISTING_TYPES, PROPERTY_TYPES, POSTED_BY, FURNISHING, PROPERTY_STATUS, AREA_UNITS]
    .flat()
    .map((option) => [option.value, option.label]),
);

export const labelOf = (value: string | null | undefined) =>
  value ? (LABELS[value] ?? value) : "";

const AMENITY_CATEGORY_LABELS: Record<string, string> = {
  BUILDING: "Building",
  SECURITY: "Security",
  PARKING: "Parking",
  RECREATION: "Recreation",
  UNIT: "Inside the unit",
  PLOT: "Plot",
  COMMERCIAL: "Commercial",
  PG: "PG",
};

export const amenityCategoryLabel = (category: string) =>
  AMENITY_CATEGORY_LABELS[category] ?? category;

// Amenity categories that make sense for a listing, so a plot is not offered
// a lift and an office is not offered a swimming pool.
export const amenityCategoriesFor = (listingType: string, propertyType: string) => {
  if (propertyType === "") return [];
  if (propertyType === "PLOT") return ["PLOT"];
  if (listingType === "PG") return ["PG", "UNIT", "BUILDING", "SECURITY", "PARKING"];
  if (propertyType === "COMMERCIAL" || propertyType === "OFFICE") {
    return ["COMMERCIAL", "BUILDING", "SECURITY", "PARKING"];
  }
  if (propertyType === "ROOM") return ["UNIT", "BUILDING", "SECURITY", "PARKING"];
  return ["UNIT", "BUILDING", "SECURITY", "PARKING", "RECREATION"];
};

// Shown when no location is known, so the whole country is visible.
export const INDIA_CENTER: LngLat = [78.9629, 20.5937];

// Same factors as backend/src/lib/area.ts.
export const SQFT_PER_UNIT = { SQFT: 1, SQM: 10.7639, CENT: 435.6, ACRE: 43560 };

/* ---------- rules (mirror backend/src/modules/listings/listing.validation.ts) ---------- */

export const isRental = (listingType: string) =>
  listingType === "RENT" || listingType === "PG";

export const isResidential = (propertyType: string) =>
  ["APARTMENT", "INDEPENDENT_HOUSE", "VILLA", "ROOM"].includes(propertyType);

export const hasFloorNumber = (propertyType: string) =>
  ["APARTMENT", "OFFICE", "COMMERCIAL", "ROOM"].includes(propertyType);

// A plot can only be sold.
export const listingTypeOptions = (propertyType: string) =>
  propertyType === "PLOT" ? LISTING_TYPES.filter((o) => o.value === "SALE") : LISTING_TYPES;

// A PG can only be a room, apartment or house; a plot cannot be rented.
export const propertyTypeOptions = (listingType: string) => {
  if (listingType === "PG") {
    return PROPERTY_TYPES.filter((o) => ["ROOM", "APARTMENT", "INDEPENDENT_HOUSE"].includes(o.value));
  }
  if (listingType === "RENT") return PROPERTY_TYPES.filter((o) => o.value !== "PLOT");
  return PROPERTY_TYPES;
};

export const floorsInconsistent = (data: ListingFormData) =>
  data.floorNumber !== "" &&
  data.totalFloors !== "" &&
  Number(data.floorNumber) > Number(data.totalFloors);

// Hiding a field does not empty it. Clear fields that no longer apply, or the
// payload carries a value the broker cannot see and the backend rejects it.
export const clearInapplicableFields = (data: ListingFormData): ListingFormData => ({
  ...data,
  ...(data.listingType === "SALE" && { securityDeposit: "", maintenance: "" }),
  ...(data.listingType !== "SALE" && { propertyStatus: "" }),
  ...(data.propertyType === "PLOT" && {
    bedrooms: "",
    bathrooms: "",
    balconies: "",
    furnishing: "",
    floorNumber: "",
    totalFloors: "",
  }),
});

// Names of required fields that are still empty or invalid.
export const getMissingFields = (data: ListingFormData, location: LngLat | null) => {
  const residential = isResidential(data.propertyType);
  const rental = isRental(data.listingType);

  const checks: [string, boolean][] = [
    ["listing type", data.listingType !== ""],
    ["property type", data.propertyType !== ""],
    ["who is posting", data.postedBy !== ""],
    ["title", data.title.trim() !== ""],
    ["description", data.description.trim() !== ""],
    ["price", data.price !== ""],
    ["area", data.areaValue !== ""],
    ["bedrooms", !residential || data.bedrooms !== ""],
    ["bathrooms", !residential || data.bathrooms !== ""],
    ["security deposit", !rental || data.securityDeposit !== ""],
    ["property name or number", data.addressLine.trim() !== ""],
    ["locality", data.locality.trim() !== ""],
    ["city", data.city.trim() !== ""],
    ["district", data.district.trim() !== ""],
    ["state", data.state.trim() !== ""],
    ["pincode", /^\d{6}$/.test(data.pincode)],
    ["a pin on the map", location !== null],
    ["floors to be consistent", !floorsInconsistent(data)],
  ];

  return checks.filter(([, ok]) => !ok).map(([name]) => name);
};

/* ---------- converting between the form and the API ---------- */

// Empty optional fields are sent as undefined, which JSON drops — the backend's
// .optional() rejects an empty string.
const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));
const textOrUndefined = (value: string) => value.trim() || undefined;

export const buildListingPayload = (data: ListingFormData, location: LngLat | null) => ({
  title: data.title.trim(),
  description: data.description.trim(),
  listingType: data.listingType,
  propertyType: data.propertyType,
  postedBy: data.postedBy,

  price: Number(data.price),
  isNegotiable: data.isNegotiable,
  securityDeposit: numberOrUndefined(data.securityDeposit),
  maintenance: numberOrUndefined(data.maintenance),

  areaValue: Number(data.areaValue),
  areaUnit: data.areaUnit,

  bedrooms: numberOrUndefined(data.bedrooms),
  bathrooms: numberOrUndefined(data.bathrooms),
  balconies: numberOrUndefined(data.balconies),
  furnishing: data.furnishing || undefined,
  floorNumber: numberOrUndefined(data.floorNumber),
  totalFloors: numberOrUndefined(data.totalFloors),
  propertyStatus: data.propertyStatus || undefined,
  availableFrom: data.availableFrom || undefined,

  addressLine: data.addressLine.trim(),
  landmark: textOrUndefined(data.landmark),
  locality: data.locality.trim(),
  city: data.city.trim(),
  district: data.district.trim(),
  state: data.state.trim(),
  pincode: data.pincode,
  latitude: location?.[1],
  longitude: location?.[0],

  contactName: textOrUndefined(data.contactName),
  contactPhone: textOrUndefined(data.contactPhone),

  amenityIds: data.amenityIds,
});

// "4500000.00" → "4500000", null → ""
const toInputText = (value: string | number | null) =>
  value === null ? "" : String(Number(value));

export const listingToFormData = (listing: Listing): ListingFormData => ({
  title: listing.title,
  description: listing.description,
  listingType: listing.listingType,
  propertyType: listing.propertyType,
  postedBy: listing.postedBy,
  price: toInputText(listing.price),
  isNegotiable: listing.isNegotiable,
  securityDeposit: toInputText(listing.securityDeposit),
  maintenance: toInputText(listing.maintenance),
  areaValue: toInputText(listing.areaValue),
  areaUnit: listing.areaUnit,
  bedrooms: toInputText(listing.bedrooms),
  bathrooms: toInputText(listing.bathrooms),
  balconies: toInputText(listing.balconies),
  furnishing: listing.furnishing ?? "",
  floorNumber: toInputText(listing.floorNumber),
  totalFloors: toInputText(listing.totalFloors),
  propertyStatus: listing.propertyStatus ?? "",
  availableFrom: listing.availableFrom?.slice(0, 10) ?? "",
  contactName: listing.contactName ?? "",
  contactPhone: listing.contactPhone ?? "",
  addressLine: listing.addressLine,
  landmark: listing.landmark ?? "",
  locality: listing.locality,
  city: listing.city,
  district: listing.district,
  state: listing.state,
  pincode: listing.pincode,
  amenityIds: listing.amenities.map((amenity) => amenity.id),
});

export const listingLocation = (listing: Pick<Listing, "latitude" | "longitude">): LngLat | null =>
  listing.latitude !== null && listing.longitude !== null
    ? [listing.longitude, listing.latitude]
    : null;
