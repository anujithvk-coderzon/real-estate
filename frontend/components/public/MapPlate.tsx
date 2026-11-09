import { TYPE_COLOUR } from "@/lib/listing";

// The illustrated map on the hero plate: land, water, parks, roads and a
// highway, drawn in the reference's own colours.
//
// Two deliberate departures from it.
//
// It carries no place names. Theirs letters KAKKANAD, VYTTILA and MARINE DRIVE
// onto a drawing with no data behind it, which on a property site reads as a
// claim about coverage. The streets are an illustration and say nothing; a
// locality name would be saying something untrue.
//
// And the dashed ring is not decoration here: it scales with the distance
// chosen in the search above it, so moving from 10 km to 50 km visibly widens
// the area being searched. That is the one thing on this drawing that means
// something, so it is the one thing in the accent colour.

// Where the pins sit, and what each one stands for.
//
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

// Smaller marks than before: PIN_SCALE 1 rather than 1.25, so a pin is 24x32
// units instead of 30x40 — about 21x28 CSS pixels on a 390px phone. At 1.25
// they read as balloons dropped on a drawing rather than as marks made on a
// map, and eight of them crowded a strip they had to share.
//
// The tip is the spot. The path's own tip is (12, 32) in a 24x32 box, so at
// scale 1 the translate backs out exactly that, and every y below is where the
// pin POINTS with its body standing in the 32 units above it.
const PIN_SCALE = 1;
const PIN_W = 24;
const PIN_H = 32;

// TWO tables, because the two bands this drawing is cropped to are not the
// same shape at all, and one set of positions tuned for the tighter one looked
// like a grid in the roomier one.
//
// SCATTER — the visitor hero on a phone. The plate is h-[72vw] with the search
// card starting at mt-[37vw], and both are a share of the width, so the crop
// is identical at every screen size: with offsetY 78 the drawing is visible
// from y 141, and the card's top edge lands at y 307.5. That is 166 units of
// clear map, which is room for an actual scatter — pins at eight different
// heights across 110 units, in two loose tiers rather than two rows.
//
// Three things it has to keep off.
//
// The halo at (225, 225): r 22 of accent-soft with the ink dot inside it, which
// is where the search is measured from and the one mark here that means
// something. Pins are drawn last, so one crossing it would hide it. No pin box
// enters x 195..255 by y 195..255 — which is why nothing sits in the middle of
// the drawing at the middle of its height, and why the two central pins pass
// above it and below it instead.
//
// The backwater, which runs diagonally down the left: roughly x 112..123 at
// y 164, narrowing to x 50..70 by y 270. Every box here clears it by at least
// 15 units.
//
// The parks, for the same reason the drawing carries no place names — a pin
// standing in the middle of a green block is saying something about a place
// that does not exist.
const PINS_SCATTER: { type: string; x: number; y: number }[] = [
  { type: "INDEPENDENT_HOUSE", x: 150, y: 196 },
  { type: "APARTMENT", x: 232, y: 190 },
  { type: "OFFICE", x: 316, y: 206 },
  { type: "ROOM", x: 396, y: 186 },
  { type: "VILLA", x: 118, y: 268 },
  { type: "PLOT", x: 180, y: 288 },
  { type: "COMMERCIAL", x: 282, y: 278 },
  { type: "PG", x: 372, y: 278 },
];

// STRIP — the signed-in bar, which is a fixed 208px tall at every width. Slice
// keeps the full width, so the slice of drawing that fits shrinks as the screen
// widens: 292 units at 320px, 91 at 1023px, the last pixel before lg hides the
// bar. There is no room to scatter in 91 units; what matters there is only that
// nothing is lost.
//
// So: two rows, and every body between y 189 and y 268 — 79 units straddling
// 225, the viewBox's own middle, which is the axis "YMid" crops about. A set
// centred there is the LAST thing a shrinking window loses, so all eight
// survive every width this bar is shown at. Rows 42 units apart, clearing the
// 32-unit pin height, so x may repeat between them. All x >= 160 keeps them
// off the backwater, which crosses the left of the drawing at exactly these
// rows.
//
// The second row's first pin is at x 172 rather than 200, which is where it sat
// until the boxes were measured against the halo: at 200 its box came within
// 14.8 units of (225, 225), inside the halo's own radius of 22 — and pins are
// drawn last, so it was sitting on top of the mark that says where the search
// is measured from. The nearest any pin now comes is 25.
const PINS_STRIP: { type: string; x: number; y: number }[] = [
  { type: "APARTMENT", x: 180, y: 222 },
  { type: "OFFICE", x: 262, y: 226 },
  { type: "ROOM", x: 344, y: 221 },
  { type: "VILLA", x: 418, y: 225 },
  { type: "INDEPENDENT_HOUSE", x: 172, y: 264 },
  { type: "PLOT", x: 282, y: 268 },
  { type: "COMMERCIAL", x: 364, y: 263 },
  { type: "PG", x: 428, y: 267 },
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
  const marks =
    pins === "scatter" ? PINS_SCATTER : pins === "strip" ? PINS_STRIP : [];
  // 10 km sits well inside the plate, 50 km reaches most of it. Linear, because
  // the point is to feel the difference rather than to be to scale.
  const ring = 72 + (Math.min(50, Math.max(10, radiusKm)) / 50) * 138;

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
      {/* the backwater */}
      <path
        d="M0 320 Q110 220 145 110 T265 -20 L210 -20 Q135 90 100 200 T-20 370"
        fill="#b9dbe2"
      />
      {/* parks and open blocks */}
      <g fill="#d7e3cc">
        <rect x="255" y="22" width="90" height="80" rx="20" />
        <rect x="310" y="283" width="110" height="95" rx="30" />
        <rect x="75" y="326" width="85" height="90" rx="22" />
        <rect x="204" y="270" width="57" height="50" rx="10" />
      </g>
      {/* the street grid, drawn in white as a printed map does */}
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
      {/* the search radius: the only element here carrying real state */}
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
          // The lift the real pins get from drop-shadow-md. Tinted with the
          // ink hue rather than black, like every other shadow on the site.
          style={{ filter: "drop-shadow(0 2px 2px rgba(48, 32, 68, 0.22))" }}
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
