import { TYPE_COLOUR } from "@/lib/listing";

// The illustrated map on the hero plate: land, water, parks, roads and a
// highway, drawn in the reference's own colours.
// Two deliberate departures from it.
// It carries no place names. Theirs letters KAKKANAD, VYTTILA and MARINE DRIVE
// onto a drawing with no data behind it, which on a property site reads as a
// claim about coverage. The streets are an illustration and say nothing; a
// locality name would be saying something untrue.
// And the dashed ring is not decoration here: it scales with the distance
// chosen in the search above it, so moving from 10 km to 50 km visibly widens
// the area being searched. That is the one thing on this drawing that means
// something, so it is the one thing in the accent colour.

// Where the pins sit, and what each one stands for.
// Keyed by property type rather than given a colour here, so every colour comes
// from TYPE_COLOUR — the same lookup behind the search map's pins, the dot on a
// card and MapLegend. One source for the code means a colour changed there
// changes here, and this drawing can never teach a key the real map contradicts.
//
// The shape is lifted from the search map, not invented here: the same path,
// the same white casing and the same white eye at its middle as PIN_SVG in
// ResultsMap, so a pin on this drawing is the pin the visitor will meet when
// they actually search. An illustration that taught a different mark would be
// teaching a key the real map then contradicts.
//
// What the pins do NOT do is claim inventory: no prices, no counts, no names,
// and they sit on invented streets. They are the legend made visible — "these
// kinds of property, around you" — in the same decorative register as the
// roads. If they ever gain a number beside them they have crossed into saying
// something untrue, which is the same line the missing place names hold.

// Pins on the BAND only. The md circle shows the drawing, the radius ring and
// the centre dot, and nothing else.
//
// It carried a scatter of all eight until it was measured. From md the search
// card is absolutely positioned across the middle of this plate
// (md:inset-x-9 md:top-1/2 md:-translate-y-1/2 in HeroStage), and the plate is
// 352px square — so the card covers a horizontal band about 160px tall and
// 280px wide out of 352, which in viewBox units is x 46..404 of 450 and y
// 123..327 of 450. The scatter occupied y 168..364. Of eight pins, two were
// hidden outright, four showed only a fragment — a tip below a pill, a sliver
// in a 10px gap between two pills, half a head cut off by a straight edge —
// and the card is near-opaque at those sizes, so there was nothing to see
// through. Fragments of saturated colour leaking out around a floating control
// is what "very bad UI/UX" was describing, and no arrangement fixes it: the
// free area is a thin annulus, and at md the card is taller still because
// NearbyButton is in it until lg.
//
// The deeper reason not to try. Roughly 100px below this circle, from md, sits
// a labelled row of the same legend: one card per SEARCH_PROPERTY_TYPES, each
// with a TYPE_COLOUR dot and the type's NAME, under the heading "Every kind of
// property, in one search". Pins here are that legend again, unlabelled, in
// the one place it cannot be read. The phone keeps them because the phone has
// no such row — there the pins ARE the legend, and the band leaves them room.

//
const PIN_SCALE = 0.65;
const PIN_W = 24;
const PIN_H = 32;

//
//
//
//
//
//
//
//
const PIN_MARGIN = 4;

type PinSlot = { type: string; y: number; u: number };

const PINS_SCATTER: PinSlot[] = [
  { type: "APARTMENT", y: 195, u: -0.317 },
  { type: "INDEPENDENT_HOUSE", y: 206, u: 0.763 },
  { type: "COMMERCIAL", y: 235, u: 0.456 },
  { type: "ROOM", y: 246, u: 0.943 },
  { type: "VILLA", y: 254, u: -0.628 },
  { type: "OFFICE", y: 275, u: 0.368 },
  { type: "PG", y: 283, u: -0.569 },
  { type: "PLOT", y: 295, u: 0.894 },
];

//
//
//
const PINS_STRIP: PinSlot[] = [
  { type: "INDEPENDENT_HOUSE", y: 180, u: 0.767 },
  { type: "PLOT", y: 190, u: -0.436 },
  { type: "VILLA", y: 211, u: 0.947 },
  { type: "OFFICE", y: 237, u: 0.362 },
  { type: "COMMERCIAL", y: 252, u: 0.837 },
  { type: "PG", y: 265, u: -0.59 },
  { type: "APARTMENT", y: 275, u: 0.56 },
  { type: "ROOM", y: 303, u: -0.469 },
];

type Props = {
  radiusKm: number;
  // How far to slide the drawing up, in viewBox units, by moving the window
  // down over it. 0 leaves the plate centred as it was.
  //
  // A number rather than a preserveAspectRatio switch: xMidYMax would shove the
  // whole drawing up by its full overflow — about 107px on a phone — and take
  // the ring's centre off the top edge with it, which loses the one element on
  // here that means anything. This dials the same move in units you can tune.
  offsetY?: number;
  // Which set of marks, or none at all. Named for the pins rather than for the
  // shape, because the drawing is the same either way and only the marks
  // differ: "scatter" for the phone hero's roomy crop, "strip" for the
  // signed-in bar's tight one, "none" for the md circle. See the notes above
  // each table, and above PINS_SCATTER for why the circle takes none.
  pins?: "scatter" | "strip" | "none";
};

const MapPlate = ({ radiusKm, offsetY = 0, pins = "none" }: Props) => {
  const slots =
    pins === "scatter" ? PINS_SCATTER : pins === "strip" ? PINS_STRIP : [];
  // 10 km sits well inside the plate, 50 km reaches most of it. Linear, because
  // the point is to feel the difference rather than to be to scale.
  const ring = 72 + (Math.min(50, Math.max(10, radiusKm)) / 50) * 138;

  const marks = slots.map(({ type, y, u }) => {
    const dy = y - 225;
    const chord = Math.sqrt(Math.max(0, ring * ring - dy * dy));
    const half = Math.max(0, chord - PIN_MARGIN - (PIN_W * PIN_SCALE) / 2);
    return { type, x: 225 + u * half, y };
  });

  return (
    <svg
      // The y origin is what offsetY moves. Shifting the window down the
      // drawing shows a lower stripe of it, which on screen reads as the map
      // sliding up.
      viewBox={`0 ${offsetY} 450 450`}
      // Covers its box rather than fitting inside it, so the drawing can be a
      // wide band on a phone. No effect where the box is square.
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`An illustrated map with a ${radiusKm} kilometre search radius marked on it`}
      className="h-full w-full"
    >
      {/* land — oversized on every side so any offsetY still lands on ground
          rather than on a white gap where the rect ran out */}
      <rect x="-20" y="-80" width="490" height="620" fill="#e9eee3" />
      <path
        d="M0 320 Q110 220 145 110 T265 -20 L210 -20 Q135 90 100 200 T-20 370"
        fill="#b9dbe2"
      />
      <g fill="#d7e3cc">
        <rect x="255" y="22" width="90" height="80" rx="20" />
        <rect x="310" y="283" width="110" height="95" rx="30" />
        <rect x="75" y="326" width="85" height="90" rx="22" />
        <rect x="204" y="270" width="57" height="50" rx="10" />
      </g>
      <g stroke="#ffffff" fill="none" strokeWidth="10">
        <path d="M0 170 L450 330 M85 0 L300 450 M295 0 L190 450 M0 80 L450 210 M0 380 L450 100 M0 275 L450 400" />
        <path d="M355 0 L320 450 M0 120 L450 60" strokeWidth="5" />
      </g>
      {/* a highway: a sand casing with a lighter fill over it, which is how a
          road is drawn on paper and why it reads as the biggest route here */}
      <path
        d="M-20 260 Q180 155 460 240"
        stroke="#ecd4a3"
        strokeWidth="13"
        fill="none"
      />
      <path
        d="M-20 260 Q180 155 460 240"
        stroke="#fff7e5"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx="225"
        cy="225"
        r={ring}
        fill="var(--color-accent)"
        fillOpacity="0.05"
        stroke="var(--color-accent)"
        strokeOpacity="0.55"
        strokeDasharray="5 6"
        // 420ms: long enough to read as the area growing, short enough that it
        // has settled before the eye returns to the search box.
        style={{ transition: "r 420ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      {/* Where the search is measured from, at the ring's own centre — and
          again copied rather than invented: mapDot in ResultsMap draws the
          searched place as an ink dot in a white ring inside an accent-soft
          halo, so that is what this is. Ink, which is not one of the eight
          category colours, because this marks the visitor and not a property.

          Under the pins both here and there: where you looked from matters
          less than what was found. Drawn after the ring so the dashes do not
          cut through it. */}
      <circle cx="225" cy="225" r="22" fill="var(--color-accent-soft)" />
      <circle
        cx="225"
        cy="225"
        r="7.5"
        fill="var(--color-ink)"
        stroke="#ffffff"
        strokeWidth="3"
      />
      {/* The pins, last, so no road, halo or ring dash crosses one.
          translate-then-scale puts the tip on the spot: the path's tip is
          (12, 32) of its own 24x32 box, so backing out half the width and the
          full height lands that point exactly on (x, y). Written from
          PIN_W/PIN_H rather than as the two numbers they work out to, because
          the last time the scale changed these were left saying 15 and 40. */}
      {marks.map(({ type, x, y }) => (
        <g
          key={type}
          transform={`translate(${x - PIN_W / 2} ${y - PIN_H}) scale(${PIN_SCALE})`}
          style={{
            filter: "drop-shadow(0 2px 2px rgba(48, 32, 68, 0.22))",
            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <path
            d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0Z"
            fill={TYPE_COLOUR[type]}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
        </g>
      ))}
    </svg>
  );
};

export default MapPlate;
