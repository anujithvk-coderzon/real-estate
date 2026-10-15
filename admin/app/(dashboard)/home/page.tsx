import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home — Properties staff" };

// A server component on purpose: nothing here needs the browser. The operator's
// name is rendered by the shell, which already had to fetch it to check the
// role, so this page has no reason to be a client component or to fetch again.
//
// There are deliberately no counts or charts on it. Nothing in the backend
// serves admin totals yet, and a dashboard showing invented numbers is worse
// than one that admits it is empty.
const AREAS = [
  {
    title: "Listings",
    body: "Every property on the public site, with the owner behind it. Approve, hide or remove.",
    needs: "an admin listings endpoint with paging",
  },
  {
    title: "Sellers",
    body: "Accounts, account type and the RERA details agents entered when they registered.",
    needs: "an admin users endpoint",
  },
  {
    title: "Interest",
    body: "Who tapped contact on which property, so a seller's claim can be checked against the record.",
    needs: "UserInterest to be migrated and read",
  },
] as const;

const PENDING = [
  "POST /admin/create has no auth on it — anyone who can reach the API can mint an ADMIN.",
  "A requireAdmin middleware, so the backend refuses an ordinary user's token instead of trusting this app.",
  "The database password and the operator password both still need rotating.",
] as const;

const Page = () => (
  <div className="mx-auto max-w-5xl">
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
      Admin
    </p>
    <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
      Home
    </h1>
    <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted sm:text-[15px]">
      The side of the marketplace buyers never see. Everything built here
      changes what the public site shows, so it stays behind one door.
    </p>

    <h2 className="mt-10 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
      Sections
    </h2>
    {/* auto-fit, so 320px gets one column and a desktop gets three without a
        breakpoint for each step. */}
    <ul className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      {AREAS.map((area) => (
        <li
          key={area.title}
          className="rounded-xl border border-line bg-panel p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-[17px]">{area.title}</h3>
            <span className="shrink-0 rounded-full bg-ground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
              Soon
            </span>
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            {area.body}
          </p>
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-muted/80">
            Waiting on {area.needs}.
          </p>
        </li>
      ))}
    </ul>

    <h2 className="mt-10 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
      Before this is usable
    </h2>
    <ol className="mt-3 space-y-3 rounded-xl border border-line bg-panel p-5">
      {PENDING.map((item, index) => (
        <li key={item} className="flex gap-3 text-[13.5px] leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent tabular-nums">
            {index + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  </div>
);

export default Page;
