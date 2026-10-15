// An isometric block with a keyhole cut into it, drawn on the same 30° grid the
// public site's property drawings use. A padlock icon would say "login"; this
// says "the building you manage", which is the thing behind the door.
const Keyhole = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 160 170"
    aria-hidden="true"
    className={className}
    fill="none"
  >
    {/* The plot it stands on: dashed, as a boundary is on a survey plan. */}
    <path
      d="M80 150 148 111 80 72 12 111Z"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="1.2"
      strokeDasharray="5 5"
    />
    {/* Two walls and a roof plate. The left face carries a tint and the right
        does not, so one light source is implied without drawing a shadow. */}
    <path
      d="M26 103 80 134 80 86 26 55Z"
      fill="currentColor"
      fillOpacity="0.14"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M80 134 134 103 134 55 80 86Z"
      fill="currentColor"
      fillOpacity="0.06"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M26 55 80 86 134 55 80 24Z"
      fill="currentColor"
      fillOpacity="0.1"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* The keyhole, sheared onto the right wall so it sits in the surface
        rather than floating in front of it. */}
    <g transform="translate(97 88) skewY(-30)">
      <circle cx="0" cy="0" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M0 6 0 20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

export default Keyhole;
