"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinIcon } from "@/components/public/icons";
import { addressFromPin } from "@/lib/geocode";
import { errorToast } from "@/lib/toast";

// /list/search takes a place name, geocodes it, and searches a radius around
// that point. So the phone's coordinates become the name of the area the
// visitor is standing in, and the whole existing search path is reused.
const NEARBY_RADIUS = 10;

const NearbyButton = () => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const find = () => {
    if (!("geolocation" in navigator)) {
      errorToast("This browser cannot share your location.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const address = await addressFromPin([
            coords.longitude,
            coords.latitude,
          ]);
          // Nominatim fills whichever names exist around a point, so a rural
          // fix may have no locality at all.
          const place = address.locality || address.city || address.district;
          if (!place) {
            errorToast(
              "Could not tell which area you are in. Search by name instead.",
            );
            setBusy(false);
            return;
          }
          // view=map so the page opens on the pins, not the list.
          router.push(
            `/property/search?location=${encodeURIComponent(place)}&radius=${NEARBY_RADIUS}&view=map`,
          );
        } catch {
          errorToast("Could not look up your area. Please try again.");
          setBusy(false);
        }
      },
      (error) => {
        setBusy(false);
        // Each failure gets its own sentence. "Denied" lasts until the visitor
        // changes a browser setting, so inviting them to retry would be a lie.
        if (error.code === error.PERMISSION_DENIED) {
          errorToast(
            "Location is blocked for this site. Allow it in your browser settings.",
          );
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          errorToast(
            "Could not get a location fix. Try again, or search by area name.",
          );
          return;
        }
        errorToast(
          "Finding your location took too long. Try searching by area name.",
        );
      },
      {
        // The phone's GPS chip rather than wifi positioning: this is the whole
        // point of the feature on a mobile.
        enableHighAccuracy: true,
        // Indoors a fix can never arrive, and without this the button spins
        // for ever.
        timeout: 10_000,
        // A fix from the last minute is good enough for a 10 km radius.
        maximumAge: 60_000,
      },
    );
  };

  return (
    <button
      type="button"
      onClick={find}
      disabled={busy}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-ground text-[13px] font-semibold text-ink transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 md:h-9 md:w-auto md:bg-panel/95 md:px-4 md:shadow-[0_8px_24px_-12px_rgba(48,32,68,0.3)] md:ring-1 md:ring-line md:backdrop-blur-sm"
    >
      <PinIcon className="h-4 w-4" />
      {busy ? "Finding your location…" : "Find nearby properties"}
    </button>
  );
};

export default NearbyButton;
