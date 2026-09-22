"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddressForm from "@/components/AddressForm";
import MapPicker from "@/components/MapPicker";
import PropertyDetailsForm from "@/components/PropertyDetailsForm";
import { api } from "@/lib/api";
import { addressFromPin } from "@/lib/geocode";
import { buildListingPayload, getMissingFields } from "@/lib/listing";
import { errorToast, successToast } from "@/lib/toast";
import { emptyListing, type ListingFormData, type LngLat, type LocationSource } from "@/lib/types";
import { primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// What to tell the broker about the pin, depending on how it was placed.
const PIN_NOTES: Record<LocationSource, { heading: string; help: string }> = {
  gps: {
    heading: "Detected location",
    help: "Laptop location can be off by kilometres. Drag the pin to the exact spot, or open this page on your phone at the property and tap “Use my current location”.",
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

const CreateListingPage = () => {
  const router = useRouter();
  const [data, setData] = useState<ListingFormData>(emptyListing);
  const [location, setLocation] = useState<LngLat | null>(null);
  const [source, setSource] = useState<LocationSource | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // Whenever the pin moves, fill the address fields from it.
  useEffect(() => {
    if (!location) return;
    addressFromPin(location)
      .then((address) => {
        setData((prev) => ({ ...prev, ...address }));
        setShowAddressForm(true);
      })
      .catch(() => {
        // The broker can still type the address by hand.
      });
  }, [location]);

  const missing = getMissingFields(data, location);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await api.post("/list/create", buildListingPayload(data, location));
      successToast(response.data.message);
      router.push(`/list/create/media/${response.data.post.id}`);
    } catch (error) {
      errorToast(apiMessage(error));
      setSubmitting(false);
    }
  };

  const note = location && source ? PIN_NOTES[source] : null;
  const isFallback = source === "fallback";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col px-5 py-8 lg:px-8 lg:py-10">
      <header className="max-w-xl">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight lg:text-[34px]">
          List a property
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Tell buyers what the property is, then place it on the map.
        </p>
      </header>

      <section className="mt-8 rounded-lg border border-line bg-panel p-5 lg:p-6">
        <h2 className={sectionTitle}>Property details</h2>
        <p className="mt-1 text-[14px] text-muted">The questions change with what you are listing.</p>
        <div className="mt-6">
          <PropertyDetailsForm data={data} setData={setData} />
        </div>
      </section>

      <h2 className={`mt-10 ${sectionTitle}`}>Where is the property?</h2>
      <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-muted">
        Detect the location or type the address, then drag the pin to the exact spot. Buyers
        search by this pin.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          {/* Shown before the choice, so people know the most accurate way first. */}
          <div className="mb-4 flex gap-3 rounded-md bg-accent-soft px-3.5 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent">
              <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
              <path d="M11 18.5h2" />
            </svg>
            <div>
              <p className="text-[13px] font-semibold text-accent">Recommended: be at the property</p>
              <p className="mt-1 text-[13px] leading-snug text-ink/80">
                Open this page on your phone while you&apos;re at the property and tap{" "}
                <span className="font-medium text-ink">Use my current location</span>. Phone GPS is accurate to
                a few metres, so buyers and renters see exactly where the property is.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <button type="button" onClick={detectCurrentLocation} className={`w-full ${primaryButton}`}>
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
              className={`mt-5 rounded-md px-3.5 py-3 ${
                isFallback ? "border border-warn/25 bg-warn/5" : "bg-accent-soft"
              }`}
            >
              <p className={`text-[13px] font-medium ${isFallback ? "text-warn" : "text-accent"}`}>
                {note.heading}
              </p>
              {!isFallback && (
                <p className="mt-1 font-mono text-[14px] text-ink">
                  {location[1].toFixed(5)}, {location[0].toFixed(5)}
                </p>
              )}
              <p className="mt-1.5 text-[13px] leading-snug text-muted">{note.help}</p>
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

        <section className="h-[420px] overflow-hidden rounded-lg border border-line bg-panel lg:h-[560px]">
          {location ? (
            <MapPicker center={location} setLocation={(next) => placePin(next, "pin")} />
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <p className="max-w-xs text-center text-[15px] leading-relaxed text-muted">
                The map opens once a location is set. Detect it, or enter the address by hand.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">
          {missing.length > 0
            ? `Still needed: ${missing.join(", ")}`
            : "Everything needed is filled in."}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={missing.length > 0 || submitting}
          className={`w-full sm:w-auto ${primaryButton}`}
        >
          {submitting ? "Saving…" : "Proceed"}
        </button>
      </div>
    </main>
  );
};

export default CreateListingPage;
