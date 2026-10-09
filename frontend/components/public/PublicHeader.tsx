import Link from "next/link";
import { primaryButton } from "@/lib/ui";

// Top bar for visitors who are not signed in. Signed-in users get the sidebar instead.
const PublicHeader = () => (
  <header className="border-b border-line bg-panel">
    {/* The wordmark and the two links need ~304px at full size, and a 320px
        screen offers 280px, so both shrink a step until there is room. */}
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-5 py-4 sm:gap-4 lg:px-10">
      <Link href="/" className="font-display text-[20px] leading-none text-ink sm:text-[24px]">
        Properties
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/auth/login" className="rounded-md px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:text-ink">
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
