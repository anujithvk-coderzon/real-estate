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
// 4. Everything that is not verified reads the same way to a buyer: not
//    verified. Whether we rejected the number they gave, withdrew one we had
//    confirmed, or never got one at all is between us and the agent — for the
//    buyer the decision is identical, and publishing which of the three it was
//    is an accusation we have no business making under somebody's name.
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

  // NONE, REJECTED and REVOKED all land here, with one wording between them.
  // The agent is told which of the three it is, in their own settings; a buyer
  // is told the only part that bears on their decision.
  return {
    label: "RERA not verified",
    tone: "quiet",
    detail:
      "We have not been able to confirm a RERA registration for this agent. Agents need a valid one to handle a sale.",
  };
};

// Said under every one of these badges, the verified one included, and on
// listings that carry no badge at all. A tick is about a registration number on
// a register — not about the property, its title, its approvals, or the person
// holding the money. A buyer who reads it as cover for skipping their own checks
// has been misled by us, and that is the reading this paragraph exists to close.
//
// It is fixed text, not something an operator types: a protection that depends
// on somebody remembering to write it is not a protection. The admin panel
// carries a copy of these two strings for its preview — change them together.
// Why a typed-in project has no RERA number. Three answers, because these are
// the three real reasons — and because the alternative to offering them is a
// required field that listers answer with "NA", which we then publish as though
// it were a registration.
export const RERA_ABSENCE_OPTIONS = [
  {
    value: "PRE_RERA",
    label: "Completed before RERA came in (May 2017)",
  },
  { value: "SMALL_PROJECT", label: "Small project — 8 units or fewer" },
  { value: "UNKNOWN", label: "I do not know the number" },
] as const;

export type ReraAbsence = (typeof RERA_ABSENCE_OPTIONS)[number]["value"];

// What a buyer is told, in each case. Always attributed to the lister: we did
// not check any of this, and a sentence that sounds like our finding would be
// us vouching for an answer nobody verified.
export const RERA_ABSENCE_TEXT: Record<string, string> = {
  PRE_RERA:
    "The lister says this project was finished before RERA came into force in May 2017, so it was never registered.",
  SMALL_PROJECT:
    "The lister says the project is small enough to fall outside RERA — 8 units or fewer, on under 500 sq m.",
  UNKNOWN:
    "The lister does not know this project's RERA number. Look the project up on your state authority's own site before you go any further.",
};

// A project's own registration, which is a different thing from the agent's
// above. The law is stricter here: a promoter may not advertise or sell an
// unregistered project at all, while an agent needs registration only to handle
// a sale. So there is no listing type to gate on — every project either has a
// registration, or states why it does not need one.
//
// The three unverified states collapse into one wording for the same reason
// they do for agents: which of them it is concerns the builder, not the buyer.
export const projectReraBadge = ({
  reraStatus,
  isReraExempt,
  reraNumber,
  reraAbsence,
  inRecords,
}: {
  reraStatus?: string | null;
  isReraExempt?: boolean | null;
  reraNumber?: string | null;
  // Only on a typed-in project: the lister's answer to why there is no number.
  reraAbsence?: string | null;
  // False when a lister typed the project's name and number themselves rather
  // than the builder registering it here. Nothing typed that way has been near
  // a register, ours or the state's.
  inRecords?: boolean;
}): ReraBadge => {
  if (isReraExempt)
    return {
      label: "Exemption claimed",
      tone: "quiet",
      detail:
        "The builder states this project is small enough to list without registering — 8 units or fewer on under 500 sq m. Nobody has checked that against a register, because an exemption is not on one.",
    };

  if (!inRecords)
    return {
      // Two different things, and a buyer acts differently on each: a number
      // nobody checked, or a stated reason there is no number at all.
      label: reraNumber ? "As given by the lister" : "No RERA number",
      tone: "quiet",
      detail: reraNumber
        ? "This number was typed in by whoever posted the listing, not by the builder. Look it up on the state authority's own site before you go any further."
        : (reraAbsence && RERA_ABSENCE_TEXT[reraAbsence]) ||
          "No RERA number was given for this project.",
    };

  if (reraStatus === "VERIFIED")
    return {
      label: "Project RERA verified",
      tone: "good",
      tick: true,
      detail:
        "We found this registration on the state authority's register and it was live there.",
    };

  if (reraStatus === "PENDING")
    return {
      label: "Not checked yet",
      tone: "quiet",
      detail: reraNumber
        ? "The builder gave this number and it is waiting to be checked against the state authority's register."
        : "No registration number has been given for this project yet.",
    };

  return {
    label: "RERA not verified",
    tone: "quiet",
    detail:
      "We have not been able to confirm a registration for this project on the state authority's register.",
  };
};

// What the check reaches, said beside the badge it qualifies, because that is
// the claim being qualified.
export const RERA_SCOPE =
  "This covers the agent's registration number only — not this property, its title, its approvals or its measurements.";

// A project's registration covers the project, which is a wider thing than an
// agent's licence and still nothing like a guarantee of the flat being sold.
export const PROJECT_RERA_SCOPE =
  "This covers the project's registration with the state authority — not any one flat in it, its price, its plan or when it will be handed over.";

export const RERA_CAUTION_HEADING = "Before you pay anything";

// What to do about it. Kept separate from the scope above so neither page says
// the same thing twice, and so this half reads as instructions rather than as
// the tail of a disclaimer.
export const RERA_CAUTION =
  "Visit in person, have the title and approval documents read by your own lawyer, and keep every payment traceable through a bank. Never pay an advance, a token or a booking amount on the strength of a badge on this page.";

// One look per tone, so a badge means the same thing on a card as on a page.
export const BADGE_TONE: Record<ReraBadge["tone"], string> = {
  good: "bg-accent-soft text-accent",
  bad: "bg-danger/10 text-danger",
  quiet: "bg-ground text-muted",
};
