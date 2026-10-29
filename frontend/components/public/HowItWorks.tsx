import Link from "next/link";
import { primaryButton, secondaryButton } from "@/lib/ui";

// What this place is, for somebody who has never been here. Visitors only —
// a signed-in user has already decided.
//
// Every claim below is something the app actually does. No "verified
// listings", no "trusted agents", no number of users: a home page that
// promises more than the product does is the fastest way to lose the first
// enquiry.

const BUYER = [
  {
    title: "Search where you would actually live",
    body: "Name a locality and say how far you would travel. Every match comes back on a map, nearest first.",
  },
  {
    title: "Narrow it to what you mean",
    body: "Buy or rent, property type, a budget ceiling, bedrooms — and whether an owner, a broker or a builder posted it.",
  },
  {
    title: "Reach the seller directly",
    body: "Sign in to see their number, or message them here instead and keep your own number to yourself.",
  },
];

const SELLER = [
  {
    title: "Put it up with photographs",
    body: "Up to ten photographs and one video. Owners, brokers and builders all list on the same pages.",
  },
  {
    title: "Set it up once, list many times",
    body: "Your profile says whether you are an owner, a broker or a builder, and every listing carries it. Builders register a project once and list each unit inside it.",
  },
  {
    title: "Choose how buyers reach you",
    body: "Phone call, WhatsApp or chat here — turn on the ones you want and leave the rest off. Chat keeps your number private.",
  },
];

const Steps = ({
  eyebrow,
  heading,
  steps,
}: {
  eyebrow: string;
  heading: string;
  steps: { title: string; body: string }[];
}) => (
  <div className="rounded-2xl bg-panel p-6 ring-1 ring-line sm:p-7">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
      {eyebrow}
    </p>
    <h3 className="mt-2 font-display text-[22px] leading-tight">{heading}</h3>
    {/* Numbered, because these are in an order. The number is the only
        decoration in here — a row of icons would be three more things to
        read before the sentence that matters. */}
    <ol className="mt-5 space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3.5">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold tabular-nums text-accent"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

const HowItWorks = () => (
  // pb: the filter bar follows immediately and has no top margin of its own,
  // so without this the last line of the pitch sits on the first control.
  <section
    aria-labelledby="how-heading"
    className="mt-12 pb-10 sm:mt-16 sm:pb-12"
  >
    <div className="max-w-2xl">
      <h2
        id="how-heading"
        className="font-display text-[26px] leading-tight sm:text-[32px]"
      >
        How it works
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Homes, land, shops and single rooms across India — listed by the people
        who own them and by the brokers and builders who represent them.
      </p>
    </div>

    <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Steps eyebrow="If you are looking" heading="Find it" steps={BUYER} />
      <Steps eyebrow="If you are selling" heading="List it" steps={SELLER} />
    </div>

    <div className="mt-6 flex flex-wrap items-center gap-2.5">
      <Link href="/auth/register" className={primaryButton}>
        Create an account
      </Link>
      {/* Sign in, not /list/create: a visitor pressing that would be bounced
          to auth anyway, and the footer already treats "list a property" as a
          reason to make an account. Same pair the capped grid below offers. */}
      <Link href="/auth/login" className={secondaryButton}>
        Sign in
      </Link>
      <p className="text-[13px] text-muted">
        Free to browse. An account is needed to contact a seller or to list.
      </p>
    </div>
  </section>
);

export default HowItWorks;
