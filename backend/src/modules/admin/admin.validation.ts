import z from "zod";


export const adminCreationValidation=z.object({
    name:z.string().min(1,"Name required"),
    email:z.email("Must be a proper email").toLowerCase(),
    password:z.string()
})
// Same cap as the public listings endpoint, for the same reason: a page size
// that arrives from the query string decides how much work the database does.
export const interestsTake = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .default(25);
