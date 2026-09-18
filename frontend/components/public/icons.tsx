// Line icons for the public listing page, drawn on a 24px grid in the current
// text colour. They are decorative: the text next to each one says the same thing.

const Svg = ({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 ${className}`}
  >
    {children}
  </svg>
);

type IconProps = { className?: string };

export const AreaIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>
);
export const BedIcon = (props: IconProps) => (
  <Svg {...props}><path d="M3 19v-7.5A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5V19M3 15h18M6 9V6.5h5V9" /></Svg>
);
export const BathIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 12h16v2.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 14.5V12ZM6.5 12V6a2 2 0 0 1 4 0M7.5 19l-1 2M16.5 19l1 2" /></Svg>
);
export const BalconyIcon = (props: IconProps) => (
  <Svg {...props}><path d="M7 11V4.5h10V11M4 11h16M4 20h16M5.5 11v9M10 11v9M14 11v9M18.5 11v9" /></Svg>
);
export const SofaIcon = (props: IconProps) => (
  <Svg {...props}><path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5ZM6 18v2M18 18v2" /></Svg>
);
export const FloorIcon = (props: IconProps) => (
  <Svg {...props}><path d="M5 21V4h10v17M15 9h4v12M3 21h18M8.5 8h3M8.5 12h3M8.5 16h3" /></Svg>
);
export const ClockIcon = (props: IconProps) => (
  <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const CalendarIcon = (props: IconProps) => (
  <Svg {...props}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>
);
export const PinIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
);
export const CheckIcon = (props: IconProps) => (
  <Svg {...props}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const PhoneIcon = (props: IconProps) => (
  <Svg {...props}><path d="M5.5 4h3l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L15 13.5l5 2v3A2 2 0 0 1 18 20.5 16.5 16.5 0 0 1 3.5 6a2 2 0 0 1 2-2Z" /></Svg>
);
export const ChatIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20Z" /></Svg>
);
export const LockIcon = (props: IconProps) => (
  <Svg {...props}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Svg>
);
export const ExternalIcon = (props: IconProps) => (
  <Svg {...props}><path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></Svg>
);
