// A property type drawn as a tiny solid in the same axonometric projection as
// the hero house: an apartment is stacked slabs, a plot is bare ground, a villa
// is wide and low, an office is a tall block. So the glyph says something about
// the property rather than being a generic house pictogram on every card.
//
// Every solid is generated from one base rhombus, which is why they share a
// vanishing geometry and look like they came off the same drawing.

const CX = 12;
// tan 30°, the gradient of every sloping edge in an isometric projection.
const SLOPE = 0.577;

// The three visible faces of a box standing on a rhombus whose bottom vertex is
// at (CX, base). Returns [left, right, top] as path data.
const box = (base: number, height: number, halfWidth: number) => {
  const hh = halfWidth * SLOPE;
  const b = [CX, base];
  const r = [CX + halfWidth, base - hh];
  const t = [CX, base - hh * 2];
  const l = [CX - halfWidth, base - hh];
  const up = ([x, y]: number[]) => `${x},${(y ?? 0) - height}`;
  return [
    `M${l[0]},${l[1]} L${b[0]},${b[1]} L${up(b)} L${up(l)}Z`,
    `M${b[0]},${b[1]} L${r[0]},${r[1]} L${up(r)} L${up(b)}Z`,
    `M${up(l)} L${up(b)} L${up(r)} L${up(t)}Z`,
  ];
};

// Ground only. A plot has no building on it, and drawing one would be a lie.
const GROUND = `M${CX},21 L${CX + 9},15.8 L${CX},10.6 L${CX - 9},15.8Z`;

const Glyph = ({ faces, tint }: { faces: string[]; tint: boolean }) => (
  <>
    {faces.map((face, index) => (
      <path
        key={index}
        d={face}
        // Left face tinted, right face clear: one implied light source, shared
        // with the hero drawing, so no glyph needs its own shadow.
        fill={
          index === 1
            ? "var(--color-panel)"
            : tint
              ? "var(--color-ground)"
              : "none"
        }
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    ))}
  </>
);

const Solid = ({ type }: { type: string }) => {
  switch (type) {
    case "PLOT":
      // Bare ground, dashed like a boundary on a survey sheet.
      return (
        <path
          d={GROUND}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 2.5"
          strokeLinejoin="round"
        />
      );

    case "APARTMENT":
      // Three slabs: a unit inside a stack, which is what an apartment is.
      return (
        <>
          <Glyph faces={box(21, 3.4, 8)} tint />
          <Glyph faces={box(17.2, 3.4, 8)} tint />
          <Glyph faces={box(13.4, 3.4, 8)} tint />
        </>
      );

    case "COMMERCIAL":
    case "OFFICE":
      // One tall block. The band marks a floor line, so it reads as storeys
      // rather than a monolith.
      return (
        <>
          <Glyph faces={box(21, 12, 7)} tint />
          <path
            d={`M5,${15.96 - 6} L12,${20.96 - 6} L19,${15.96 - 6}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.6"
          />
        </>
      );

    case "ROOM":
      // A single low cell sitting inside its plot: a room within something bigger.
      return (
        <>
          <path
            d={GROUND}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeDasharray="3 2.5"
            opacity="0.5"
          />
          <Glyph faces={box(19, 4, 4.6)} tint />
        </>
      );

    case "VILLA":
      // Wide and low, with the roof that marks it as a dwelling.
      return (
        <>
          <Glyph faces={box(21, 5, 9)} tint />
          <path
            d="M3,10.8 L12,16 L12,8Z"
            fill="var(--color-ground)"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M12,16 L21,10.8 L12,8Z"
            fill="var(--color-panel)"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </>
      );

    default:
      // Independent house, and the fallback for anything new: one storey, pitched.
      return (
        <>
          <Glyph faces={box(21, 6, 7.5)} tint />
          <path
            d="M4.5,10.7 L12,15 L12,7.4Z"
            fill="var(--color-ground)"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M12,15 L19.5,10.7 L12,7.4Z"
            fill="var(--color-panel)"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </>
      );
  }
};

const TypeGlyph = ({
  type,
  className = "",
}: {
  type: string;
  className?: string;
}) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <Solid type={type} />
  </svg>
);

export default TypeGlyph;
