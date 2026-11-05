"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinIcon } from "@/components/public/icons";
import { addressFromPin } from "@/lib/geocode";
import { errorToast } from "@/lib/toast";

// /list/search takes a place name, geocodes it, and searches a radius around
// that point. So the phone's coordinates become the name of the area the
// visitor is standing in, and the whole existing search path is reused.
//
// Only a fallback. The visitor may have picked a distance in the hero before
// pressing this, and that choice wins; this is the API's own default, which is
// also why an empty radius is left meaning "10" everywhere else.
const DEFAULT_RADIUS = 10;

// How coarse a fix we will still search from, in metres.
//
// The device is never asked what it is. A laptop on a known wifi network is
// often placed to within 30 m, while a phone indoors with GPS switched off
// falls back to the mobile network and can be out by 20 km — so "is this a
// phone?" is the wrong question, and screen width answers an even more
// different one (a tablet in landscape and a small laptop are the same width).
// What the browser does hand us is coords.accuracy: the radius, in metres, it
// is 95% confident the person is inside. That is the only honest test, and it
// works the same on every device.
//
// Half the radius, rather than a fixed number of metres: beyond that the
// circle we draw has more slack in it than area, and an IP-derived fix — which
// lands on the ISP's exchange — would produce a search that looks exactly like
// a working one while answering a question nobody asked. Expressed as a share
// because the radius is now the visitor's to choose: 5 km of error is useless
// against a 10 km search and unremarkable against a 50 km one, so a constant
// in metres would start rejecting fixes that are fine for the wider searches.
const WORST_FIX_SHARE = 0.5;

type Props = {
  // What the visitor already chose in the hero. Those three controls are
  // HeroStage's own React state, not URL params, so this button cannot read
  // them for itself — they are handed down here exactly as they are to
  // SearchBar, and for the same reason.
  listingType?: string;
  propertyType?: string;
  radius?: string;
};

const NearbyButton = ({
  listingType = "",
  propertyType = "",
  radius = "",
}: Props) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Resolved to a number here rather than left blank, because the accuracy
  // test below has to compare against it and the toast has to name it.
  const km = Number(radius) || DEFAULT_RADIUS;
  const worstFixMetres = km * 1000 * WORST_FIX_SHARE;

  const find = () => {
    if (!("geolocation" in navigator)) {
      errorToast("This browser cannot share your location.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        // Said in kilometres because that is the unit the search is in, and it
        // makes the reason obvious: "within 38 km" next to a 10 km search
        // explains itself.
        if (coords.accuracy > worstFixMetres) {
          errorToast(
            `Your location is only known to within ${Math.round(coords.accuracy / 1000)} km, which is too rough for a ${km} km search. Try searching by area name.`,
          );
          setBusy(false);
          return;
        }
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
          // The fix itself travels too, as me=lat,lon. The place name is what
          // the API searches by, but it is a SUBURB — the point Nominatim
          // returns for it can be a kilometre from where the visitor is
          // standing, and it is looked up again on every request, so a slow or
          // failed geocode would take the dot off the map with it. These
          // coordinates are the visitor's own and need nothing from the server.
          //
          // Four decimal places, about 11 m: enough to mark a spot inside a
          // 10 km circle, and no more of someone's position than that written
          // into a URL they might send to a friend.
          const me = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
          // The hero's choices travel with the position. Someone who picked
          // Buy, an apartment and 20 km before pressing this asked a narrower
          // question than "what is near me", and arriving at every property
          // type within 10 km is not an answer to it.
          //
          // Built with URLSearchParams rather than a template string so the
          // place name, which is user text from a geocoder, cannot end a value
          // early — and so an unchosen mode or type is simply absent instead of
          // present and empty.
          const params = new URLSearchParams({
            location: place,
            radius: String(km),
            // view=map so the page opens on the pins, not the list.
            view: "map",
            me,
          });
          if (listingType) params.set("listingType", listingType);
          if (propertyType) params.set("propertyType", propertyType);
          router.push(`/property/search?${params}`);
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
