import Link from "next/link";
import { primaryButton } from "@/lib/ui";

// Top bar for visitors who are not signed in. Signed-in users get the sidebar instead.
const PublicHeader = () => (
  <header className="border-b border-line bg-panel">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-10">
      <Link href="/" className="font-display text-[24px] leading-none text-ink">
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
