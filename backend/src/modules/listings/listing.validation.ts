import z from "zod";

const RESIDENTIAL = ["APARTMENT", "INDEPENDENT_HOUSE", "VILLA", "ROOM"];
const RENTABLE = ["RENT", "PG"];

export const listingFields=z.object({
     title: z.string().trim().min(10, "Title should be 10 characters long").max(150, "Title should be under 150 characters"),
    description: z.string().trim().min(30, "Description should be at least 30 characters").max(5000, "Description should be under 5000 characters"),
    propertyType: z.enum([
      "APARTMENT",
      "INDEPENDENT_HOUSE",
      "VILLA",
      "PLOT",
      "COMMERCIAL",
      "OFFICE",
      "ROOM",
    ]),
    listingType: z.enum(["SALE", "RENT", "PG"]),
    postedBy: z.enum(["OWNER", "BROKER", "BUILDER"]),

    price: z.number("Enter a price").positive("Price must be more than zero"),
    isNegotiable: z.boolean().default(false),
    securityDeposit: z.number("Enter a security deposit").positive("Security deposit must be more than zero").optional(),
    maintenance: z.number("Enter a maintenance amount").positive("Maintenance must be more than zero").optional(),

    areaValue: z.number("Enter the area").positive("Area must be more than zero"),
    areaUnit: z.enum(["SQFT", "SQM", "CENT", "ACRE"]),

    bedrooms: z.number().int("Bedrooms must be a whole number").min(1, "Enter at least 1 bedroom").optional(),
    bathrooms: z.number().int("Bathrooms must be a whole number").min(1, "Enter at least 1 bathroom").optional(),
    balconies: z.number().int("Balconies must be a whole number").min(0, "Balconies cannot be negative").optional(),
    furnishing: z
      .enum(["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"])
      .optional(),
    floorNumber: z.number().int("Floor number must be a whole number").min(0, "Floor number cannot be negative").optional(),
    totalFloors: z.number().int("Total floors must be a whole number").min(1, "Enter at least 1 floor").optional(),
    propertyStatus: z.enum(["READY_TO_MOVE", "UNDER_CONSTRUCTION"]).optional(),
    availableFrom: z.coerce.date().optional(),

    addressLine: z.string().trim().min(5, "Enter the property name or number"),
    landmark: z.string().trim().optional(),
    locality: z.string().trim().min(2, "Enter the locality or street"),
    district: z.string().trim().min(2, "Enter the district"),
    city: z.string().trim().min(2, "Enter the city or town"),
    state: z.string().trim().min(2, "Enter the state"),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
    latitude: z.number().min(6.5, "Location must be inside India").max(37.6, "Location must be inside India").optional(),
    longitude: z.number().min(68.1, "Location must be inside India").max(97.4, "Location must be inside India").optional(),

    contactName: z.string().trim().min(2, "Contact name is too short").optional(),
    // Indian mobile numbers start 6, 7, 8 or 9. The listing page turns this into
    // a tel: and a WhatsApp link, so anything else produces a link that dials
    // nothing — and the owner never finds out why no one called.
    contactPhone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")
      .optional(),
    contactPhoneVisibility:z.boolean(),
    contactWatsappVisibility:z.boolean(),
    contactInappVisibility:z.boolean(),
    amenityIds: z.array(z.string().uuid("Invalid amenity")).optional(),
    // The builder's project this unit belongs to; its RERA number covers the sale.
    projectId: z.string().trim().min(1,"Choose a project").optional(),
    // Used instead of projectId when the project is not in our records.
    projectNameText: z.string().trim().min(2,"Project name is too short").max(120).optional(),
    projectReraText: z.string().trim().min(4,"RERA number is too short").max(60).optional(),
    builderNameText: z.string().trim().min(2,"Builder name is too short").max(120).optional(),
  })

export const registeringValidation = listingFields.superRefine((data, ctx) => {
    const isResidential = RESIDENTIAL.includes(data.propertyType);
    const isRental = RENTABLE.includes(data.listingType);

    // ── required for residential ──
    if (isResidential && data.bedrooms === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["bedrooms"],
        message: "Bedrooms is required for this property type",
      });
    }
    if (isResidential && data.bathrooms === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["bathrooms"],
        message: "Bathrooms is required for this property type",
      });
    }

    // ── not applicable to plots ──
    if (data.propertyType === "PLOT" && data.bedrooms !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["bedrooms"],
        message: "Bedrooms does not apply to a plot",
      });
    }
    if (data.propertyType === "PLOT" && data.floorNumber !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["floorNumber"],
        message: "Floor does not apply to a plot",
      });
    }

    // ── rent vs sale ──
    if (isRental && data.securityDeposit === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["securityDeposit"],
        message: "Security deposit is required for rentals",
      });
    }
    if (!isRental && data.securityDeposit !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["securityDeposit"],
        message: "Security deposit applies to rentals only",
      });
    }
    if (!isRental && data.maintenance !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["maintenance"],
        message: "Maintenance applies to rentals only",
      });
    }

    // ── listing type must suit the property type ──
    if (
      data.listingType === "PG" &&
      !["ROOM", "APARTMENT", "INDEPENDENT_HOUSE"].includes(data.propertyType)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["listingType"],
        message: "PG listings must be a room, apartment or house",
      });
    }
    if (data.propertyType === "PLOT" && data.listingType !== "SALE") {
      ctx.addIssue({
        code: "custom",
        path: ["listingType"],
        message: "Plots can only be listed for sale",
      });
    }

    // ── floors must be consistent ──
    if (
      data.floorNumber !== undefined &&
      data.totalFloors !== undefined &&
      data.floorNumber > data.totalFloors
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["floorNumber"],
        message: "Floor number cannot exceed total floors",
      });
    }

    // ── price sanity ──
    if (isRental && data.price > 1_000_000) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Rent looks too high — did you mean to list this for sale?",
      });
    }
    if (data.listingType === "SALE" && data.price < 100_000) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Sale price looks too low — did you mean rent?",
      });
    }

    // ── availability ──
    if (data.availableFrom && data.availableFrom < new Date()) {
      ctx.addIssue({
        code: "custom",
        path: ["availableFrom"],
        message: "Available-from date cannot be in the past",
      });
    }});


export const updateValidation=listingFields.partial()

// How far around the searched place to look. Exactly the five distances the UI
// offers, and nothing else: an arbitrary ?radius=5000 would scan the country.
// Absent means 10, so every link shared before this existed is unchanged.
export const searchRadius = z.coerce
  .number()
  .refine((km) => [10, 20, 30, 40, 50].includes(km), "Choose 10, 20, 30, 40 or 50 km")
  .default(10)

// How many listings one page returns. The home page wants eight; the catalogue
// wants a full page.
//
// The cap is the point, not the default. Every other filter narrows the result,
// so a bad value returns fewer rows — this one widens it, and ?take=100000 would
// be a free table scan handed out to anyone who guesses the parameter name.
export const listTake = z.coerce
  .number()
  .int()
  .min(1)
  .max(20)
  .default(20)

export type CreateListingInput=z.infer<typeof registeringValidation>
export type UpdateListingInput=z.infer<typeof updateValidation>