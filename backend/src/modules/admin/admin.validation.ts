import z from "zod";


export const adminCreationValidation=z.object({
    name:z.string().min(1,"Name required"),
    email:z.email("Must be a proper email").toLowerCase(),
    password:z.string()
})
// Same cap as the public listings endpoint, for the same reason: a page size
// that arrives from the query string decides how much work the database does.
// The note an operator writes with every RERA decision. Mandatory, because on
// an approval it is published on the agent's public profile and a verified
// badge with nothing behind it reads as our word that the agent is safe to pay.
// The bounds are the ones the admin panel's own counter shows: below 25 you
// cannot say what you checked, above 300 nobody reads it.
export const reraDecisionValidation = z.object({
  reason: z
    .string()
    .trim()
    .min(25, "Write at least one full sentence about what you checked")
    .max(300, "Keep the note under 300 characters"),
});

export const interestsTake = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .default(25);
