import { randomBytes } from "crypto";

export const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, ""); 

export const listNameSluggify = (name: string) => `${slugify(name)}-${Date.now()}`;


export const userSlug = (name: string) => `${slugify(name)}-${randomBytes(3).toString("hex")}`;
