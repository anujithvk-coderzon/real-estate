"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatNumber, formatRupeesShort } from "@/lib/format";
import { isRental, labelOf } from "@/lib/listing";
import type { PublicListingSummary } from "@/lib/types";

type Props = {
  listings: PublicListingSummary[];
  // What the map frames: the whole search. Filters then only add or remove pins,
  // so the view stays put instead of jumping (or flying off to all of India at 0 matches).
  frame?: PublicListingSummary[];
  activeSlug?: string | null;
  onActiveChange?: (slug: string | null) => void;
  onSelect?: (slug: string) => void;
};

// [longitude, latitude]: the middle of India, shown before any results arrive.
const INDIA_CENTER: [number, number] = [79, 22.5];

// MapLibre positions a marker by setting `transform` on the element it is given,
// so that outer element gets no styles of its own. The look (and the hover grow)
// lives on an inner <span>, so the two never fight over `transform`.
const pinLinkClass =
  "block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const pinLabelClass =
  "block origin-bottom text-accent drop-shadow-md transition-[scale] duration-150 hover:scale-110 motion-reduce:transition-none";

// A map pin: a filled teardrop with a white dot. Its tip is the listing's exact spot.
const PIN_SVG = `<svg viewBox="0 0 24 32" width="28" height="36" aria-hidden="true">
  <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0Z" fill="currentColor" stroke="white" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="4.5" fill="white"/>
</svg>`;

const cardClass =
  "block w-60 overflow-hidden rounded-xl bg-panel font-sans text-ink no-underline shadow-[0_12px_32px_-12px_rgba(13,42,36,0.45)] ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// "650 m" or "2.4 km"
const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`);

// The preview above a pin: a small copy of the result card, in the same order
// (photo → price → size and rooms → title → place), so nothing has to be re-learned.
// Built with textContent (never innerHTML), because titles and places are typed by users.
const buildCard = (listing: PublicListingSummary) => {
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
    labelOf(listing.propertyType),
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} bd` : "",
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} ba` : "",
    listing.areaValue ? `${formatNumber(listing.areaValue)} ${labelOf(listing.areaUnit)}` : "",
  ].filter(Boolean);

  const place = [listing.locality, listing.city].filter(Boolean).join(", ");
  const distance = typeof listing.distanceKm === "number" ? ` · ${formatDistance(listing.distanceKm)}` : "";

  const body = document.createElement("span");
  body.className = "block px-3 pb-3 pt-2.5";
  body.append(
    text(
      "block text-[17px] font-semibold leading-none tracking-tight tabular-nums",
      formatRupeesShort(listing.price) + (isRental(listing.listingType) ? " /month" : ""),
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
const ResultsMap = ({ listings, frame, activeSlug = null, onActiveChange, onSelect }: Props) => {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef(new Map<string, { marker: maplibregl.Marker; label: HTMLElement }>());

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
    created.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // Keep the map credits folded into their (i) button, so they never sit under the List button.
    created.on("load", () =>
      container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"),
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
      (listing) => listing.slug && typeof listing.latitude === "number" && typeof listing.longitude === "number",
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
      const card = buildCard(listing);
      card.addEventListener("click", (event) => {
        event.preventDefault(); // stay in the app instead of reloading the page
        router.push(`/property/${listing.slug}`);
      });
      card.addEventListener("mouseenter", keepOpen);
      card.addEventListener("mouseleave", hideSoon);
      popup.setLngLat([listing.longitude!, listing.latitude!]).setDOMContent(card).addTo(current);
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
      label.innerHTML = PIN_SVG; // our own fixed SVG, no user text, so innerHTML is safe here
      pin.append(label);
      pin.setAttribute("aria-label", `${listing.title}, ${formatRupeesShort(listing.price)}`);

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
  }, [listings, router]);

  // Frame the whole search once per result set. Filter changes don't touch the
  // camera, so a map the user has panned stays where they left it.
  const target = frame ?? listings;
  useEffect(() => {
    const current = map.current;
    const located = target.filter(
      (listing) => typeof listing.latitude === "number" && typeof listing.longitude === "number",
    );
    if (!current || located.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const listing of located) bounds.extend([listing.longitude!, listing.latitude!]);
    current.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
  }, [target]);

  // Light up the pin of the card being hovered (and bring it above its neighbours).
  useEffect(() => {
    pins.current.forEach(({ marker, label }, slug) => {
      const active = slug === activeSlug;
      label.classList.toggle("text-accent", !active);
      label.classList.toggle("text-ink", active);
      label.classList.toggle("scale-125", active);
      marker.getElement().style.zIndex = active ? "2" : "";
    });
  }, [activeSlug, listings]);

  return <div ref={container} className="h-full w-full" role="region" aria-label="Map of search results" />;
};

export default ResultsMap;
