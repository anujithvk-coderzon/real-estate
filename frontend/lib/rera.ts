import type { ListingType, PostedBy, VerificationStatus } from "@/lib/types";

// What a listing may say about its lister's RERA registration.
//
// Three rules decide this, and getting any of them wrong misleads a buyer:
//
// 1. An OWNER selling their own home needs no registration at all. A badge
//    reading "not verified" on their listing would be an accusation about a
//    requirement that does not apply to them.
// 2. Agents need registration to handle a SALE. Rentals and PG do not need
//    one, so "no RERA number" on a rental is true but irrelevant, and
//    irrelevant warnings train people to ignore the relevant ones.
// 3. VERIFIED is worth saying wherever it is true, because it is the one
//    claim here that somebody checked against a state register.
export type ReraBadge = {
  label: string;
  // A tick for the one state that was actually checked by a person. The other
  // states carry no glyph: a mark on every badge is a mark that means nothing.
  tick?: boolean;
  // good: checked and holds. bad: it was taken away. quiet: a fact, not a flag.
  tone: "good" | "bad" | "quiet";
  // The sentence a tooltip or a detail page can carry.
  detail: string;
};

export const reraBadge = ({
  postedBy,
  listingType,
  status,
}: {
  postedBy?: PostedBy | null;
  listingType?: ListingType | null;
  status?: VerificationStatus | null;
}): ReraBadge | null => {
  if (postedBy !== "BROKER" && postedBy !== "BUILDER") return null;

  if (status === "VERIFIED")
    return {
      label: "RERA verified",
      tone: "good",
      tick: true,
      detail:
        "We checked this registration number against the state register it belongs to.",
    };

  if (status === "REVOKED")
    return {
      label: "RERA revoked",
      tone: "bad",
      detail:
        "This registration was verified and has since been withdrawn. Ask about it before you pay anything.",
    };

  // Everything below is only material on a sale, which is the transaction the
  // law requires an agent to be registered for.
  if (listingType !== "SALE") return null;

  if (status === "PENDING")
    return {
      label: "RERA not checked yet",
      tone: "quiet",
      detail:
        "A registration number was given and is waiting to be checked against the state register.",
    };

  return {
    label: "No RERA number",
    tone: "quiet",
    detail:
      "This agent has not given a state RERA registration number. Agents need one to handle a sale.",
  };
};

// One look per tone, so a badge means the same thing on a card as on a page.
export const BADGE_TONE: Record<ReraBadge["tone"], string> = {
  good: "bg-accent-soft text-accent",
  bad: "bg-danger/10 text-danger",
  quiet: "bg-ground text-muted",
};
