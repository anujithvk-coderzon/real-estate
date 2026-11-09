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
// Sized to 30x40 viewBox units, which is 26x35px once the band scales the
// drawing down on a phone — within a pixel or two of the real pin's 28x36.
//
// The tip is the spot, as it is there. So each y below is where the pin POINTS,
// and its body stands in the 40 units above that — which is why the topmost one
// sits at 208 and not 196: a tip at 196 would have its head clipped off by the
// band's top edge.
//
// What the pins do NOT do is claim inventory: no prices, no counts, no names,
// and they sit on invented streets. They are the legend made visible — "these
// kinds of property, around you" — in the same decorative register as the
// roads. If they ever gain a number beside them they have crossed into saying
// something untrue, which is the same line the missing place names hold.
//
// Positions are hand-placed, not random: all of them clear of the backwater,
// none on the centre where the visitor stands, and all inside y 180-380 so the
// phone's band — which crops to roughly that stripe — shows every one of the
// eight rather than a lucky three.
const PINS: { type: string; x: number; y: number }[] = [
  { type: "APARTMENT", x: 268, y: 208 },
  { type: "OFFICE", x: 392, y: 212 },
  { type: "INDEPENDENT_HOUSE", x: 196, y: 252 },
  { type: "ROOM", x: 330, y: 262 },
  { type: "VILLA", x: 404, y: 300 },
  { type: "PLOT", x: 240, y: 316 },
  { type: "COMMERCIAL", x: 182, y: 352 },
  { type: "PG", x: 306, y: 364 },
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
};

const MapPlate = ({ radiusKm, offsetY = 0 }: Props) => {
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
          translate-then-scale puts the tip on the spot: the path's own tip is
          (12, 32) in a 24x32 box, so at scale 1.25 that point lands 15 across
          and 40 down from the translate, and the translate backs both out. */}
      {PINS.map(({ type, x, y }) => (
        <g
          key={type}
          transform={`translate(${x - 15} ${y - 40}) scale(1.25)`}
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
