import { api } from "@/lib/api";
import type { ListingStatus } from "@/lib/types";

// The one place that knows how an availability change is sent. Three surfaces
// now offer it — the owner's card grid, the dashboard page and the public page
// an owner is looking at — and a request shape written three times is a request
// shape that will eventually be written three different ways.
//
// Returns the server's own message so every surface says what the server said,
// rather than inventing its own wording for the same event.
export const changeListingStatus = async (
  id: string,
  next: ListingStatus,
  from?: ListingStatus,
): Promise<string> => {
  // Leaving DRAFT is publishing, and publishing has its own endpoint and its
  // own refusals — a listing with no contact details must not go live. Routed
  // here rather than at each call site, so no surface can publish by the back
  // door and skip those checks.
  const publishing = from === "DRAFT" && next === "ACTIVE";
  const response = publishing
    ? await api.patch(`/list/publish/${id}`)
    : await api.patch(`/list/status/${id}`, { status: next });
  return (response.data?.message as string | undefined) ?? "Listing updated";
};
