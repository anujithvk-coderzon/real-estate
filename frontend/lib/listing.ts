import { formatNumber } from "@/lib/format";
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

// A colour per type. The dot on a card, the pin on the search map, the teardrop
// on the hero's illustrated map and the swatch in MapLegend all read from here,
// so the same property type is the same colour everywhere it appears.
//
// These are no longer the reference's legend colours. That set had three
// purples, a terracotta and an amber in it, and it failed in two ways at once.
//
// Villa #a582b9 and Plot #a489ba were 4.9 CIE Lab apart — two different hex
// strings and one visible colour on a 7px dot. And the set as a whole was
// 4.7 apart under deuteranopia, the commonest colour blindness: two categories
// were literally indistinguishable for roughly one man in sixteen looking at
// the legend.
//
// So this set was solved for rather than picked. Candidates were every colour
// in a mid-lightness, mid-chroma band of CIE LCh that is in sRGB gamut and
// stays clear of everything a pin must not be mistaken for — the illustrated
// map's land, parks, water, highway and white roads, plus --color-ink (the
// "where you searched" dot), --color-accent (the radius ring) and the #1a73e8
// device blue. From those ~21,000 candidates, eight were chosen to maximise
// the SMALLEST gap between any two of them, under normal vision and under
// simulated deuteranopia and protanopia together, with a floor of 30 degrees
// of hue between neighbours so no two can be described by the same word.
//
//   worst of the 28 pairs    before -> after
//   normal vision              23.8 -> 31.3
//   deuteranopia                4.7 -> 21.0
//   protanopia                 14.7 -> 22.0
//
// For scale: Okabe-Ito, the published colour-blind-safe eight that most
// scientific figures use, scores 26.4 / 10.8 / 20.4 on the same measure. This
// set beats it on all three, because it was allowed to ignore the one
// constraint Okabe-Ito carries and this map does not — printing on white.
//
// Six of the eight kept their hue, so the meanings carry over: Apartment is
// still blue, House still violet, Office still amber, Room still teal, PG still
// at the pink end, Commercial still warm. Two had to move, and Villa moved
// furthest, out of a purple family that could not hold three members.
//
// The honest limit, worth knowing before anyone adds a ninth category: eight is
// already more than colour alone can carry. Dropping to seven would make the
// worst pair 34.3 and to six 40.6. If the legend ever feels crowded again, the
// answer is fewer colours — Office and Commercial are already ONE choice in the
// search, see SEARCH_PROPERTY_TYPES — or a glyph inside the pin so colour stops
// being the only channel. It is not a tenth hue.
export const TYPE_COLOUR: Record<string, string> = {
  APARTMENT: "#226bae",
  INDEPENDENT_HOUSE: "#a990f8",
  // Sage. Out of the purples entirely: it was the third of three, and the one
  // the other two could most afford to lose.
  VILLA: "#74a872",
  // Olive, and dark where Villa's green is light — 35 apart, and 20 of that is
  // lightness alone, so the two survive being printed small and side by side.
  // A plot is open ground, which is the one category here that is not a
  // building and the one that earns a green.
  PLOT: "#696c0f",
  COMMERCIAL: "#b54766",
  OFFICE: "#e69340",
  ROOM: "#18b9b0",
  // A PG is not a room with a different label on it — one is a tenancy of your
  // own, the other is a bed in a run household — so it gets its own colour and
  // its own line in the legend, like every other category.
  //
  // Still at the pink end, and still the furthest thing on the wheel from
  // Room's teal, because those two are the pair most likely to appear together
  // and the pair a reader most needs to separate.
  PG: "#f485d7",
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

/* ---------- suggested wording ---------- */

// Sellers type place names however they type them — "thalassery", "KANNUR".
// A listing that prints them back verbatim looks careless, and the place name
// is the first thing a buyer reads.
const properNoun = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'\-])([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase());

// "a apartment" was the bug this exists to stop. Spelling, not phonetics: the
// property types are a closed list and none of them is an "hour" or a "union".
const article = (word: string) =>
  /^[aeiou]/i.test(word.trim()) ? "an" : "a";

const ordinal = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

const areaPhrase = (data: ListingFormData) =>
  data.areaValue
    ? `${formatNumber(data.areaValue)} ${data.areaUnit === "SQFT" ? "sq ft" : data.areaUnit.toLowerCase()}`
    : "";

const placePhrase = (data: ListingFormData) =>
  [data.locality, data.city, data.district]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .map(properNoun)
    .filter((part, index, all) => all.indexOf(part) === index)
    .slice(0, 2)
    .join(", ");

// A title in the shape buyers already scan for: "2 BHK apartment for sale in
// Thalassery, Kannur". Built only from answers the seller has given.
//
// Returns "" until there is enough to say something true — a half-built title
// ("BHK for sale in") is worse than an empty box.
export const suggestTitle = (data: ListingFormData) => {
  if (!data.propertyType) return "";

  const what = labelOf(categoryOf(data)).toLowerCase();
  const beds =
    isResidential(data.propertyType) && data.bedrooms
      ? `${data.bedrooms} BHK `
      : "";
  const size =
    !isResidential(data.propertyType) && data.areaValue
      ? `${areaPhrase(data)} `
      : "";
  const purpose =
    data.listingType === "SALE"
      ? "for sale"
      : data.listingType === "PG"
        ? "available"
        : "for rent";

  const place = placePhrase(data);
  const title = `${beds}${size}${what} ${purpose}${place ? ` in ${place}` : ""}`.trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
};

// A joined list that reads like a sentence: "a lift, covered parking and a
// power backup" rather than "a lift, covered parking, a power backup".
const sentenceList = (parts: string[]) => {
  const items = parts.filter(Boolean);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

// Small counts read as words in prose and as digits in a table. "It has two
// bathrooms and a balcony" is a sentence; "It has 2 bathrooms and 1 balcony"
// is a spec line that happens to have a verb in it. Area and money stay as
// numerals, because those are figures a buyer compares rather than reads.
const WORDS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];
const spell = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? (WORDS[n] as string) : value;
};

// A countable thing, written the way a person would: "a balcony", "two
// balconies", "11 balconies".
const count = (value: string, one: string, many: string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n === 1) return `${/^[aeiou]/i.test(one) ? "an" : "a"} ${one}`;
  return `${spell(value)} ${many}`;
};

// A first draft of the listing's description.
//
// Written as flowing prose rather than a list, because this sits under a
// heading that already says "About this property" and above an At a glance
// table that already lists the specs. What it adds is the one thing a table
// cannot: sentences a person reads.
//
// Every clause restates something the seller entered — nothing is invented on
// their behalf, which matters because it is published under their name.
//
// Deliberately carries NO instructions. Anything written here goes out, so a
// line telling them what to write next would be published too whenever they
// forgot to delete it. That prompt lives under the field instead.
export const suggestDescription = (
  data: ListingFormData,
  amenityNames: string[] = [],
) => {
  if (!data.propertyType) return "";

  const what = labelOf(categoryOf(data)).toLowerCase();
  const place = placePhrase(data);
  const area = areaPhrase(data);
  const furnished = data.furnishing ? labelOf(data.furnishing).toLowerCase() : "";
  const residential = isResidential(data.propertyType);
  const rental = isRental(data.listingType);

  /* ---------- the opening sentence ---------- */
  const noun = residential && data.bedrooms ? `${data.bedrooms} BHK ${what}` : what;
  const lead = `${article(furnished || noun)} ${furnished ? `${furnished} ` : ""}${noun}`;
  const floor =
    data.floorNumber && data.totalFloors
      ? ` on the ${ordinal(data.floorNumber)} floor of a ${spell(data.totalFloors)}-storey building`
      : "";

  const sentences: string[] = [
    `${lead}${place ? ` in ${place}` : ""}${area ? `, set over ${area}` : ""}${floor}.`,
  ];

  /* ---------- what is in it, and what comes with it ---------- */
  const inside = sentenceList([
    residential ? count(data.bathrooms, "bathroom", "bathrooms") : "",
    count(data.balconies, "balcony", "balconies"),
  ]);
  const shared = amenityNames.length
    ? sentenceList(amenityNames.map((n) => n.toLowerCase()))
    : "";

  if (inside && shared) {
    sentences.push(`It has ${inside}, and the building offers ${shared}.`);
  } else if (inside) {
    sentences.push(`It has ${inside}.`);
  } else if (shared) {
    sentences.push(`The building offers ${shared}.`);
  }

  /* ---------- terms, as one closing sentence ---------- */
  const terms: string[] = [];
  if (data.propertyStatus === "READY_TO_MOVE") terms.push("ready to move into");
  else if (data.propertyStatus) terms.push(labelOf(data.propertyStatus).toLowerCase());
  if (data.availableFrom) {
    terms.push(
      `available from ${new Date(data.availableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
    );
  }
  if (terms.length) {
    sentences.push(`${residential ? "The home" : "It"} is ${sentenceList(terms)}.`);
  }

  const money: string[] = [];
  if (rental && data.securityDeposit) {
    money.push(`a deposit of ₹${formatNumber(data.securityDeposit)} applies`);
  }
  if (data.isNegotiable) {
    money.push(`the ${rental ? "rent" : "price"} is negotiable`);
  }
  if (money.length) {
    const line = sentenceList(money);
    sentences.push(line.charAt(0).toUpperCase() + line.slice(1) + ".");
  }

  const text = sentences.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1) + "\n\n";
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
