"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import { primaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// Asked once, after the first sign-in. It only sets a default: the role is asked
// again for each listing, and can be changed in settings.
//
// NO RERA IN HERE, and it is a decision rather than an oversight.
//
// Each line below says what the role LETS YOU DO. Two of them used to quote a
// registration requirement instead — "a RERA agent number is needed for sale
// listings", "a project needs its RERA registration number" — and the first of
// those was not even true: nothing on the site checks agentReraNumber, and
// AgentReraForm carries a skip. See lib/rera for what a number actually buys,
// which is one badge.
//
// Three reasons the accurate version does not belong here either:
//
//  1. This page asks one question and commits the visitor to nothing. Its own
//     subtitle says so. A role that can be changed in settings should not be
//     described by its paperwork.
//  2. It is a cost quoted before any value has been shown. Someone who has not
//     yet listed anything or seen a results page reads a registration
//     requirement as the price of entry.
//  3. Nothing is lost by leaving it out, because it is not lost: the rule
//     appears where it can be acted on. CreateListing shows the agent form
//     before a broker's first sale listing, and the project form asks for the
//     number or the exemption — project.validation.ts requires one or the
//     other, with no exemption allowed above RERA_EXEMPT_MAX_UNITS units.
//
// The counter-argument, for whoever reads this next: RERA is a trust signal and
// not only friction. It is — for BUYERS. This page is seen by one signed-in
// person choosing their own role, so there is nobody here to reassure. That
// signal belongs on listings and seller profiles, which is where it is.
// WHERE EACH ANSWER GOES, and why this is the one screen that may do it.
//
// OnboardingGate holds a signed-in account on /welcome until it has a type, and
// stops checking the moment one is seen — so this page is reached exactly once,
// on a first registration, and never again. That is what makes routing by the
// answer safe here and wrong anywhere else: it is not a menu someone can come
// back to, so landing them deep costs them nothing they can lose.
//
// Every one of these is a page a brand-new account can actually use. Neither
// /list/create nor /list/my/projects/new asks for anything first, and
// /list/create with no query opens on its own "who are you listing as, and for
// sale or rent" step rather than on a form.
//
// replace, not push: Back from the destination must not return to a question
// that has already been answered and can no longer be asked.
const CHOICES = [
  {
    key: "BUYER",
    stored: "OWNER", // there is no buyer role; they can still list their own property
    // The home page, because searching is the thing they said they came for and
    // it is the one answer here that is not about listing.
    next: "/",
    label: "I'm looking for a property",
    help: "Search, save what you like and contact sellers. You can still list your own property any time.",
  },
  {
    key: "OWNER",
    stored: "OWNER",
    next: "/list/create",
    label: "I want to sell or rent my own property",
    // "No registration needed" only read as reassurance while the two roles
    // below were quoting registration requirements. With those gone it is a
    // contrast with nothing to contrast against, and it reintroduces the word
    // this page is meant to be rid of.
    help: "List your own flat, house or plot. Nothing to set up first.",
  },
  {
    key: "BUILDER",
    stored: "BUILDER",
    // The project form, not the listing form. A builder's units live inside a
    // project and carry its details, so the project is the thing that has to
    // exist first — sending them to /list/create would mean filling a unit's
    // form only to be asked which project it belongs to.
    next: "/list/my/projects/new",
    label: "I'm a builder or developer",
    help: "Add your projects, then list the units inside them — every unit carries its project's details.",
  },
  {
    key: "BROKER",
    stored: "BROKER",
    next: "/list/create",
    label: "I'm a broker or dealer",
    help: "List properties on behalf of owners and builders, however many you handle.",
  },
];

const Welcome = () => {
  const router = useRouter();
  const [choice, setChoice] = useState("BUYER");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const picked = CHOICES.find((option) => option.key === choice);
    if (!picked) return;
    setSaving(true);
    try {
      await api.patch("/auth/profile", { accountType: picked.stored });
      // After the PATCH, never before it: both listing destinations read
      // /auth/me to preselect the role, and OnboardingGate sends anyone whose
      // account still has no type straight back here. Navigating first would
      // race both of those.
      router.replace(picked.next);
    } catch (error) {
      errorToast(apiMessage(error));
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:py-16">
      <h1 className="font-display text-[26px] leading-tight sm:text-[32px] lg:text-[40px]">
        How will you use this site?
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        It only decides what we show you first. You can change it later in
        settings.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <fieldset>
          <legend className="sr-only">Choose what describes you</legend>
          <div className="space-y-3">
            {CHOICES.map((option) => {
              const selected = choice === option.key;
              return (
                <label
                  key={option.key}
                  className={`flex cursor-pointer gap-3 rounded-xl p-4 ring-1 transition-colors ${
                    selected
                      ? "bg-accent-soft ring-2 ring-accent"
                      : "bg-panel ring-line hover:ring-accent/40"
                  } has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-accent`}
                >
                  <input
                    type="radio"
                    name="choice"
                    value={option.key}
                    checked={selected}
                    onChange={() => setChoice(option.key)}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="block text-[15px] font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-muted">
                      {option.help}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* No way past this screen: every account carries a type, and the rest
            of the site reads it to decide what to offer. */}
        <div className="mt-8">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </main>
  );
};

export default Welcome;
