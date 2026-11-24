"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddressForm from "@/components/AddressForm";
import InfoTip from "@/components/form/InfoTip";
import MapPicker from "@/components/MapPicker";
import AgentReraForm from "@/components/AgentReraForm";
import CardStack from "@/components/form/CardStack";
import ListingStart from "@/components/ListingStart";
import ProjectPicker, { MANUAL, NONE } from "@/components/ProjectPicker";
import PropertyDetailsForm from "@/components/PropertyDetailsForm";
import { api } from "@/lib/api";
import { pinFromAddress, placeFromPin } from "@/lib/geocode";
import { buildListingPayload, getMissingFields } from "@/lib/listing";
import { errorToast, successToast } from "@/lib/toast";
import { labelOf } from "@/lib/listing";
import { formatTimeAgo } from "@/lib/format";
import {
  clearDraft,
  isBlankForm,
  type ListingDraft,
  readDraft,
  writeDraft,
} from "@/lib/listingDraft";
import {
  type AuthUser,
  emptyListing,
  type ListingFormData,
  type ListingType,
  type LngLat,
  type LocationSource,
  type PostedBy,
  type VerificationStatus,
} from "@/lib/types";
import { primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// What to tell the broker about the pin, depending on how it was placed.
const PIN_NOTES: Record<LocationSource, { heading: string; help: string }> = {
  gps: {
    heading: "Detected location",
    help: "Laptop location can be off by kilometres. Drag the pin to the exact spot, or open this page on your phone at the property and tap “Use my current location”.",
  },
  region: {
    heading: "Centred on your town",
    help: "This is only the town you named, not the property. Zoom in and tap the building to place the pin.",
  },
  address: {
    heading: "Found from the address",
    help: "This is the area, not the exact building. Drag the pin onto the property.",
  },
  fallback: {
    heading: "Pin not placed yet",
    help: "Zoom into the area and tap the property to place the pin.",
  },
  pin: {
    heading: "Pin placed",
    help: "Drag the pin again any time to adjust it.",
  },
};

const ROLES: PostedBy[] = ["OWNER", "BROKER", "BUILDER"];
const PURPOSES: ListingType[] = ["SALE", "RENT", "PG"];

const NO_MANUAL = {
  manualName: "",
  manualRera: "",
  manualBuilder: "",
  manualAbsence: "",
};

const CreateListing = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Answered on the start screen: /list/create?as=OWNER&for=RENT
  const role = ROLES.find((value) => value === searchParams.get("as"));
  const purpose = PURPOSES.find((value) => value === searchParams.get("for"));

  // The signed-in user decides two things here: the pre-selected role on the start
  // screen, and whether an agent still has to give their RERA number.
  const [user, setUser] = useState<AuthUser | null>(null);
  // Drafts are kept per account; no id, no draft.
  const userId = user?.id;
  // Asked for, not demanded. A broker who has not got round to their
  // registration can still list — and the listing says "No RERA number" in
  // public until they do, which is the honest consequence rather than a locked
  // door. Local state, not the URL: it is a decision about this one listing,
  // and the next one asks again.
  //
  // Declared up here with the other hooks because there are early returns
  // between this point and the RERA step that uses it.
  const [reraSkipped, setReraSkipped] = useState(false);
  // Selling: which project the unit is in. Either one of our records, or the
  // name and RERA number the lister types in, or an explicit "no project".
  const [projectId, setProjectId] = useState("");
  const [manual, setManual] = useState(NO_MANUAL);
  const [reraStatus, setReraStatus] = useState<VerificationStatus | null>(null);

  // ---- draft ----
  // A saved draft that was not restored on its own: it was for another role or
  // purpose, or the seller had already started typing. Saving waits until they
  // choose, so the old draft is never overwritten without being offered.
  const [draftOffer, setDraftOffer] = useState<ListingDraft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  // Set by any edit to the form, so a draft arriving late never overwrites
  // what the seller has typed in the meantime.
  const touched = useRef(false);
  // A restored pin is the seller's own; it must not trigger "fill the address
  // from the pin", which would overwrite the town they typed. Compared by
  // coordinates, not a skip-once flag: a flag can be used up by one render and
  // then miss the next, and restoring may set the same pin twice.
  const restoredPin = useRef<LngLat | null>(null);

  useEffect(() => {
    // In development React runs this twice; only the second answer counts, so
    // the draft is restored once.
    let cancelled = false;
    api
      .get("/auth/me")
      .then((response) => {
        if (cancelled) return;
        const me: AuthUser = response.data.user;
        setUser(me);
        setReraStatus(me.agentReraStatus ?? "NONE");
        const draft = me.id ? readDraft(me.id) : null;
        if (!draft) return;
        // role and purpose here are the ones in the URL on arrival.
        if (draft.role === role && draft.purpose === purpose && !touched.current)
          restoreDraft(draft);
        else setDraftOffer(draft);
      })
      .catch(() => {
        // The flow still works; the role just is not pre-selected.
      });
    return () => {
      cancelled = true;
    };
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [typed, setTyped] = useState<ListingFormData>(emptyListing);

  // The start screen's answers always win: this component is not remounted when
  // the query changes, so state created on the first render would be stale.
  const data: ListingFormData = {
    ...typed,
    postedBy: role ?? "",
    listingType: purpose ?? "",
  };

  // Updates must see the same two values, or rules that depend on them (such as
  // "clear the construction status unless this is a sale") would undo the choice.
  const setData: React.Dispatch<React.SetStateAction<ListingFormData>> = (
    update,
  ) => {
    touched.current = true;
    setTyped((previous) => {
      const base: ListingFormData = {
        ...previous,
        postedBy: role ?? "",
        listingType: purpose ?? "",
      };
      return typeof update === "function"
        ? (update as (value: ListingFormData) => ListingFormData)(base)
        : update;
    });
  };
  const [location, setLocation] = useState<LngLat | null>(null);
  const [source, setSource] = useState<LocationSource | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "contact">("details");

  const placePin = (next: LngLat, how: LocationSource) => {
    setLocation(next);
    setSource(how);
  };

  // The state, district and town the pin was placed against, noted when the
  // seller leaves the map. If they go back and change any of the three, the
  // pin belongs to the old place and has to move with them.
  const placeKey = (d: ListingFormData) =>
    [d.state, d.district, d.city].map((part) => part.trim().toLowerCase()).join("|");
  const pinnedPlace = useRef<string | null>(null);

  // Puts a saved draft back, and moves the URL to its role and purpose so the
  // form asks the questions that draft was answering.
  function restoreDraft(draft: ListingDraft) {
    restoredPin.current = draft.location;
    setTyped(draft.data);
    setLocation(draft.location);
    setSource(draft.source);
    setStep(draft.step);
    setProjectId(draft.projectId);
    setManual(draft.manual);
    pinnedPlace.current = draft.pinnedPlace;
    setShowAddressForm(draft.step === "contact");
    setDraftOffer(null);
    setDraftSavedAt(draft.savedAt);
    setRestored(true);
    if (draft.role !== role || draft.purpose !== purpose)
      router.replace(`/list/create?as=${draft.role}&for=${draft.purpose}`);
  }

  const discardDraft = () => {
    if (userId) clearDraft(userId);
    setDraftOffer(null);
  };

  // Back to an empty form, and the saved copy goes too.
  const startOver = () => {
    if (!window.confirm("Clear everything you have entered and start again?"))
      return;
    if (userId) clearDraft(userId);
    touched.current = false;
    setTyped(emptyListing);
    setLocation(null);
    setSource(null);
    setStep("details");
    setProjectId("");
    setManual(NO_MANUAL);
    pinnedPlace.current = null;
    restoredPin.current = null;
    setShowAddressForm(false);
    setDraftSavedAt(null);
    setRestored(false);
    window.scrollTo({ top: 0 });
  };

  // Saved half a second after the last change rather than on every keystroke.
  // The latest copy is also kept in a ref, so closing the tab inside that half
  // second still saves it.
  const latestDraft = useRef<ListingDraft | null>(null);
  useEffect(() => {
    latestDraft.current = null;
    if (!userId || draftOffer || !role || !purpose) return;
    if (isBlankForm(typed) && !location && !projectId) return;
    const draft: ListingDraft = {
      role,
      purpose,
      step,
      data: typed,
      location,
      source,
      pinnedPlace: pinnedPlace.current,
      projectId,
      manual,
      savedAt: new Date().toISOString(),
    };
    latestDraft.current = draft;
    const timer = window.setTimeout(() => {
      if (writeDraft(userId, draft)) setDraftSavedAt(draft.savedAt);
      latestDraft.current = null;
    }, 500);
    return () => window.clearTimeout(timer);
  }, [userId, draftOffer, role, purpose, step, typed, location, source, projectId, manual]);

  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (latestDraft.current) writeDraft(userId, latestDraft.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [userId]);

  const backToDetails = () => {
    pinnedPlace.current = location ? placeKey(data) : null;
    setStep("details");
    window.scrollTo({ top: 0 });
  };

  // A pin left in the old town would be published there, so a changed place
  // drops it. An unchanged place keeps the pin they set, however it was set.
  const toMap = () => {
    if (location && pinnedPlace.current !== placeKey(data)) {
      setLocation(null);
      setSource(null);
    }
    setStep("contact");
    window.scrollTo({ top: 0 });
  };

  const detectCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => placePin([coords.longitude, coords.latitude], "gps"),
      (error) =>
        errorToast(
          error.code === error.PERMISSION_DENIED
            ? "Location access is blocked. Enter the address instead."
            : "Could not get your location. Enter the address instead.",
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  // Arriving at the map with no pin yet: open it over the town they named on
  // the first page rather than over the whole country. Nominatim is asked for
  // the town, not the property — the pin still has to be placed by hand, and
  // the note under it says so.
  //
  // Also runs when they come back having changed the place: Continue drops the
  // old pin (toMap), so this sees no pin and centres on the new town.
  useEffect(() => {
    if (step !== "contact" || location) return;
    if (!data.city.trim() && !data.district.trim()) return;
    let cancelled = false;
    pinFromAddress(data)
      .then((found) => {
        if (cancelled || !found) return;
        placePin(found, "region");
        // Open the address fields too. The state, district and town they gave
        // on the first page are already in `data`, so the form arrives filled
        // in and they only have to add the street and the building.
        setShowAddressForm(true);
      })
      .catch(() => {
        // No pin, no harm: the map still opens and can be tapped.
      });
    return () => {
      cancelled = true;
    };
    // Runs once on arriving at the map; re-running as they edit would fight
    // a pin they have already placed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Whenever the pin moves, fill the address fields from it — but only when
  // the pin is the new information.
  //
  // "region" and "address" pins were both DERIVED from what the seller typed,
  // so reading an address back out of them is circular: it replaces their
  // words with the geocoder's guess at the same place. That is how correcting
  // "Trivandrum" to "Thiruvananthapuram" and pressing "Move pin to this
  // address" rewrote the whole form to a village in Madhya Pradesh.
  //
  // A pin from GPS or one dragged by hand IS new information, and those still
  // fill the state, district and town. Never the property name, locality or
  // pincode: those are the seller's own, and a pin is never that precise.
  useEffect(() => {
    if (!location || source === "region" || source === "address") return;
    const kept = restoredPin.current;
    if (kept && kept[0] === location[0] && kept[1] === location[1]) return;
    placeFromPin(location)
      .then((place) => {
        setTyped((prev) => ({ ...prev, ...place }));
        setShowAddressForm(true);
      })
      .catch(() => {
        // The broker can still type the address by hand.
      });
  }, [location, source]);

  // Builders and agents selling: the question is always asked, because a unit sold
  // off-plan needs the project's RERA number. "Not part of a project" is a valid
  // answer for a resale or a plot, but not for something under construction.
  const sellerSale =
    (role === "BUILDER" || role === "BROKER") && purpose === "SALE";
  const needsProject =
    sellerSale && data.propertyStatus === "UNDER_CONSTRUCTION";

  // What will be sent. A record wins; a typed name is sent only on that answer.
  const chosenProject =
    projectId && projectId !== NONE && projectId !== MANUAL ? projectId : "";
  const typedName = projectId === MANUAL ? manual.manualName.trim() : "";
  const typedRera = projectId === MANUAL ? manual.manualRera.trim() : "";
  // Only an answer while there is no number: the two are one answer between
  // them, and the API rejects both at once.
  const typedAbsence =
    projectId === MANUAL && !typedRera ? manual.manualAbsence : "";
  const typedBuilder = projectId === MANUAL ? manual.manualBuilder.trim() : "";

  // The question is answered when a project is chosen, a typed project says
  // what its registration is — a number, or why there is none — or the lister
  // says there is no project at all. Off-plan has neither of the last two: such
  // a sale may not be advertised without a registered project.
  const projectAnswered =
    projectId === NONE
      ? !needsProject
      : projectId === MANUAL
        ? Boolean(typedName) &&
          Boolean(typedBuilder) &&
          (Boolean(typedRera) || (!needsProject && Boolean(typedAbsence)))
        : Boolean(chosenProject);
  const missing = [
    ...getMissingFields(data, location),
    ...(sellerSale && !projectAnswered ? ["project"] : []),
  ];

  // What the second page is responsible for. Everything else belongs to the
  // first — listed this way round so a check added to getMissingFields later
  // surfaces on page one rather than vanishing between the two.
  const PAGE_TWO = new Set([
    "project",
    "a 6-digit pincode",
    "a pin on the map",
    "a contact name",
    "a contact phone number",
    "at least one way for buyers to reach you",
  ]);
  const missingHere = missing.filter((name) =>
    step === "contact" ? PAGE_TWO.has(name) : !PAGE_TWO.has(name),
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await api.post("/list/create", {
        ...buildListingPayload(data, location),
        ...(chosenProject && { projectId: chosenProject }),
        ...(typedName && { projectNameText: typedName }),
        ...(typedRera && { projectReraText: typedRera }),
        ...(typedAbsence && { projectReraAbsence: typedAbsence }),
        ...(typedBuilder && { builderNameText: typedBuilder }),
      });
      // Published, so the draft has done its job. The pending save is
      // dropped too, or closing the tab now would write the draft back.
      latestDraft.current = null;
      if (userId) clearDraft(userId);
      successToast(response.data.message);
      router.push(`/list/create/media/${response.data.post.id}`);
    } catch (error) {
      errorToast(apiMessage(error));
      setSubmitting(false);
    }
  };

  const note = location && source ? PIN_NOTES[source] : null;
  const isFallback = source === "fallback";

  // Nothing chosen yet: ask who is listing and what for, first.
  if (!role || !purpose) {
    // key: /auth/me answers a moment after this mounts, and the new default
    // has to reach the radio group.
    return (
      <ListingStart
        key={user?.accountType ?? "loading"}
        defaultRole={user?.accountType}
        draft={
          draftOffer && {
            label: `${labelOf(draftOffer.role)} · ${labelOf(draftOffer.purpose)}`,
            title: draftOffer.data.title.trim(),
            savedAgo: formatTimeAgo(draftOffer.savedAt),
          }
        }
        onContinueDraft={() => draftOffer && restoreDraft(draftOffer)}
        onDiscardDraft={discardDraft}
      />
    );
  }

  // Agents must be registered with their state RERA to handle a sale.
  // Rentals and PG are exempt, and owners and builders are asked elsewhere.
  const needsRera =
    role === "BROKER" &&
    purpose === "SALE" &&
    !reraSkipped &&
    (reraStatus === "NONE" || reraStatus === "REVOKED");
  if (needsRera) {
    return (
      <AgentReraForm
        priorStatus={reraStatus}
        currentState={user?.agentReraState ?? null}
        onSkip={() => setReraSkipped(true)}
        onSaved={() => setReraStatus("PENDING")} // saved, not checked yet: let them carry on
        onBack={() => router.push("/list/create")}
      />
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-5 sm:py-8 lg:px-8 lg:py-10">
      {/* The wash is a fixed layer behind the page rather than a background on
          this column, which is centred and would have tinted only a strip down
          the middle. */}
      <div aria-hidden="true" className="form-paper fixed inset-0 -z-10" />

      {/* Back is where a phone user looks for it: top left. On the details
          step it returns to "who is listing", on the map step to the details;
          what has been typed is kept either way, because this component stays
          mounted while the question changes. */}
      <button
        type="button"
        onClick={() => {
          if (step === "contact") backToDetails();
          else router.push("/list/create");
        }}
        className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-[15px] font-medium text-muted transition-colors hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {step === "contact" ? "Back to details" : "Back"}
      </button>

      <header className="max-w-xl">
        <h1 className="font-display text-[28px] leading-tight lg:text-[34px]">
          List a property
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Tell buyers what the property is, then place it on the map.
        </p>
      </header>

      {/* What was chosen on the start screen; the form no longer asks these. */}
      <div className="mt-6 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="rounded-full bg-accent-soft px-3 py-1 font-medium text-accent">
          {labelOf(role)}
        </span>
        <span className="rounded-full bg-panel px-3 py-1 ring-1 ring-line">
          {labelOf(purpose)}
        </span>
        <button
          type="button"
          onClick={() => router.push("/list/create")}
          // A 44px-tall tap area around the word; the visible link stays small.
          className="-my-2 inline-flex min-h-11 items-center px-1.5 font-medium text-muted underline underline-offset-2 hover:text-ink"
        >
          Change
        </button>
      </div>

      {/* Said quietly: the seller should know their work is kept, without a
          banner for something that needs no action. */}
      {!draftOffer && draftSavedAt && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          <span>
            {restored
              ? `Restored your draft · saved on this device`
              : "Draft saved on this device"}
          </span>
          <button
            type="button"
            onClick={startOver}
            className="-my-2 inline-flex min-h-11 items-center px-1 font-medium underline underline-offset-2 hover:text-ink"
          >
            Start over
          </button>
        </p>
      )}

      {draftOffer && (
        <div
          role="status"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-accent/25 bg-accent-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-[14px] leading-snug text-ink">
            <span className="font-medium">You have an unfinished listing</span>
            <span className="text-muted">
              {" "}
              ({labelOf(draftOffer.role)} · {labelOf(draftOffer.purpose)}
              {draftOffer.data.title.trim() && `, “${draftOffer.data.title.trim()}”`}
              , saved {formatTimeAgo(draftOffer.savedAt)}). Nothing here is
              saved until you choose.
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => restoreDraft(draftOffer)}
              className={primaryButton}
            >
              Continue it
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className={secondaryButton}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {role === "BROKER" && purpose === "SALE" && reraStatus === "PENDING" && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent-soft px-3.5 py-3 text-[13px] leading-snug text-accent">
          Your RERA number is waiting to be verified.
          <InfoTip label="About RERA verification">
            It is not published yet. A verified badge appears on your listings
            once someone checks it against the state register.
          </InfoTip>
        </p>
      )}

      {step === "details" && (
      <>
      {/* No wrapper panel: each group below is its own card, so one more box
          around them would be a box inside a box. */}
      <p className="mt-5 text-[14px] text-muted sm:mt-6">
        The questions change with what you are listing.
      </p>
      <CardStack>
        <PropertyDetailsForm
          data={data}
          setData={setData}
          hideTypeAndRole
          cards
          sections={[
            "type",
            "configuration",
            "areaPrice",
            "location",
            "titleDescription",
            "amenities",
            "availability",
          ]}
        />
      </CardStack>
      </>
      )}

      {step === "contact" && (
      <>
      <div className="mt-5 sm:mt-6">
        <PropertyDetailsForm
          data={data}
          setData={setData}
          hideTypeAndRole
          cards
          sections={["contact"]}
        />
      </div>

      {/* The pin is required but belongs to no Field, so it has no asterisk of
          its own. Marking the heading is what carries that here. */}
      <h2 className={`mt-8 sm:mt-10 ${sectionTitle}`}>
        Where is the property?
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
        <span className="sr-only"> (required)</span>
      </h2>
      <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-muted">
        Detect the location or type the address, then drag the pin to the exact
        spot. Buyers search by this pin.
      </p>

      {/* Said before the pin is placed, not after. A seller who only learns
          that the pin is public once it is on their front door has been told
          too late — and some of them have good reasons not to show it. The
          wording offers the alternative rather than only the warning, because
          a caution with no way out just makes people abandon the step. */}
      {/* The one line stays visible; the detail is a tap away. */}
      <div className="mt-4 flex max-w-2xl items-center gap-1.5 rounded-lg border border-line bg-ground px-4 py-3">
        <p className="text-[14px] font-medium text-ink">
          Anyone viewing your listing sees this pin
        </p>
        <InfoTip label="Who can see the pin">
          It is shown to every visitor, not only to people you have spoken to.
          Place it on the property if you want buyers to find it easily. If you
          would rather not show the exact building, put the pin on the nearest
          junction or landmark instead &mdash; your listing still appears in
          searches for this area, and you can give the precise address when
          someone contacts you.
        </InfoTip>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 sm:mt-5 lg:grid-cols-[minmax(320px,380px)_1fr] lg:gap-6">
        <section className="rounded-lg border border-line bg-panel p-5">
          {/* Shown before the choice, so people know the most accurate way first. */}
          <div className="mb-4 flex gap-3 rounded-lg bg-accent-soft px-3.5 py-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            >
              <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
              <path d="M11 18.5h2" />
            </svg>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-accent">
                Most accurate: be at the property
              </p>
              <InfoTip label="Why be at the property">
                Open this page on your phone while you&apos;re at the property
                and tap{" "}
                <span className="font-medium">Use my current location</span>.
                Phone GPS is accurate to a few metres, so buyers and renters
                see exactly where the property is.
              </InfoTip>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={detectCurrentLocation}
              className={`w-full ${primaryButton}`}
            >
              Use my current location
            </button>
            <button
              type="button"
              onClick={() => setShowAddressForm(!showAddressForm)}
              aria-expanded={showAddressForm}
              className={`w-full ${secondaryButton}`}
            >
              {showAddressForm ? "Hide address form" : "Enter address manually"}
            </button>
          </div>

          {location && note && (
            <div
              className={`mt-5 rounded-lg px-3.5 py-3 ${
                isFallback
                  ? "border border-warn/25 bg-warn/5"
                  : "bg-accent-soft"
              }`}
            >
              <p
                className={`text-[13px] font-medium ${isFallback ? "text-warn" : "text-accent"}`}
              >
                {note.heading}
              </p>
              {!isFallback && (
                <p className="mt-1 tabular-nums text-[14px] text-ink">
                  {location[1].toFixed(5)}, {location[0].toFixed(5)}
                </p>
              )}
              <p className="mt-1.5 text-[13px] leading-snug text-muted">
                {note.help}
              </p>
            </div>
          )}

          {showAddressForm && (
            <AddressForm
              data={data}
              setData={setData}
              onLocate={placePin}
              onCancel={() => setShowAddressForm(false)}
            />
          )}
        </section>

        <section className="h-[260px] overflow-hidden rounded-lg border border-line bg-panel sm:h-[420px] lg:h-[560px]">
          {location ? (
            <MapPicker
              center={location}
              setLocation={(next) => placePin(next, "pin")}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <p className="max-w-xs text-center text-[15px] leading-relaxed text-muted">
                The map opens once a location is set. Detect it, or enter the
                address by hand.
              </p>
            </div>
          )}
        </section>
      </div>

      {sellerSale && (
        <section className="mt-5 rounded-lg border border-line bg-panel p-4 sm:mt-6 sm:p-5 lg:p-6">
          <div className="flex items-center gap-1.5">
            <h2 className={sectionTitle}>Which project is this unit in?</h2>
            <InfoTip label="About the project">
              {role === "BUILDER"
                ? "A project carries the RERA registration number a sale advertisement needs, so every unit you list in it is covered by the same number. If the project is not registered here yet, type its name and number instead. A ready resale or a single plot needs no project."
                : "If we do not have the project yet, type its name and RERA number as the builder gave them to you. A resale or a plot needs no project."}
            </InfoTip>
          </div>
          <p className="mt-1 max-w-prose text-[14px] leading-relaxed text-muted">
            Search for it, or type its name and RERA number.
          </p>

          <div className="mt-5">
            <ProjectPicker
              mode={role === "BUILDER" ? "own" : "search"}
              value={projectId}
              onChange={setProjectId}
              manualName={manual.manualName}
              manualRera={manual.manualRera}
              manualBuilder={manual.manualBuilder}
              manualAbsence={manual.manualAbsence}
              onManualChange={(field, value) =>
                setManual((previous) => ({
                  ...previous,
                  [field]: value,
                  // Typing a number withdraws the "it has none" answer, and
                  // picking a reason clears the number. Leaving both set would
                  // publish a number beside a line saying there is none.
                  ...(field === "manualRera" && value
                    ? { manualAbsence: "" }
                    : {}),
                  ...(field === "manualAbsence" && value
                    ? { manualRera: "" }
                    : {}),
                }))
              }
              mustHaveProject={needsProject}
            />
          </div>
        </section>
      )}

      </>
      )}

      {/* On a phone this bar stays on screen at the bottom: the form is five
          cards long, and Continue at the very end of it is out of reach for
          most of the page. From 640px up it is the ordinary footer row it
          always was. The bottom padding clears the iPhone home indicator. */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex flex-col gap-2.5 border-t border-line bg-panel/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:z-auto sm:mx-0 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:bg-transparent sm:px-0 sm:pt-6 sm:pb-0 sm:backdrop-blur-none">
        <p className="line-clamp-2 text-[13px] leading-snug text-muted sm:line-clamp-none sm:text-[14px]">
          {missingHere.length > 0
            ? `Still needed: ${missingHere.join(", ")}`
            : "Everything needed is filled in."}
        </p>
        <div className="flex gap-3 sm:items-center">
          {step === "contact" && (
            <button
              type="button"
              onClick={backToDetails}
              className={`shrink-0 ${secondaryButton}`}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (step === "details") {
                toMap();
                return;
              }
              void handleSubmit();
            }}
            disabled={missingHere.length > 0 || submitting}
            className={`flex-1 sm:flex-none ${primaryButton}`}
          >
            {step === "details"
              ? "Continue"
              : submitting
                ? "Saving…"
                : "Proceed"}
          </button>
        </div>
      </div>
    </main>
  );
};

export default CreateListing;
