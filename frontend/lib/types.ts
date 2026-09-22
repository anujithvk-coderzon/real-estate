// Values match the Prisma enums in backend/prisma/schema.prisma.
export type ListingType = "SALE" | "RENT" | "PG";
export type PropertyType =
  | "APARTMENT"
  | "INDEPENDENT_HOUSE"
  | "VILLA"
  | "PLOT"
  | "COMMERCIAL"
  | "OFFICE"
  | "ROOM";
export type PostedBy = "OWNER" | "BROKER" | "BUILDER" | "DEALER";
export type Furnishing = "UNFURNISHED" | "SEMI_FURNISHED" | "FULLY_FURNISHED";
export type PropertyStatus = "READY_TO_MOVE" | "UNDER_CONSTRUCTION";
export type AreaUnit = "SQFT" | "SQM" | "CENT" | "ACRE";
export type ListingStatus = "DRAFT" | "ACTIVE" | "SOLD" | "RENTED" | "EXPIRED";

// [longitude, latitude] — the order MapLibre uses.
export type LngLat = [number, number];

// Where the current pin came from, so the page can explain how accurate it is.
export type LocationSource = "gps" | "address" | "fallback" | "pin";

/* ---------- form state ---------- */

// Every input returns a string, so numbers are strings here and are converted
// once, when the payload is built. "" means "not chosen yet".
export type ListingFormData = {
  title: string;
  description: string;
  listingType: "" | ListingType;
  propertyType: "" | PropertyType;
  postedBy: "" | PostedBy;

  price: string;
  isNegotiable: boolean;
  securityDeposit: string;
  maintenance: string;

  areaValue: string;
  areaUnit: AreaUnit;

  bedrooms: string;
  bathrooms: string;
  balconies: string;
  furnishing: "" | Furnishing;
  floorNumber: string;
  totalFloors: string;
  propertyStatus: "" | PropertyStatus;
  availableFrom: string;

  contactName: string;
  contactPhone: string;

  addressLine: string;
  landmark: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;

  amenityIds: string[];
};

export const emptyListing: ListingFormData = {
  title: "",
  description: "",
  listingType: "",
  propertyType: "",
  postedBy: "",
  price: "",
  isNegotiable: false,
  securityDeposit: "",
  maintenance: "",
  areaValue: "",
  areaUnit: "SQFT",
  bedrooms: "",
  bathrooms: "",
  balconies: "",
  furnishing: "",
  floorNumber: "",
  totalFloors: "",
  propertyStatus: "",
  availableFrom: "",
  contactName: "",
  contactPhone: "",
  addressLine: "",
  landmark: "",
  locality: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  amenityIds: [],
};

/* ---------- API responses ---------- */

export type ListingImage = {
  id: string;
  position: number;
  path: string;
};

export type ListingVideo = {
  id: string;
  url: string;
};

export type ListingAmenity = {
  id: string;
  name: string;
  category: string;
};

// A listing as returned by GET /list/owner/:id. Prisma sends Decimal columns
// as strings and nullable columns as null.
export type Listing = {
  id: string;
  slug: string | null; // public URL name; null for listings created before slugs existed
  title: string;
  description: string;
  listingType: ListingType;
  propertyType: PropertyType;
  postedBy: PostedBy;
  price: string;
  isNegotiable: boolean;
  securityDeposit: string | null;
  maintenance: string | null;
  areaUnit: AreaUnit;
  areaValue: string;
  areaSqft: string;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number | null;
  furnishing: Furnishing | null;
  floorNumber: number | null;
  totalFloors: number | null;
  propertyStatus: PropertyStatus | null;
  availableFrom: string | null;
  addressLine: string;
  landmark: string | null;
  locality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  status: ListingStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  amenities: ListingAmenity[];
  listingImages: ListingImage[];
  listingVideo: ListingVideo | null;
  owner: { id: string; name: string };
};

// A listing as shown in a list (GET /list/owner/all): only what a card needs.
export type ListingSummary = Pick<
  Listing,
  | "id"
  | "slug"
  | "title"
  | "status"
  | "listingType"
  | "propertyType"
  | "price"
  | "locality"
  | "city"
  | "district"
  | "bedrooms"
  | "bathrooms"
  | "areaValue"
  | "areaUnit"
  | "createdAt"
  | "updatedAt"
> & {
  // The cover photo. Optional until the backend includes it.
  listingImages?: { path: string }[];
};

// A listing on public pages. The database id is never sent to the public;
// the slug identifies the listing instead.
export type PublicListingSummary = Omit<ListingSummary, "id"> & {
  // The map pin. Sent by the search results; missing when the seller placed no pin.
  latitude?: number | null;
  longitude?: number | null;
  // Only on search results: how far the listing is from the searched place.
  distanceKm?: number;
};

// A listing on its public page (GET /list/:slug). Same as Listing, minus every
// internal id: the listing's, the owner's, and those of its photos, video and amenities.
export type PublicListing = Omit<
  Listing,
  "id" | "owner" | "amenities" | "listingImages" | "listingVideo" | "contactName" | "contactPhone"
> & {
  owner: { name: string };
  // Only sent to signed-in users; missing for visitors.
  contactName?: string | null;
  contactPhone?: string | null;
  amenities: Omit<ListingAmenity, "id">[];
  listingImages: Omit<ListingImage, "id">[];
  listingVideo: Omit<ListingVideo, "id"> | null;
};
