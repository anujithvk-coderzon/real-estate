import Link from "next/link";

export const BRAND_PURPLE = "#7B0199";
export const BRAND_GOLD = "#FEBE01";

export const LogoMark = ({ className = "h-7 w-7" }: { className?: string }) => (
  <svg
    viewBox="0 0 32 40"
    aria-hidden="true"
    className={`${className} shrink-0`}
    fill="none"
  >
    <circle cx="16" cy="16" r="16" fill={BRAND_PURPLE} />
    <path d="M4.8 26 16 40l11.2-14Z" fill={BRAND_PURPLE} />
    <path d="M6.8 28.2 16 40l9.2-11.8Z" fill="#fff" />
    <path d="M8.6 30.4 16 38.6l7.4-8.2Z" fill={BRAND_GOLD} />
    <path
      d="M7.8 18.2 16 10.6l8.2 7.6"
      stroke="#fff"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22.6 10.9v6.1"
      stroke="#fff"
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <path
      d="M16 19.4a2.9 2.9 0 0 1 2.9 2.9v7.1h-5.8v-7.1A2.9 2.9 0 0 1 16 19.4Z"
      fill="#fff"
    />
  </svg>
);

export const Wordmark = ({ className = "" }: { className?: string }) => (
  <span className={`font-display font-extrabold tracking-tight ${className}`}>
    <span style={{ color: BRAND_PURPLE }}>Props</span>
    <span style={{ color: BRAND_GOLD }}>Near</span>
  </span>
);

const Logo = ({
  className = "",
  markClass = "h-7 w-7",
  textClass = "text-[20px] sm:text-[24px]",
  href = "/",
}: {
  className?: string;
  markClass?: string;
  textClass?: string;
  href?: string | null;
}) => {
  const inner = (
    <>
      <LogoMark className={markClass} />
      <Wordmark className={`${textClass} leading-none`} />
    </>
  );
  if (!href) return <span className={`flex items-center gap-1.5 ${className}`}>{inner}</span>;
  return (
    <Link
      href={href}
      aria-label="PropsNear — home"
      className={`flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${className}`}
    >
      {inner}
    </Link>
  );
};

export default Logo;
