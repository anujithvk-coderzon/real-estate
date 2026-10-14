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

// The reference's own photographs and category colours, mapped onto the types
// this app actually has. Its set has no office, so the commercial photograph
// stands in for both — the alternative is a seventh picture that does not match
// the other six.
//
// Hotlinked from Unsplash, exactly as the reference does. Worth knowing what
// that costs: the images are not yours, they are not optimised by Next, and the
// cards are blank if Unsplash is unreachable. For production these want to be
// downloaded, compressed and served from your own CDN.
const CATEGORY_PHOTO: Record<string, string> = {
  APARTMENT: "photo-1600585154340-be6161a56a0c",
  INDEPENDENT_HOUSE: "photo-1600596542815-ffad4c1539a9",
  VILLA: "photo-1613490493576-7fde63acd811",
  PLOT: "photo-1500382017468-9049fed747ef",
  COMMERCIAL: "photo-1497366754035-f200968a6e72",
  OFFICE: "photo-1497366754035-f200968a6e72",
  ROOM: "photo-1522708323590-d24dbb6b0267",
};

export const categoryPhoto = (propertyType: string, width = 350) =>
  `https://images.unsplash.com/${CATEGORY_PHOTO[propertyType] ?? CATEGORY_PHOTO.INDEPENDENT_HOUSE}?auto=format&fit=crop&w=${width}&q=85`;

// A colour per type, from the reference's legend. Used for the dot on a card and
// — once the search map gets it — to colour its pins, so the same property type
// is the same colour wherever it appears.
export const TYPE_COLOUR: Record<string, string> = {
  APARTMENT: "#648ad0",
  INDEPENDENT_HOUSE: "#8257bc",
  VILLA: "#a582b9",
  PLOT: "#a489ba",
  COMMERCIAL: "#d18c76",
  OFFICE: "#d7a352",
  ROOM: "#68a7ae",
};

export const POSTED_BY: Option[] = [
  { value: "OWNER", label: "Owner" },
  { value: "BROKER", label: "Broker or dealer" },
  { value: "BUILDER", label: "Builder" },
];

// How far from the searched place to look. The search page only: the home page
// has no place to measure from. An empty value means the API's own default of
// 10 km, which is why 10 is not in this list — it is the "no choice" choice,
// so an old shared link with no radius keeps returning what it always did.
export const RADIUS_OPTIONS: Option[] = [
  { value: "20", label: "20 km" },
  { value: "30", label: "30 km" },
  { value: "40", label: "40 km" },
  { value: "50", label: "50 km" },
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
  [
    LISTING_TYPES,
    PROPERTY_TYPES,
    POSTED_BY,
    FURNISHING,
    PROPERTY_STATUS,
    AREA_UNITS,
  ]
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
export const amenityCategoriesFor = (
  listingType: string,
  propertyType: string,
) => {
  if (propertyType === "") return [];
  if (propertyType === "PLOT") return ["PLOT"];
  if (listingType === "PG")
    return ["PG", "UNIT", "BUILDING", "SECURITY", "PARKING"];
  if (propertyType === "COMMERCIAL" || propertyType === "OFFICE") {
    return ["COMMERCIAL", "BUILDING", "SECURITY", "PARKING"];
  }
  if (propertyType === "ROOM")
    return ["UNIT", "BUILDING", "SECURITY", "PARKING"];
  return ["UNIT", "BUILDING", "SECURITY", "PARKING", "RECREATION"];
};

// Shown when no location is known, so the whole country is visible.
export const INDIA_CENTER: LngLat = [78.9629, 20.5937];

// Same factors as backend/src/lib/area.ts.
export const SQFT_PER_UNIT = {
  SQFT: 1,
  SQM: 10.7639,
  CENT: 435.6,
  ACRE: 43560,
};

/* ---------- rules (mirror backend/src/modules/listings/listing.validation.ts) ---------- */

export const isRental = (listingType: string) =>
  listingType === "RENT" || listingType === "PG";

export const isResidential = (propertyType: string) =>
  ["APARTMENT", "INDEPENDENT_HOUSE", "VILLA", "ROOM"].includes(propertyType);

export const hasFloorNumber = (propertyType: string) =>
  ["APARTMENT", "OFFICE", "COMMERCIAL", "ROOM"].includes(propertyType);

// A plot can only be sold.
// Budgets only make sense within one kind of price: a sale price and a monthly
// rent can't share a scale, so each listing type gets its own ladder.
export const BUDGETS: Record<string, number[]> = {
  SALE: [
    25_00_000, 50_00_000, 75_00_000, 1_00_00_000, 2_00_00_000, 5_00_00_000,
  ],
  RENT: [10_000, 20_000, 30_000, 50_000, 1_00_000],
  PG: [5_000, 8_000, 12_000, 20_000],
};

/* ---------- the budget slider's scale ---------- */

// A budget runs from a ₹1,000 room to a ₹100 Cr estate — five orders of magnitude.
// Spread that evenly along a track and every listing in Kerala lands in its first
// few pixels, where one pixel of drag is worth lakhs.
//
// So each step is the same PERCENTAGE rather than the same number of rupees. Over
// 100 steps that is about 15% per step, which is as precise at ₹12,000 as it is
// at ₹12 Cr, and one scale then serves rents and sale prices alike.
export const BUDGET_MIN = 1_000;
export const BUDGET_MAX = 1_00_00_00_000;
export const BUDGET_STEPS = 100;

// Two significant figures, so the slider lands on ₹23,000 and not ₹23,148.
const roundToTwoFigures = (value: number) => {
  const unit = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / unit) * unit;
};

// Position 0 means no ceiling at all; 1..BUDGET_STEPS walk the scale.
export const budgetAt = (position: number) =>
  position <= 0
    ? 0
    : roundToTwoFigures(
        BUDGET_MIN * (BUDGET_MAX / BUDGET_MIN) ** (position / BUDGET_STEPS),
      );

// The inverse, for restoring the thumb from a URL.
export const budgetPosition = (amount: number) =>
  amount <= BUDGET_MIN
    ? 0
    : Math.min(
        BUDGET_STEPS,
        Math.round(
          (BUDGET_STEPS * Math.log(amount / BUDGET_MIN)) /
            Math.log(BUDGET_MAX / BUDGET_MIN),
        ),
      );

// Bedrooms mean nothing for these.
export const NO_BEDROOMS = ["PLOT", "COMMERCIAL", "OFFICE"];

export const listingTypeOptions = (propertyType: string) =>
  propertyType === "PLOT"
    ? LISTING_TYPES.filter((o) => o.value === "SALE")
    : LISTING_TYPES;

// A PG can only be a room, apartment or house; a plot cannot be rented.
export const propertyTypeOptions = (listingType: string) => {
  if (listingType === "PG") {
    return PROPERTY_TYPES.filter((o) =>
      ["ROOM", "APARTMENT", "INDEPENDENT_HOUSE"].includes(o.value),
    );
  }
  if (listingType === "RENT")
    return PROPERTY_TYPES.filter((o) => o.value !== "PLOT");
  return PROPERTY_TYPES;
};

export const floorsInconsistent = (data: ListingFormData) =>
  data.floorNumber !== "" &&
  data.totalFloors !== "" &&
  Number(data.floorNumber) > Number(data.totalFloors);

// Hiding a field does not empty it. Clear fields that no longer apply, or the
// payload carries a value the broker cannot see and the backend rejects it.
export const clearInapplicableFields = (
  data: ListingFormData,
): ListingFormData => ({
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
export const getMissingFields = (
  data: ListingFormData,
  location: LngLat | null,
) => {
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
const numberOrUndefined = (value: string) =>
  value === "" ? undefined : Number(value);
const textOrUndefined = (value: string) => value.trim() || undefined;

export const buildListingPayload = (
  data: ListingFormData,
  location: LngLat | null,
) => ({
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

export const listingLocation = (
  listing: Pick<Listing, "latitude" | "longitude">,
): LngLat | null =>
  listing.latitude !== null && listing.longitude !== null
    ? [listing.longitude, listing.latitude]
    : null;
