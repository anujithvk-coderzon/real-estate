"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatNumber, formatRupeesShort } from "@/lib/format";
import {
  TYPE_COLOUR,
  categoryLabel,
  categoryOf,
  isRental,
  labelOf,
} from "@/lib/listing";
import type { PublicListingSummary } from "@/lib/types";

type Props = {
  listings: PublicListingSummary[];
  // What the map frames: the whole search. Filters then only add or remove pins,
  // so the view stays put instead of jumping (or flying off to all of India at 0 matches).
  frame?: PublicListingSummary[];
  // THE point the API measured every distanceKm from. On a typed search that is
  // the place name as Nominatim geocoded it; on a nearby search it is the
  // device's own fix, which the API is now sent directly. The ring has to be
  // drawn around this and nothing else, because `distanceKm <= km` is the
  // filter that decided what came back.
  center?: [number, number] | null;
  // The radius the search used, so an empty result frames the area that was
  // actually looked at rather than an arbitrary zoom. Also what the ring on the
  // map measures.
  radiusKm?: number;
  // What to call that point: the name of the place the search was aimed at.
  centerLabel?: string;
  // The device's own position, when "Find nearby properties" supplied it.
  //
  // Still a separate prop from `center`, because the two are not always the
  // same point — but on a nearby search they now coincide, because the fix is
  // sent to the API and the API measures from it. They differ only when a
  // visitor who pressed the button then typed a different place, and keeping
  // them apart is what stops the ring from being drawn around a point the
  // `distanceKm <= km` filter never used: that mismatch is what once put a
  // property the API called 9.8 km away outside a 10 km circle.
  me?: [number, number] | null;
  // How wrong `me` might be, in kilometres, when the fix was too coarse to
  // state as fact. 0 or absent means it was good enough to say nothing about.
  //
  // Drawn as a second circle around the device dot, in the device's own blue,
  // because the map is the only place that can show what a caveat in words
  // cannot: the visitor is somewhere in THERE, and the search was run from one
  // point inside it. The gap between the two circles is the whole explanation
  // for why a distance on a card is approximate.
  accuracyKm?: number;
  activeSlug?: string | null;
  onActiveChange?: (slug: string | null) => void;
  onSelect?: (slug: string) => void;
};

// [longitude, latitude]: the middle of India, shown for the moment before the
// first frame is worked out, and when the place could not be geocoded at all.
const INDIA_CENTER: [number, number] = [79, 22.5];

// A box `km` either side of a point. A degree of latitude is ~111.32 km
// anywhere; a degree of longitude covers less ground the further from the
// equator you are, so it is divided by cos(latitude). Without that correction
// the box is noticeably too wide in Srinagar and barely wrong in Thiruvananthapuram
// — and this app covers both.
const boxAround = ([lon, lat]: [number, number], km: number) => {
  const latDelta = km / 111.32;
  const lonDelta = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return new maplibregl.LngLatBounds(
    [lon - lonDelta, lat - latDelta],
    [lon + lonDelta, lat + latDelta],
  );
};

// The searched area as a ring. 64 points is smooth at every zoom this map
// reaches, and the two deltas are the same ones boxAround uses — which makes
// this an ellipse in degrees and a circle on the ground. It has to be a circle,
// because the API's last filter is `distanceKm <= km`: a box would draw a
// promise the search does not keep at the corners.
const RING_POINTS = 64;
const circleAround = ([lon, lat]: [number, number], km: number) => {
  const latDelta = km / 111.32;
  const lonDelta = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let step = 0; step <= RING_POINTS; step += 1) {
    const angle = (step / RING_POINTS) * 2 * Math.PI;
    ring.push([
      lon + lonDelta * Math.cos(angle),
      lat + latDelta * Math.sin(angle),
    ]);
  }
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [ring] },
    properties: {},
  };
};

// One source, two layers drawn from it: a tint for the area and a dashed edge
// for the limit.
const AREA_SOURCE = "search-area";
const AREA_FILL = "search-area-fill";
const AREA_EDGE = "search-area-edge";

// And the same three for the uncertainty around the device fix. Its own source
// rather than a second feature in the first, because the two circles come and
// go independently: the search area is always drawn, this one only when the fix
// was coarse.
const FIX_SOURCE = "device-accuracy";
const FIX_FILL = "device-accuracy-fill";
const FIX_EDGE = "device-accuracy-edge";

// The device-location blue of every map people already use. The one place on
// this site that deliberately steps outside the palette: here the colour is
// not decoration, it is the meaning.
const DEVICE_BLUE = "#1a73e8";

// A dot on the map. Built as elements rather than innerHTML because the label
// comes from the URL, i.e. from a stranger.
const mapDot = (label: string, fromDevice: boolean) => {
  const host = document.createElement("div");
  // 44px so the halo has room; the dot itself is what marks the spot.
  host.className = "relative flex h-11 w-11 items-center justify-center";
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", label);
  host.setAttribute("title", label);
  // Under the listing pins: these say where you looked from, which matters less
  // than what was found.
  host.style.zIndex = "0";

  const halo = document.createElement("span");
  halo.className = "absolute inset-0 rounded-full";
  halo.style.background = fromDevice
    ? "rgba(26,115,232,0.18)"
    : "var(--color-accent-soft)";

  const dot = document.createElement("span");
  dot.className = "h-3.5 w-3.5 rounded-full shadow-md ring-2 ring-white";
  dot.style.background = fromDevice ? DEVICE_BLUE : "var(--color-ink)";

  host.append(halo, dot);
  return host;
};

// MapLibre positions a marker by setting `transform` on the element it is given,
// so that outer element gets no styles of its own. The look (and the hover grow)
// lives on an inner <span>, so the two never fight over `transform`.
const pinLinkClass =
  "block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// No text-accent here: the colour is set per pin from the property type, so a
// row of pins tells you what KIND of property is where before you click one.
const pinLabelClass =
  "block origin-bottom drop-shadow-md transition-[scale] duration-150 hover:scale-110 motion-reduce:transition-none";

// A map pin: a filled teardrop with a white dot. Its tip is the listing's exact spot.
const PIN_SVG = `<svg viewBox="0 0 24 32" width="28" height="36" aria-hidden="true">
  <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0Z" fill="currentColor" stroke="white" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="4.5" fill="white"/>
</svg>`;

// On a phone the map fills the screen, so a fixed 240px preview would hang over
// the edge for any pin near the sides.
const cardClass =
  "block w-[min(15rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-panel font-sans text-ink no-underline shadow-[0_12px_32px_-12px_rgba(48,32,68,0.45)] ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// "650 m" or "2.4 km"
const formatDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`;

// The preview above a pin: a small copy of the result card, in the same order
// (photo → price → size and rooms → title → place), so nothing has to be re-learned.
// Built with textContent (never innerHTML), because titles and places are typed by users.
const buildCard = (listing: PublicListingSummary, approximate: boolean) => {
  const text = (className: string, content: string) => {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = content;
    return element;
  };

  const card = document.createElement("a");
  card.href = `/property/${listing.slug}`;
  card.className = cardClass;

  const cover = listing.listingImages?.[0]?.path;
  if (cover) {
    const image = document.createElement("img");
    image.src = cover;
    image.alt = "";
    image.className = "block aspect-[16/10] w-full bg-ground object-cover";
    card.append(image);
  }

  const specs = [
    categoryLabel(listing),
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bd` : "",
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} ba` : "",
    listing.areaValue
      ? `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}`
      : "",
  ].filter(Boolean);

  const place = [listing.locality, listing.city].filter(Boolean).join(", ");
  // Same tilde the result cards use, for the same reason: this preview is a
  // small copy of one, and a distance that is an estimate there cannot be a
  // fact here.
  const distance =
    typeof listing.distanceKm === "number"
      ? ` · ${approximate ? "~" : ""}${formatDistance(listing.distanceKm)}`
      : "";

  const body = document.createElement("span");
  body.className = "block px-3 pb-3 pt-2.5";
  body.append(
    text(
      "block text-[17px] font-semibold leading-none tracking-tight tabular-nums",
      formatRupeesShort(listing.price) +
        (isRental(listing.listingType) ? " /month" : ""),
    ),
    text("mt-1.5 block truncate text-[13px]", specs.join(" · ")),
    text("mt-1 block truncate text-[13px] text-muted", listing.title),
    text("mt-1 block truncate text-[12px] text-muted", place + distance),
  );

  card.append(body);
  return card;
};

// Map of the search results: one pin per listing, kept in sync with the list.
//   hover a card  → its pin lights up          (activeSlug, from the list)
//   hover a pin   → preview card + card lights up (onActiveChange)
//   click a pin   → the list scrolls to that card (onSelect)
//   click preview → opens the listing
const ResultsMap = ({
  listings,
  frame,
  center = null,
  radiusKm = 10,
  centerLabel = "",
  me = null,
  accuracyKm = 0,
  activeSlug = null,
  onActiveChange,
  onSelect,
}: Props) => {
  const router = useRouter();
  // One derived flag for the three places that have to agree: the uncertainty
  // circle, the tilde in a pin's preview, and the dot's own label. It needs
  // BOTH a fix and a width — an accuracy with no `me` has nothing to be drawn
  // around, and a `me` with no accuracy was good enough to say nothing about.
  const approximate = Boolean(me) && accuracyKm > 0;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef(
    new Map<string, { marker: maplibregl.Marker; label: HTMLElement }>(),
  );

  // The parent's callbacks change on every render; keep the latest in a ref so the
  // pins (created once per result set) always call the current one.
  const callbacks = useRef({ onActiveChange, onSelect });
  useEffect(() => {
    callbacks.current = { onActiveChange, onSelect };
  });

  // Create the map once; remove it when the page closes.
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    const created = new maplibregl.Map({
      container: container.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE!,
      center: INDIA_CENTER,
      zoom: 4,
      attributionControl: { compact: true },
    });
    created.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    // Keep the map credits folded into their (i) button, so they never sit under the List button.
    created.on("load", () =>
      container.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show"),
    );
    map.current = created;

    // The map can start hidden (phones, "Hide map") and be shown later: redraw at the new size.
    const resize = new ResizeObserver(() => created.resize());
    resize.observe(container.current);

    return () => {
      resize.disconnect();
      created.remove();
      map.current = null;
    };
  }, []);

  // Put a pin on every listing that has a location, then zoom to fit them all.
  useEffect(() => {
    const current = map.current;
    if (!current) return;

    const pinned = listings.filter(
      (listing) =>
        listing.slug &&
        typeof listing.latitude === "number" &&
        typeof listing.longitude === "number",
    );

    // One shared popup: only one preview is open at a time.
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true, // tapping the map closes it
      offset: 40, // sit above the pin, not on top of it
      maxWidth: "none",
      focusAfterOpen: false, // a hover preview must not steal keyboard focus
      className:
        // `!`: MapLibre's own CSS sits outside Tailwind's layers, so it wins unless these are important.
        "[&_.maplibregl-popup-content]:bg-transparent! [&_.maplibregl-popup-content]:p-0! [&_.maplibregl-popup-content]:shadow-none! [&_.maplibregl-popup-tip]:hidden!",
    });
    popup.on("close", () => callbacks.current.onActiveChange?.(null));

    // Phones and tablets have no hover: the first tap shows the preview,
    // tapping the preview opens the listing.
    const canHover = window.matchMedia("(hover: hover)").matches;

    // Closing waits a moment, so the pointer can move from the pin onto the preview.
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const keepOpen = () => clearTimeout(hideTimer);
    const hideSoon = () => {
      hideTimer = setTimeout(() => popup.remove(), 200);
    };

    const showPreview = (listing: PublicListingSummary) => {
      keepOpen();
      const card = buildCard(listing, approximate);
      card.addEventListener("click", (event) => {
        event.preventDefault(); // stay in the app instead of reloading the page
        router.push(`/property/${listing.slug}`);
      });
      card.addEventListener("mouseenter", keepOpen);
      card.addEventListener("mouseleave", hideSoon);
      popup
        .setLngLat([listing.longitude!, listing.latitude!])
        .setDOMContent(card)
        .addTo(current);
      callbacks.current.onActiveChange?.(listing.slug);
    };

    pins.current.clear();
    for (const listing of pinned) {
      // A real link, so pins work with the keyboard and can open in a new tab.
      const pin = document.createElement("a");
      pin.href = `/property/${listing.slug}`;
      pin.className = pinLinkClass;
      const label = document.createElement("span");
      label.className = pinLabelClass;
      // PIN_SVG fills with currentColor, so one declaration colours the whole
      // teardrop and its outline stays white.
      label.style.color =
        TYPE_COLOUR[categoryOf(listing)] ?? "var(--color-accent)";
      label.innerHTML = PIN_SVG; // our own fixed SVG, no user text, so innerHTML is safe here
      pin.append(label);
      pin.setAttribute(
        "aria-label",
        `${listing.title}, ${formatRupeesShort(listing.price)}`,
      );

      pin.addEventListener("mouseenter", () => showPreview(listing));
      pin.addEventListener("mouseleave", hideSoon);
      pin.addEventListener("focus", () => showPreview(listing));
      pin.addEventListener("blur", hideSoon);
      pin.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation(); // don't let the map's click close the preview we are opening
        showPreview(listing);
        if (canHover) callbacks.current.onSelect?.(listing.slug!); // desktop: bring its card into view
      });

      const marker = new maplibregl.Marker({ element: pin, anchor: "bottom" }) // the tip marks the spot
        .setLngLat([listing.longitude!, listing.latitude!])
        .addTo(current);
      pins.current.set(listing.slug!, { marker, label });
    }

    // New results: take the old pins and preview off first.
    const placed = pins.current;
    return () => {
      clearTimeout(hideTimer);
      popup.remove();
      placed.forEach(({ marker }) => marker.remove());
      placed.clear();
    };
  }, [listings, router, approximate]);

  // Frame the whole search once per result set. Filter changes don't touch the
  // camera, so a map the user has panned stays where they left it.
  const target = frame ?? listings;
  // What the camera was last pointed at. Moving to a new place is a jump;
  // staying in the same place and changing the distance is a zoom you should be
  // able to watch, because the whole point is to see the area grow.
  const framed = useRef<string | null>(null);
  useEffect(() => {
    const current = map.current;
    if (!current) return;

    const key = center ? center.join(",") : "pins";
    const sameSpot = framed.current === key;
    framed.current = key;
    const duration =
      sameSpot && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 450
        : 0;

    // The searched area, whenever there is one — not the pins inside it. Every
    // result is within the radius (the API's last filter is distanceKm <= km),
    // so this frame can never cut a pin off, and it is the only frame that
    // answers the question the visitor actually asked: what is within 10 km of
    // me. Fitting the pins instead meant one property 2 km away filled the
    // screen at street level, the dot and the ring were off the edges, and
    // changing 10 km to 20 km moved nothing at all — the pins had not moved,
    // so the camera did not either.
    if (center) {
      current.fitBounds(boxAround(center, radiusKm), {
        // Room for the ring's edge to stay inside the frame, and on a phone
        // for the chrome sitting over the top of the map.
        padding: 36,
        duration,
      });
      return;
    }

    // No centre: the place could not be geocoded, so the pins are all there is
    // to aim at.
    const located = target.filter(
      (listing) =>
        typeof listing.latitude === "number" &&
        typeof listing.longitude === "number",
    );
    if (located.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const listing of located)
      bounds.extend([listing.longitude!, listing.latitude!]);
    current.fitBounds(bounds, { padding: 56, maxZoom: 14, duration });
  }, [target, center, radiusKm]);

  // The area that was searched: a dot where the search was aimed and a ring at
  // the distance it reached. This is what makes an empty result readable — the
  // visitor can see that the search happened, where from, and how far out it
  // went, instead of looking at a map that appears to have simply failed. On a
  // phone, where the list and its "nothing found" message are a screen away,
  // it is the only thing on screen that says anything at all.
  useEffect(() => {
    const current = map.current;
    if (!current) return;

    // How wrong the device fix might be, drawn around the device dot. Before
    // the early return below, because a search with no geocodable centre still
    // has a visitor standing somewhere, and a stale accuracy circle left on the
    // map would be claiming a width the current fix does not have.
    //
    // Solid where the search edge is dashed, and in the device's own blue
    // rather than the accent: the two circles mean different things and have to
    // be told apart at a glance. The ring is "what was searched". This is
    // "where you might be" — and when it is much the larger of the two, that
    // is the picture a sentence on a card cannot draw.
    const drawFix = () => {
      if (!me) return;
      const data = circleAround(me, accuracyKm);
      const existing = current.getSource(FIX_SOURCE);
      if (existing) {
        (existing as maplibregl.GeoJSONSource).setData(data);
        return;
      }
      current.addSource(FIX_SOURCE, { type: "geojson", data });
      current.addLayer({
        id: FIX_FILL,
        type: "fill",
        source: FIX_SOURCE,
        // Fainter than the search area's 0.06, because this circle is usually
        // the bigger of the two and a tint that reads well at 10 km would
        // flood the screen at 40.
        paint: { "fill-color": DEVICE_BLUE, "fill-opacity": 0.05 },
      });
      current.addLayer({
        id: FIX_EDGE,
        type: "line",
        source: FIX_SOURCE,
        paint: {
          "line-color": DEVICE_BLUE,
          "line-width": 1,
          "line-opacity": 0.45,
        },
      });
    };
    const clearFix = () => {
      for (const id of [FIX_FILL, FIX_EDGE])
        if (current.getLayer(id)) current.removeLayer(id);
      if (current.getSource(FIX_SOURCE)) current.removeSource(FIX_SOURCE);
    };
    if (approximate) {
      if (current.isStyleLoaded()) drawFix();
      else current.once("load", drawFix);
    } else clearFix();

    // A place the geocoder could not find has no area to draw, and a ring left
    // over from the previous search would be pointing at the wrong town.
    if (!center) {
      for (const id of [AREA_FILL, AREA_EDGE])
        if (current.getLayer(id)) current.removeLayer(id);
      if (current.getSource(AREA_SOURCE)) current.removeSource(AREA_SOURCE);
      // Returning here skips the cleanup at the bottom of the effect, so the
      // one listener registered above has to be let go of here too.
      return () => current.off("load", drawFix);
    }

    const data = circleAround(center, radiusKm);

    const draw = () => {
      const existing = current.getSource(AREA_SOURCE);
      if (existing) {
        (existing as maplibregl.GeoJSONSource).setData(data);
        return;
      }
      current.addSource(AREA_SOURCE, { type: "geojson", data });
      current.addLayer({
        id: AREA_FILL,
        type: "fill",
        source: AREA_SOURCE,
        // Faint: the tint is there to bound the area, not to tint the town.
        paint: { "fill-color": "#7947c6", "fill-opacity": 0.06 },
      });
      current.addLayer({
        id: AREA_EDGE,
        type: "line",
        source: AREA_SOURCE,
        // Dashed, because the edge is approximate in the way every radius is:
        // a listing 10.1 km away is not in it, and nobody should read the line
        // as a boundary on the ground.
        paint: {
          "line-color": "#7947c6",
          "line-width": 1.5,
          "line-opacity": 0.65,
          "line-dasharray": [2, 2],
        },
      });
    };

    // Layers can only be added once the style is in. The map is created in the
    // effect above, so on a first paint the style is usually still arriving.
    if (current.isStyleLoaded()) draw();
    else current.once("load", draw);

    // The middle of the ring, drawn only when there is a device fix to compare
    // it against. On a typed search that point is wherever the geocoder puts
    // the name — the centroid of a city the visitor never picked and cannot do
    // anything with — and a dot sitting there reads as "something is here".
    // The ring alone says what was searched, which is all a typed search has
    // to say. When the visitor's own position IS on the map, the pair of dots
    // is the explanation for the gap between them.
    const anchor = me
      ? new maplibregl.Marker({
          element: mapDot(centerLabel || "Where you searched", false),
        })
          .setLngLat(center)
          .addTo(current)
      : null;

    // And the visitor, where the phone says they are. Both are shown when they
    // differ, because that difference is the explanation for everything the
    // ring does: the circle is the area that was searched, the blue dot is you,
    // and a property can be near the one without being near the other.
    const here = me
      ? new maplibregl.Marker({
          element: mapDot(
            // The label is the dot's accessible name and its tooltip, so it is
            // the only place a screen reader learns the fix is rough.
            approximate
              ? `Roughly where you are, to within ${Math.ceil(accuracyKm)} km`
              : "You are here",
            true,
          ),
        })
          .setLngLat(me)
          .addTo(current)
      : null;

    return () => {
      current.off("load", draw);
      current.off("load", drawFix);
      anchor?.remove();
      here?.remove();
      // The layers are left in place and only re-fed above: a new search moves
      // the ring, it does not need a new source. They go with the map itself.
    };
  }, [center, radiusKm, centerLabel, me, accuracyKm, approximate]);

  // Light up the pin of the card being hovered (and bring it above its neighbours).
  useEffect(() => {
    pins.current.forEach(({ marker, label }, slug) => {
      const active = slug === activeSlug;
      label.classList.toggle("text-accent", !active);
      label.classList.toggle("text-ink", active);
      label.classList.toggle("scale-125", active);
      // "1", not "": every listing pin stays above the centre dot, whose own
      // z-index is 0, and the hovered one above its neighbours.
      marker.getElement().style.zIndex = active ? "2" : "1";
    });
  }, [activeSlug, listings]);

  return (
    <div
      ref={container}
      className="h-full w-full"
      role="region"
      aria-label="Map of search results"
    />
  );
};

export default ResultsMap;
