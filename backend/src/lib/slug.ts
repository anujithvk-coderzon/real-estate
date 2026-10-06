import { randomBytes } from "crypto";

// "Anujith VK" → "anujith-vk": lowercase, no punctuation, words joined by hyphens.
export const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, ""); // no hyphen at either end

export const listNameSluggify = (name: string) => `${slugify(name)}-${Date.now()}`;

// A profile address: "anujith-vk-7f3a". The random part keeps two people with the
// same name apart. Set once when the account is created and never changed, so
// shared links keep working even if the name does change.
export const userSlug = (name: string) => `${slugify(name)}-${randomBytes(3).toString("hex")}`;
