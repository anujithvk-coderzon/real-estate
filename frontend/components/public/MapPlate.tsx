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
const MapPlate = ({ radiusKm }: { radiusKm: number }) => {
  // 10 km sits well inside the plate, 50 km reaches most of it. Linear, because
  // the point is to feel the difference rather than to be to scale.
  const ring = 72 + (Math.min(50, Math.max(10, radiusKm)) / 50) * 138;

  return (
    <svg
      viewBox="0 0 450 450"
      // Covers its box rather than fitting inside it, so the drawing can be a
      // wide band on a phone. No effect where the box is square.
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`An illustrated map with a ${radiusKm} kilometre search radius marked on it`}
      className="h-full w-full"
    >
      {/* land */}
      <rect width="450" height="450" fill="#e9eee3" />
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
    </svg>
  );
};

export default MapPlate;
