"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateIcon, PinIcon } from "@/components/public/icons";
import { fixErrorKm, gradeFix, widerRadiusFor } from "@/lib/fix";
import { addressFromPin } from "@/lib/geocode";
import { errorToast, warningToast } from "@/lib/toast";

// /list/search takes a place name, geocodes it, and searches a radius around
// that point. So the phone's coordinates become the name of the area the
// visitor is standing in, and the whole existing search path is reused.
//
// Only a fallback. The visitor may have picked a distance in the hero before
// pressing this, and that choice wins; this is the API's own default, which is
// also why an empty radius is left meaning "10" everywhere else.
const DEFAULT_RADIUS = 10;

// How coarse a fix we will still search from now lives in lib/fix.ts, with the
// geometry it comes from. Both thresholds are shared with the results page,
// which has to make the same judgement about the same fix in order to label it
// — and a policy copied into two files is a policy that will disagree with
// itself the first time one of them is edited.
//
// The device is never asked what it is. A laptop on a known wifi network is
// often placed to within 30 m, while a phone indoors with GPS switched off
// falls back to the mobile network and can be out by 20 km — so "is this a
// phone?" is the wrong question, and screen width answers an even more
// different one (a tablet in landscape and a small laptop are the same width).
// coords.accuracy is what the browser actually hands us, and it means the same
// thing everywhere.

type Props = {
  // What the visitor already chose in the hero. Those three controls are
  // HeroStage's own React state, not URL params, so this button cannot read
  // them for itself — they are handed down here exactly as they are to
  // SearchBar, and for the same reason.
  listingType?: string;
  propertyType?: string;
  radius?: string;
  // Icon only, for a row that already has a field and a submit in it.
  compact?: boolean;
  // The search already on screen, so pressing this on the results page keeps
  // the refinements made there — a budget, a bedroom count, a seller. Someone
  // who said "under 50 L" has not stopped meaning it by asking what is nearby.
  // Empty on the home page, where there is nothing yet to keep.
  keep?: string;
};

const NearbyButton = ({
  listingType = "",
  propertyType = "",
  radius = "",
  compact = false,
  keep = "",
}: Props) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Resolved to a number here rather than left blank, because the accuracy
  // test below is relative to it.
  const km = Number(radius) || DEFAULT_RADIUS;

  const find = () => {
    if (!("geolocation" in navigator)) {
      errorToast("This browser cannot share your location.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        // Three outcomes, not two, and the line between them is geometric
        // rather than chosen. See lib/fix.ts for the table it comes from.
        //
        // "useless" means the search circle and the circle the visitor is
        // actually standing in cannot touch: every property near them is
        // outside it and everything it returns is at least a radius away. No
        // wording makes that result honest, so it is the only case refused.
        //
        // The old guard refused everything above HALF the radius, which threw
        // away the whole middle band — a 21 km fix on a 20 km search covers
        // about half the area the visitor cares about, and half is not nothing
        // when the alternative is a toast.
        const grade = gradeFix(coords.accuracy, km);
        const offBy = fixErrorKm(coords.accuracy);
        if (grade === "useless") {
          // Name the error once and never the radius. It used to read "only
          // known to within 20 km, which is too rough for a 20 km search" —
          // the same number twice, apparently refusing itself, because the
          // number printed was the radius while the number tested was half of
          // it. "This distance" points at the Distance control without quoting
          // a figure back that invites the comparison.
          //
          // And it names a distance that would work, when one exists, so the
          // refusal is a route rather than a dead end. widerRadiusFor can
          // never return the distance already chosen: reaching this branch
          // means the fix is at least 2x the radius, so anything with overlap
          // is wider than what is set.
          const wider = widerRadiusFor(coords.accuracy);
          errorToast(
            wider
              ? `Your device could only place you within ${offBy} km, which is too rough for this distance. Try ${wider.label}, or search by area name.`
              : `Your device could only place you within ${offBy} km, which is too rough to search around you. Search by area name instead.`,
          );
          setBusy(false);
          return;
        }
        if (grade === "approximate") {
          // A warning, not an error: the search IS happening, and it is behind
          // this toast already. What it has to carry is the one thing the
          // results cannot show on their own — that the point everything was
          // measured from is not exactly where the visitor is standing.
          //
          // The results page says the same thing in a way that outlives a
          // toast: a note under the heading, the uncertainty drawn on the map,
          // and a ~ on every distance. This is the first warning, not the only
          // one, which is why it can afford to be one sentence.
          warningToast(
            `Your location is only known to within ${offBy} km, so distances here are rough. Search by area name for exact ones.`,
          );
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
          const params = new URLSearchParams(keep);
          // Each one overwrites whatever was there: this IS a new place, a new
          // distance and a new fix, and view=map because the answer to "what is
          // around me" is a map, not a list of names.
          params.set("location", place);
          params.set("radius", String(km));
          params.set("view", "map");
          params.set("me", me);
          // How wrong `me` might be, in whole metres, and only when it is
          // worth saying. A fix good enough to search in silence carries no
          // acc at all, so a precise search keeps a clean URL and the results
          // page has nothing to caveat.
          //
          // In the URL rather than in memory because the results page is a
          // separate route: a reload, a shared link or the back button all
          // arrive with no React state, and a page that forgot the fix was
          // rough would start stating rough distances as fact. The same
          // reasoning that put `me` here.
          //
          // Metres, as the browser gave it, so the one place that rounds is
          // the one place that prints.
          if (grade === "approximate")
            params.set("acc", String(Math.round(coords.accuracy)));
          else params.delete("acc");
          // Absent rather than present-and-empty, so the URL says only what was
          // actually chosen.
          if (listingType) params.set("listingType", listingType);
          else params.delete("listingType");
          if (propertyType) params.set("propertyType", propertyType);
          else params.delete("propertyType");
          // Any page past the first means nothing once the place changes.
          params.delete("page");
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

  // Beside a location field there is no room for four words, and none needed:
  // the crosshair on a map control has meant "where I am" for twenty years.
  // The name is still there for a screen reader and on a long press.
  if (compact) {
    return (
      <button
        type="button"
        onClick={find}
        disabled={busy}
        aria-label={busy ? "Finding your location" : "Search near me"}
        title="Search near me"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-panel text-muted ring-1 ring-line transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:w-10 lg:hidden"
      >
        <LocateIcon className={`h-5 w-5 ${busy ? "animate-pulse" : ""}`} />
      </button>
    );
  }

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
