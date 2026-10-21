import z from "zod";



export const chatInitializationSchema=z.object({
    listingSlug:z.string().trim().min(1,"Listing slug required").max(200,"Invalid listing")
})

export const messageSendSchema=z.object({
    body:z.string().trim().min(1,"Messaage cannot be empty").max(4000,"Message is too long")
})
