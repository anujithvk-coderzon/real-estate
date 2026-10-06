import z from "zod";

// Above this many units RERA registration is compulsory, so no exemption is allowed.
export const RERA_EXEMPT_MAX_UNITS = 8;

export const projectFields=z.object({
    name: z.string().trim().min(3,"Project name should be at least 3 characters").max(120,"Project name should be under 120 characters"),
    status: z.enum(["UPCOMING","ONGOING","COMPLETED"]),
    propertyType: z.enum([
      "APARTMENT",
      "INDEPENDENT_HOUSE",
      "VILLA",
      "PLOT",
      "COMMERCIAL",
      "OFFICE",
      "ROOM",
    ]).optional(),
    description: z.string().trim().max(2000,"Description should be under 2000 characters").optional(),

    totalUnits: z.number().int("Total units must be a whole number").positive("Total units must be more than zero").optional(),
    minPrice: z.number("Enter a price").positive("Price must be more than zero").optional(),
    maxPrice: z.number("Enter a price").positive("Price must be more than zero").optional(),
    startedAt: z.coerce.date().optional(),
    handoverAt: z.coerce.date().optional(),

    locality: z.string().trim().min(2,"Enter the locality or street"),
    city: z.string().trim().min(2,"Enter the city or town"),
    district: z.string().trim().min(2,"Enter the district"),
    state: z.string().trim().min(2,"Enter the state"),
    pincode: z.string().regex(/^\d{6}$/,"Pincode must be 6 digits"),
    latitude: z.number().min(6.5,"Location must be inside India").max(37.6,"Location must be inside India").optional(),
    longitude: z.number().min(68.1,"Location must be inside India").max(97.4,"Location must be inside India").optional(),

    reraNumber: z.string().trim().min(5,"Enter the RERA registration number").max(60,"RERA number is too long").optional(),
    reraState: z.string().trim().min(2,"Enter the state of registration").optional(),
    isReraExempt: z.boolean().default(false),
    exemptReason: z.string().trim().min(5,"Say why the project is exempt").max(200,"Keep the reason under 200 characters").optional(),
  })

// The rules that depend on more than one field.
const projectRules=(data:z.infer<typeof projectFields>,ctx:z.RefinementCtx)=>{
    const mustRegister=(data.totalUnits ?? 0) > RERA_EXEMPT_MAX_UNITS;

    // ── registration ──
    if(mustRegister && !data.reraNumber){
      ctx.addIssue({
        code:"custom",
        path:["reraNumber"],
        message:`RERA registration is compulsory above ${RERA_EXEMPT_MAX_UNITS} units`,
      })
    }
    if(!mustRegister && !data.isReraExempt && !data.reraNumber){
      ctx.addIssue({
        code:"custom",
        path:["reraNumber"],
        message:"Give the RERA number, or mark the project exempt",
      })
    }
    if(!mustRegister && data.isReraExempt && !data.exemptReason){
      ctx.addIssue({
        code:"custom",
        path:["exemptReason"],
        message:"Say why the project is exempt",
      })
    }

    // ── price and dates must read the right way round ──
    if(data.minPrice!==undefined && data.maxPrice!==undefined && data.maxPrice < data.minPrice){
      ctx.addIssue({
        code:"custom",
        path:["maxPrice"],
        message:"The highest price cannot be below the lowest",
      })
    }
    if(data.startedAt && data.handoverAt && data.handoverAt < data.startedAt){
      ctx.addIssue({
        code:"custom",
        path:["handoverAt"],
        message:"Handover cannot be before the project started",
      })
    }
}

export const projectCreateValidation=projectFields.superRefine(projectRules)

// Editing sends only what changed, so every field is optional and the
// cross-field rules run on the merged result in the service.
export const projectUpdateValidation=projectFields.partial()

export type CreateProjectInput=z.infer<typeof projectCreateValidation>
export type UpdateProjectInput=z.infer<typeof projectUpdateValidation>
