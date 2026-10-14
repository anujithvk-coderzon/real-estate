import Link from "next/link";
import { primaryButton } from "@/lib/ui";

// Top bar for visitors who are not signed in. Signed-in users get the sidebar instead.
const PublicHeader = () => (
  // Sits on the hero's grid rather than over a filled bar, so the sheet below it
  // reads as one surface. The rule is the only thing separating them.
  <header className="border-b border-line bg-panel/80 backdrop-blur-sm supports-[backdrop-filter]:bg-panel/70">
    {/* The wordmark and the two links need ~304px at full size, and a 320px
        screen offers 280px, so both shrink a step until there is room. */}
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-5 py-4 sm:gap-4 lg:px-10">
      <Link
        href="/"
        className="group flex items-baseline gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <span className="font-display text-[20px] leading-none text-ink sm:text-[24px]">
          Properties
        </span>
        {/* A scale annotation, the way a drawing is stamped. Carries the one piece
            of information a visitor needs about scope: this is an Indian site. */}
        <span className="annot hidden sm:inline">India</span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link
          href="/auth/login"
          className="rounded-lg px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Sign in
        </Link>
        <Link href="/auth/register" className={primaryButton}>
          Sign up
        </Link>
      </nav>
    </div>
  </header>
);

export default PublicHeader;
