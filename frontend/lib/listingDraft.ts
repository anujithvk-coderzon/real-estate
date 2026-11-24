import {
  emptyListing,
  type ListingFormData,
  type ListingType,
  type LngLat,
  type LocationSource,
  type PostedBy,
} from "@/lib/types";

// An unfinished listing, kept in this browser so a refresh, a closed tab or a
// dropped connection on a phone does not throw away ten minutes of typing.
//
// One draft per signed-in user, keyed by their id, so two people sharing a
// computer never open each other's half-written listing. Cleared on publish,
// on "Start over" and on logout — it holds a phone number.
//
// The version is in the key: if the form's shape changes in a way old drafts
// cannot survive, bump it and the old ones are simply never read.

const PREFIX = "propsnear:listing-draft:";
const VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // a month-old draft is a stale one

const keyFor = (userId: string) => `${PREFIX}v${VERSION}:${userId}`;

export type ManualProject = {
  manualName: string;
  manualRera: string;
  manualBuilder: string;
  manualAbsence: string;
};

export type ListingDraft = {
  role: PostedBy;
  purpose: ListingType;
  step: "details" | "contact";
  data: ListingFormData;
  location: LngLat | null;
  source: LocationSource | null;
  // The place the pin was set for, so a restored pin is not dropped as stale.
  pinnedPlace: string | null;
  projectId: string;
  manual: ManualProject;
  savedAt: string; // ISO, for formatTimeAgo
};

const ROLES: PostedBy[] = ["OWNER", "BROKER", "BUILDER"];
const PURPOSES: ListingType[] = ["SALE", "RENT", "PG"];
const SOURCES: LocationSource[] = ["gps", "region", "address", "fallback", "pin"];

const isLngLat = (value: unknown): value is LngLat =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n));

// Storage can be missing or refuse (private mode, blocked site data, a full
// quota). A draft is a convenience, so every failure is a silent no-op.
export const readDraft = (userId: string): ListingDraft | null => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<ListingDraft>;
    if (
      !ROLES.includes(draft.role as PostedBy) ||
      !PURPOSES.includes(draft.purpose as ListingType) ||
      typeof draft.data !== "object" ||
      draft.data === null ||
      typeof draft.savedAt !== "string" ||
      Date.now() - Date.parse(draft.savedAt) > MAX_AGE_MS
    ) {
      localStorage.removeItem(keyFor(userId));
      return null;
    }
    const location = isLngLat(draft.location) ? draft.location : null;
    return {
      role: draft.role as PostedBy,
      purpose: draft.purpose as ListingType,
      step: draft.step === "contact" ? "contact" : "details",
      // Over the empty form, so a field added after this draft was saved
      // still starts with its default instead of undefined.
      data: { ...emptyListing, ...draft.data },
      location,
      source:
        location && SOURCES.includes(draft.source as LocationSource)
          ? (draft.source as LocationSource)
          : null,
      pinnedPlace: typeof draft.pinnedPlace === "string" ? draft.pinnedPlace : null,
      projectId: typeof draft.projectId === "string" ? draft.projectId : "",
      manual: {
        manualName: draft.manual?.manualName ?? "",
        manualRera: draft.manual?.manualRera ?? "",
        manualBuilder: draft.manual?.manualBuilder ?? "",
        manualAbsence: draft.manual?.manualAbsence ?? "",
      },
      savedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
};

export const writeDraft = (userId: string, draft: ListingDraft) => {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};

export const clearDraft = (userId: string) => {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // nothing to clear
  }
};

// On logout: every user's draft, every version.
export const clearAllDrafts = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // nothing to clear
  }
};

// Nothing worth saving yet: the seller has opened the form and not typed.
// Role and purpose are left out — they come from the URL, not the seller.
export const isBlankForm = (data: ListingFormData) =>
  (Object.keys(emptyListing) as (keyof ListingFormData)[])
    .filter((key) => key !== "postedBy" && key !== "listingType")
    .every((key) => JSON.stringify(data[key]) === JSON.stringify(emptyListing[key]));
