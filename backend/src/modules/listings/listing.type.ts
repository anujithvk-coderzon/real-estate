export type ListingOrderBy =
  | { updatedAt: "desc" }
  | { price: "asc" }
  | { price: "desc" };

export enum ListingStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  SOLD = "SOLD",
  RENTED = "RENTED",
  EXPIRED = "EXPIRED",
}