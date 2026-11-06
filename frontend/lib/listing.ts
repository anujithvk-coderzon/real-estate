import type {
  Listing,
  ListingFormData,
  ListingStatus,
  LngLat,
} from "@/lib/types";

/* ---------- choices (values match the Prisma enums) ---------- */

export type Option = { value: string; label: string };

// Every mode a property can be listed under. The create and edit forms use
// this: an owner has to say which one they are putting up.
export const LISTING_TYPES: Option[] = [
  { value: "SALE", label: "For sale" },
  { value: "RENT", label: "For rent" },
  { value: "PG", label: "PG or hostel" },
];

// What a searcher is offered. Rent still returns PG listings — the API's
// rentCoversPg turns listingType=RENT into { in: ["RENT", "PG"] } — so the two
// overlap deliberately: Rent is "somewhere to live, monthly", PG narrows that
// to shared rooms and hostels. The labels have to say so, or picking Rent and
// finding a hostel in the results reads as a bug.
export const SEARCH_LISTING_TYPES: Option[] = [
  { value: "SALE", label: "For sale" },
  { value: "RENT", label: "For rent or PG" },
];

// The same two, in the words a button row can carry. One list, because the
// hero had this as `option.value === "SALE" ? "Buy" : "Rent"` in two places —
// a ternary that labels anything that is not SALE as "Rent", which is fragile
// even with two and wrong the moment a third value reaches it, as PG now does.
export const SEARCH_MODES: Option[] = [
  { value: "SALE", label: "Buy" },
  { value: "RENT", label: "Rent" },
];

// ---------------------------------------------------------------------------
// PG, and why it is in the type list rather than beside Buy and Rent.
//
// In the data PG is a listingType, next to SALE and RENT — a tenure, not a
// kind of building. But nobody shops that way: a PG is always a rent, so a
// third tab asks a question that is really already answered, while the thing
// someone is actually choosing between is "a flat, a house, or a PG". So it is
// offered where the building types are, and these three helpers translate
// between the one control and the two parameters underneath it.
// ---------------------------------------------------------------------------
export const PG_TYPE = "PG";

// What the type select offers. Not under Buy — you cannot purchase a
// paying-guest arrangement — and PG's own building types are Rent's, since the
// mode underneath is a narrowing of RENT.
export const searchTypeOptions = (
  listingType: string,
  // What is chosen right now, so the one alternative that overlaps it can be
  // left out — see below.
  chosen = "",
): Option[] => {
  const kinds = propertyTypeOptions(
    listingType === PG_TYPE ? "RENT" : listingType,
    SEARCH_PROPERTY_TYPES,
  );
  // Room and PG are the two ways of renting part of a home, and offering both
  // at once invites the question "what is the difference" at the exact moment
  // the answer does not matter. So whichever is chosen, the other steps out:
  // Room means a place of your own, PG means a bed and a landlord's household.
  const withoutRoom = chosen === PG_TYPE;
  const withoutPg = chosen === "ROOM";
  const list = withoutRoom ? kinds.filter((o) => o.value !== "ROOM") : kinds;
  return listingType === "SALE" || withoutPg
    ? list
    : [...list, { value: PG_TYPE, label: "PG or hostel" }];
};

// What a listing counts as on the map and in its legend. PG is a tenure in the
// data, so a PG room would otherwise be drawn and listed as "Room" — the one
// thing this app says it is not.
export const categoryOf = (listing: {
  listingType?: string | null;
  propertyType?: string | null;
}) =>
  listing.listingType === PG_TYPE ? PG_TYPE : (listing.propertyType ?? "");

// What that select shows: the tenure wins, because when it is PG the building
// type is deliberately empty.
export const typeSelectValue = (listingType: string, propertyType: string) =>
  listingType === PG_TYPE ? PG_TYPE : propertyType;

// What the two parameters become when it changes. Choosing PG sets the tenure
// and clears the building type; choosing a building type while PG is on widens
// the tenure back to RENT rather than leaving a PG filter nobody can see.
export const typeChoice = (
  value: string,
  listingType: string,
): Record<string, string> =>
  value === PG_TYPE
    ? { listingType: PG_TYPE, propertyType: "" }
    : {
        propertyType: value,
        ...(listingType === PG_TYPE ? { listingType: "RENT" } : {}),
      };

// What the Buy/Rent group shows. PG is a rent, so Rent stays lit — two
// controls describing one search instead of disagreeing about it.
export const modeSelectValue = (listingType: string) =>
  listingType === PG_TYPE ? "RENT" : listingType;

export const PROPERTY_TYPES: Option[] = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "INDEPENDENT_HOUSE", label: "Independent house" },
  { value: "VILLA", label: "Villa" },
  { value: "PLOT", label: "Plot or land" },
  { value: "COMMERCIAL", label: "Commercial space" },
  { value: "OFFICE", label: "Office" },
  { value: "ROOM", label: "Room" },
];

// The legend's vocabulary: every property type, plus PG. Declared here rather
// than beside the other PG helpers because a const cannot spread a list that
// the file has not reached yet.
export const CATEGORY_OPTIONS: Option[] = [
  ...PROPERTY_TYPES,
  { value: PG_TYPE, label: "PG or hostel" },
];

// What a searcher is offered: six, not seven. Somebody looking for premises to
// work from does not reliably separate a shop unit from an office suite, and
// two adjacent choices that mean nearly the same thing cost a decision instead
// of making one.
//
// The database keeps both. A seller still says which they have, and a listing
// still reads "Office" on its own page — so this merges the question, not the
// data. Exactly the split LISTING_TYPES and SEARCH_LISTING_TYPES already make
// for PG.
//
// Choosing it sends propertyType=COMMERCIAL. Widening that to both values is
// the API's job, the mirror of what rentCoversPg already does for RENT.
export const SEARCH_PROPERTY_TYPES: Option[] = PROPERTY_TYPES.filter(
  (option) => option.value !== "OFFICE",
).map((option) =>
  option.value === "COMMERCIAL"
    ? { value: "COMMERCIAL", label: "Commercial or office" }
    : option,
);

// One photograph per type, and each one has to show THAT type — a card is a
// label with a picture on it, so a picture of the wrong thing is a mislabelled
// card. The reference's set was close but not ours: it had no office, so one
// office photograph stood in for both Office and Commercial, and its apartment
// card was a detached house. Every one of these was looked at before it was
// chosen, not picked by filename.
//
// Hotlinked from Unsplash. Worth knowing what that costs: the images are not
// yours, they are not optimised by Next, and the cards are blank if Unsplash is
// unreachable. For production these want to be downloaded, compressed and
// served from your own CDN.
const CATEGORY_PHOTO: Record<string, string> = {
  // A block of flats with balconies, not a house — this is the one the
  // reference got wrong, and Apartment is the commonest type on the site.
  APARTMENT: "photo-1545324418-cc1a3fa10c00",
  // A single modern house on its own plot: one family, its own walls.
  INDEPENDENT_HOUSE: "photo-1600585154340-be6161a56a0c",
  // The pool and the scale are what separate a villa from the house above.
  VILLA: "photo-1613490493576-7fde63acd811",
  // Open land with nothing built on it, which is the whole point of the type.
  PLOT: "photo-1500382017468-9049fed747ef",
  // A shopfront interior with stock on the shelves — a place that sells to the
  // public, which is what Commercial means here.
  COMMERCIAL: "photo-1441986300917-64674bd600d8",
  // Glazed partitions and a working floor: somewhere staff sit, not somewhere
  // customers walk in. The distinction Commercial used to blur.
  OFFICE: "photo-1497366754035-f200968a6e72",
  // A single furnished room, which is what a PG or a let room is.
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
  // A PG is not a room with a different label on it — one is a tenancy of your
  // own, the other is a bed in a run household — so it gets its own colour on
  // the map and its own line in the legend, like every other category.
  //
  // Rose, not the green this started as. Room is #68a7ae, a teal, and a green
  // beside it was two colours you had to hold next to each other to tell
  // apart — on 28px pins scattered across a map, nobody does that. These two
  // are the pair most likely to appear together and the pair a reader most
  // needs to separate, so they are put at opposite ends of the wheel: teal
  // against rose. It also stays clear of the purples, which differ from it in
  // hue, and of the terracotta, which differs in saturation.
  PG: "#b2578b",
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

// What to call a listing on a public surface. A PG is stored with
// propertyType: ROOM, so labelOf(propertyType) alone calls it "Room" — the one
// thing the search now insists it is not. Pairs with categoryOf, which decides
// the same question for the map's pin colours and its legend.
export const categoryLabel = (listing: {
  listingType?: string | null;
  propertyType?: string | null;
}) => labelOf(categoryOf(listing));

// The same values as the SEARCH surfaces name them. One bar must not carry a
// chip reading "Commercial space" beside a select reading "Commercial or
// office" — that is the same disagreement the PG filter had. Falls through to
// labelOf, which is what every other screen keeps using: a listing of type
// OFFICE still says "Office" on its own page.
const SEARCH_LABELS: Record<string, string> = Object.fromEntries(
  [SEARCH_LISTING_TYPES, SEARCH_PROPERTY_TYPES]
    .flat()
    .map((option) => [option.value, option.label]),
);

export const searchLabelOf = (value: string | null | undefined) =>
  value ? (SEARCH_LABELS[value] ?? labelOf(value)) : "";

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
export const propertyTypeOptions = (
  listingType: string,
  // Defaults to the full set, so the create and edit forms are untouched by
  // the search-side merge. A search surface passes SEARCH_PROPERTY_TYPES.
  base: Option[] = PROPERTY_TYPES,
) => {
  // PG used to cut this to three — room, apartment, independent house — on the
  // reasoning that nobody runs a PG out of a villa. They do, and a searcher who
  // had picked Villa and then pressed PG watched the choice vanish with no
  // explanation. So PG now offers what Rent offers.
  //
  // PLOT is the one real exclusion, and it is not a matter of taste: a plot is
  // bare land, so there is nothing on it to rent or to sleep in. Offering it
  // would be offering a combination that cannot exist.
  if (listingType === "RENT" || listingType === "PG")
    return base.filter((o) => o.value !== "PLOT");
  return base;
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
    // The only route a buyer has to the seller: the account email is never
    // shown, and the API refuses to publish a listing without this. Checked
    // here so the form says so up front rather than at the end — and so an
    // emptied field is caught, because buildListingPayload turns "" into
    // undefined and Prisma ignores undefined, which would silently keep the
    // old number on a listing the owner believes they have cleared.
    ["a contact name", data.contactName.trim().length >= 2],
    ["a contact phone number", /^[6-9]\d{9}$/.test(data.contactPhone.trim())],
    // With all three off, a published listing is one nobody can answer, which
    // is worse for the seller than not publishing at all.
    [
      "at least one way for buyers to reach you",
      data.contactPhoneVisibility ||
        data.contactWatsappVisibility ||
        data.contactInappVisibility,
    ],
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
  // Sent as real booleans, never undefined: these are the one group of fields
  // where "leave it as it was" is the wrong default — an owner switching a
  // channel off has to be able to switch it off.
  contactPhoneVisibility: data.contactPhoneVisibility,
  contactWatsappVisibility: data.contactWatsappVisibility,
  contactInappVisibility: data.contactInappVisibility,

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
  contactPhoneVisibility: listing.contactPhoneVisibility ?? true,
  contactWatsappVisibility: listing.contactWatsappVisibility ?? true,
  contactInappVisibility: listing.contactInappVisibility ?? true,
  addressLine: listing.addressLine,
  landmark: listing.landmark ?? "",
  locality: listing.locality,
  city: listing.city,
  district: listing.district,
  state: listing.state,
  pincode: listing.pincode,
  amenityIds: listing.amenities.map((amenity) => amenity.id),
});

// Which contact buttons a listing offers.
//
// Anything that is not an explicit false counts as shown, for three reasons:
// listings created before these columns existed hold null, the column default
// is true, and an API response that omits the fields should leave the page
// working rather than silently strip every button off it.
export const contactChannels = (listing: {
  contactPhoneVisibility?: boolean | null;
  contactWatsappVisibility?: boolean | null;
  contactInappVisibility?: boolean | null;
}) => ({
  call: listing.contactPhoneVisibility !== false,
  whatsapp: listing.contactWatsappVisibility !== false,
  chat: listing.contactInappVisibility !== false,
});

export const listingLocation = (
  listing: Pick<Listing, "latitude" | "longitude">,
): LngLat | null =>
  listing.latitude !== null && listing.longitude !== null
    ? [listing.longitude, listing.latitude]
    : null;

/* ---------- availability ---------- */

// SOLD and RENTED are one event told in two words: the property is no longer
// available. Which word is right is decided by the listing type, never by the
// seller — offered both, some will mark a rental SOLD, and the moment that
// happens neither status means anything. One button, one derived value.
export const closedStatusFor = (listingType?: string | null) =>
  listingType === "SALE" ? "SOLD" : "RENTED";

// What that button says. PG and RENT both end as RENTED, so both read
// "rented"; only a sale is "sold".
export const closeLabel = (listingType?: string | null) =>
  listingType === "SALE" ? "Mark as sold" : "Mark as rented";

// Reachable by direct link, absent from search: the link is already in buyers'
// WhatsApp threads and in Google's index, so a 404 here throws away a visitor
// who has just proved what they are looking for. See docs/adr/0002.
export const isUnavailable = (status?: string | null) =>
  status === "SOLD" || status === "RENTED";

// Said in the past tense, because the buyer is reading about something that has
// already happened to a property they cannot have.
export const unavailableNotice = (status?: string | null) =>
  status === "SOLD"
    ? "This property has been sold"
    : "This property is no longer available";

// Constant, because nothing about going back on sale depends on the type.
export const AVAILABLE_LABEL = "Mark as available";

export type AvailabilityMove = {
  next: ListingStatus;
  label: string;
  // Whether it takes the listing off the market, and so whether it is worth a
  // question first. Reopening is the undo and asks nothing.
  closing: boolean;
};

// Every move the owner may make from where the listing stands. EXPIRED belongs
// to the expiry job and TAKEN_DOWN to moderation, so both return nothing — a
// seller who could leave TAKEN_DOWN would make moderation a suggestion.
//
// Unlisting is deliberately not called "move to draft". A sold listing keeps
// its page, with a banner and similar properties; a draft's page 404s, so every
// link already sitting in a buyer's WhatsApp thread dies with it. The word has
// to say that something is being removed.
// See docs/adr/0002-listing-availability-status.md.
export const availabilityMoves = (listing: {
  listingType?: string | null;
  status?: string | null;
}): AvailabilityMove[] => {
  const closed = closedStatusFor(listing.listingType) as ListingStatus;
  if (listing.status === "DRAFT")
    return [{ next: "ACTIVE", label: "Publish listing", closing: false }];
  if (listing.status === "ACTIVE")
    return [
      {
        next: closed,
        label: closeLabel(listing.listingType),
        closing: true,
      },
      { next: "DRAFT", label: "Unlist", closing: true },
    ];
  if (listing.status === closed)
    return [
      { next: "ACTIVE", label: AVAILABLE_LABEL, closing: false },
      // Also offered here, not only when live: a seller who sold months ago may
      // want the page gone altogether rather than left standing as a record.
      { next: "DRAFT", label: "Unlist", closing: true },
    ];
  return [];
};

// The single move a card or a listing page offers: sold or rented when it is
// live, available again when it is closed. Never publishing — that has its own
// button with a checklist in front of it — and never unlisting, which belongs
// on the edit page where there is room to say what it costs.
export const nextAvailability = (listing: {
  listingType?: string | null;
  status?: string | null;
}): AvailabilityMove | null =>
  listing.status === "DRAFT"
    ? null
    : (availabilityMoves(listing).find((move) => move.next !== "DRAFT") ??
      null);

// The word for each status, and the chip it is shown in. Three surfaces print
// these — the card grid over a photo, the dashboard bar, and the edit page —
// and they used to carry their own copies of the words. The words belong
// together; only the card keeps its own colours, because a chip over a photo
// needs a solid background rather than a hairline border.
export const STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Live",
  SOLD: "Sold",
  RENTED: "Rented",
  EXPIRED: "Expired",
  // Loud on purpose. Every other status is something the seller did; this one
  // was done to them, and it is the one they have to notice.
  TAKEN_DOWN: "Taken down",
};

export const STATUS_CHIP: Record<ListingStatus, string> = {
  DRAFT: "border-warn/30 bg-warn/10 text-warn",
  ACTIVE: "border-accent/30 bg-accent-soft text-accent",
  SOLD: "border-line bg-ground text-muted",
  RENTED: "border-line bg-ground text-muted",
  EXPIRED: "border-line bg-ground text-muted",
  TAKEN_DOWN: "border-danger/30 bg-danger/10 text-danger",
};

// Falls back rather than throwing: the status is a database enum that can grow
// at any time, and one unknown word should not take a seller's page down.
export const statusChip = (status?: string | null) => ({
  text: STATUS_LABEL[status as ListingStatus] ?? status ?? "",
  className:
    STATUS_CHIP[status as ListingStatus] ?? "border-line bg-ground text-muted",
});
