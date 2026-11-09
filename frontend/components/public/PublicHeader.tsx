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
        {/* The one thing a seller arriving here needs to know, in the first
            place they look. Every Indian portal puts a post link in this bar,
            so it is where the habit sends them — and the stamp beside it is
            the claim, which on this site is true: there is no payment code in
            either project and Promotions has no price field. "Free", not
            "always free": the second is a promise about a business model that
            has not been decided, and this bar is the worst place to make one.

            Hidden below md, for the reason recorded above — the wordmark and
            two links already want ~304px where a 320px screen offers 280px. At
            sm this row measures roughly 575px of content in a 640px viewport,
            which fits and leaves nothing in hand for a longer wordmark or a
            wider font. md has ~190px spare. A broken header is much worse than
            a link a tablet in portrait still gets, so this takes the safe
            breakpoint; a seller below it meets the same sentence in How it
            works instead.

            min-h-11 is the 44px minimum lib/ui.ts records as the smallest
            target a finger hits reliably. Padding alone gave this ~38px — the
            same ~38px "Sign in" beside it has, which is worth fixing but is
            not this change.

            Points at register rather than /list/create. The form has no auth
            guard, so a visitor would reach it, fill it in and fail at submit;
            the same reason How it works offers Sign in and not the form.

            .annot is the drawing-stamp annotation that marks "India" on the
            wordmark: 11px, accent, uppercase. Reused rather than restyled,
            because this is the same kind of mark — a note stamped beside the
            thing it qualifies. */}
        <Link
          href="/auth/register"
          className="hidden min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
        >
          Post property
          <span className="annot">Free</span>
        </Link>
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
