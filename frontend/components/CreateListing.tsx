"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddressForm from "@/components/AddressForm";
import MapPicker from "@/components/MapPicker";
import AgentReraForm from "@/components/AgentReraForm";
import ListingStart from "@/components/ListingStart";
import ProjectPicker, { MANUAL, NONE } from "@/components/ProjectPicker";
import PropertyDetailsForm from "@/components/PropertyDetailsForm";
import { api } from "@/lib/api";
import { addressFromPin, pinFromAddress } from "@/lib/geocode";
import { buildListingPayload, getMissingFields } from "@/lib/listing";
import { errorToast, successToast } from "@/lib/toast";
import { labelOf } from "@/lib/listing";
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

const CreateListing = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Answered on the start screen: /list/create?as=OWNER&for=RENT
  const role = ROLES.find((value) => value === searchParams.get("as"));
  const purpose = PURPOSES.find((value) => value === searchParams.get("for"));

  // The signed-in user decides two things here: the pre-selected role on the start
  // screen, and whether an agent still has to give their RERA number.
  const [user, setUser] = useState<AuthUser | null>(null);
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
  const [manual, setManual] = useState({
    manualName: "",
    manualRera: "",
    manualBuilder: "",
    manualAbsence: "",
  });
  const [reraStatus, setReraStatus] = useState<VerificationStatus | null>(null);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((response) => {
        setUser(response.data.user);
        setReraStatus(response.data.user.agentReraStatus ?? "NONE");
      })
      .catch(() => {
        // The flow still works; the role just is not pre-selected.
      });
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
  ) =>
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
  const [location, setLocation] = useState<LngLat | null>(null);
  const [source, setSource] = useState<LocationSource | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "contact">("details");

  const placePin = (next: LngLat, how: LocationSource) => {
    setLocation(next);
    setSource(how);
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

  // Whenever the pin moves, fill the address fields from it — except when the
  // pin came from the town they typed, where reverse geocoding would overwrite
  // their own words with the geocoder's.
  useEffect(() => {
    if (!location || source === "region") return;
    addressFromPin(location)
      .then((address) => {
        setTyped((prev) => ({ ...prev, ...address }));
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
    "property name or number",
    "locality",
    "pincode",
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
    <main className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-5 sm:py-8 lg:px-8 lg:py-10">
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
          className="font-medium text-muted underline underline-offset-2 hover:text-ink"
        >
          Change
        </button>
      </div>

      {role === "BROKER" && purpose === "SALE" && reraStatus === "PENDING" && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3.5 py-3 text-[13px] leading-snug text-accent">
          Your RERA number is with us and not published yet. A verified badge
          appears on your listings once someone checks it against the state
          register.
        </p>
      )}

      {step === "details" && (
      <>
      <section className="mt-5 rounded-lg border border-line bg-panel p-4 sm:mt-6 sm:p-5 lg:p-6">
        <h2 className={sectionTitle}>Property details</h2>
        <p className="mt-1 text-[14px] text-muted">
          The questions change with what you are listing.
        </p>
        <div className="mt-6">
          <PropertyDetailsForm
            data={data}
            setData={setData}
            hideTypeAndRole
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
        </div>
      </section>
      </>
      )}

      {step === "contact" && (
      <>
      <section className="mt-5 rounded-lg border border-line bg-panel p-4 sm:mt-6 sm:p-5 lg:p-6">
        <h2 className={sectionTitle}>How buyers reach you</h2>
        <div className="mt-6">
          <PropertyDetailsForm
            data={data}
            setData={setData}
            hideTypeAndRole
            sections={["contact"]}
          />
        </div>
      </section>

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
      <div className="mt-4 max-w-2xl rounded-lg border border-line bg-ground px-4 py-3.5">
        <p className="text-[14px] font-medium text-ink">
          Anyone viewing your listing sees this pin
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          It is shown to every visitor, not only to people you have spoken to.
          Place it on the property if you want buyers to find it easily. If you
          would rather not show the exact building, put the pin on the nearest
          junction or landmark instead &mdash; your listing still appears in
          searches for this area, and you can give the precise address when
          someone contacts you.
        </p>
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
            <div>
              <p className="text-[13px] font-semibold text-accent">
                Recommended: be at the property
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ink/80">
                Open this page on your phone while you&apos;re at the property
                and tap{" "}
                <span className="font-medium text-ink">
                  Use my current location
                </span>
                . Phone GPS is accurate to a few metres, so buyers and renters
                see exactly where the property is.
              </p>
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
          <h2 className={sectionTitle}>Which project is this unit in?</h2>
          <p className="mt-1 max-w-prose text-[14px] leading-relaxed text-muted">
            {role === "BUILDER"
              ? "A project carries the RERA registration number a sale advertisement needs, so every unit you list in it is covered by the same number. If the project is not registered here yet, type its name and number instead. A ready resale or a single plot needs no project."
              : "Search the project this unit is in. If we do not have it yet, type its name and RERA number as the builder gave them to you. A resale or a plot needs no project."}
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

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
        <p className="text-[14px] text-muted">
          {missingHere.length > 0
            ? `Still needed: ${missingHere.join(", ")}`
            : "Everything needed is filled in."}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {step === "contact" && (
            <button
              type="button"
              onClick={() => {
                setStep("details");
                window.scrollTo({ top: 0 });
              }}
              className={`w-full sm:w-auto ${secondaryButton}`}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (step === "details") {
                setStep("contact");
                window.scrollTo({ top: 0 });
                return;
              }
              void handleSubmit();
            }}
            disabled={missingHere.length > 0 || submitting}
            className={`w-full sm:w-auto ${primaryButton}`}
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
