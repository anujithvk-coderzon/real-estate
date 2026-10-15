import z from "zod";


export const adminCreationValidation=z.object({
    name:z.string().min(1,"Name required"),
    email:z.email("Must be a proper email").toLowerCase(),
    password:z.string()
})