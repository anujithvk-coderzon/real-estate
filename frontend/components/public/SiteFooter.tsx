import Link from "next/link";

// The footer every website has and this one did not. It is also the drawing
// set's back page: the wordmark, what the sheet is, and the index of everything
// on it.
//
// Every link here goes somewhere that exists. A footer full of About, Careers
// and Press links that 404 is worse than a short one that works.
const BROWSE = [
  { href: "/?all=1", label: "Every property" },
  { href: "/?listingType=SALE", label: "For sale" },
  { href: "/?listingType=RENT", label: "For rent" },
  { href: "/?listingType=PG", label: "PG and hostels" },
];

const TYPES = [
  { href: "/?propertyType=APARTMENT", label: "Apartments" },
  { href: "/?propertyType=INDEPENDENT_HOUSE", label: "Independent houses" },
  { href: "/?propertyType=VILLA", label: "Villas" },
  { href: "/?propertyType=PLOT", label: "Plots and land" },
  { href: "/?propertyType=OFFICE", label: "Offices" },
];

const HELP = [
  { href: "/#safety", label: "Before you pay anyone" },
  { href: "/#faq", label: "Questions people ask" },
  { href: "/property/search", label: "Search by location" },
];

const OWNERS = [
  { href: "/auth/register", label: "List a property" },
  { href: "/auth/login", label: "Sign in" },
];

const Column = ({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) => (
  <div className="min-w-0">
    <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
    <ul className="mt-3 space-y-2.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="text-[14px] text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const SiteFooter = () => (
  // White with hairline borders, as theirs is. A dark band at the foot would be
  // the only heavy block on an otherwise white page.
  <footer className="mt-16 border-t border-line bg-panel text-ink">
    <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-10 lg:py-12">
      <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
        <div className="min-w-0">
          <p className="font-display text-[24px] leading-none">
            Properties&#8599;
          </p>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-muted">
            Homes, plots and rooms across India. Listed by the people who own
            them, and by the brokers and builders who represent them.
          </p>
        </div>

        <Column title="Browse" links={BROWSE} />
        <Column title="Property types" links={TYPES} />
        <Column title="Help" links={HELP} />
        <Column title="Listing" links={OWNERS} />
      </div>

      {/* The sheet's bottom rule. The annotation carries the one fact a footer
          owes a visitor beyond the year: where this operates. */}
      <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">
          India &middot; All prices in rupees
        </p>
        <p className="text-[13px] text-muted">
          &copy; {new Date().getFullYear()} Properties
        </p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
