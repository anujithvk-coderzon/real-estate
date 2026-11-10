"use client";

import { useState } from "react";
import { Field } from "@/components/form/Field";
import { api } from "@/lib/api";
import { errorToast, successToast } from "@/lib/toast";
import { inputClass, primaryButton, secondaryButton } from "@/lib/ui";
import type { VerificationStatus } from "@/lib/types";
import { apiMessage } from "@/lib/validation/apiError";

// Every state runs its own RERA, so the number belongs to one of them.
const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

// All eight, of which only Delhi and Puducherry were here. A broker in
// Chandigarh or Jammu and Kashmir could not say where they are registered, so
// they could not register at all — and both have their own authority.
//
// Eight, not six: there were seven until the Jammu and Kashmir reorganisation
// in 2019 made nine, and Dadra and Nagar Haveli merging with Daman and Diu in
// January 2020 brought it back to eight.
const UNION_TERRITORIES = [
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

type Props = {
  // Where they stand before this form is submitted. It decides the opening
  // line, and a rejection and a withdrawal need different ones: one is "the
  // number you typed is wrong", the other is "the registration you had is no
  // longer good".
  priorStatus?: VerificationStatus | null;
  onSaved: () => void; // the number is stored; carry on
  onBack: () => void;
  // "page": its own screen in the create flow. "inline": inside a settings card.
  variant?: "page" | "inline";
  // Shown in the number field when they already have one on file.
  current?: string | null;
  // The state that number was filed in, when there is one. Without it an edit
  // asks for the state again, and the only answer the form could offer by
  // itself was a guess.
  currentState?: string | null;
  // "I will do this later". Only passed where carrying on without a number is
  // allowed — the create flow — so the Settings card does not grow a button
  // for skipping something nobody made them open.
  onSkip?: () => void;
};

// Shown to a broker or dealer before their first sale listing. Agents must be
// registered with their state RERA to handle a sale; rentals are exempt, so this
// never appears for rent or PG.
const AgentReraForm = ({
  priorStatus = null,
  onSaved,
  onBack,
  variant = "page",
  current,
  currentState,
  onSkip,
}: Props) => {
  const [state, setState] = useState(currentState ?? "");
  const [number, setNumber] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  const canSave = state !== "" && number.trim().length >= 5 && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const response = await api.patch("/auth/agent-rera", {
        agentReraNumber: number.trim(),
        agentReraState: state,
      });
      successToast(response.data.message ?? "Registration saved");
      onSaved();
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
      <Field id="rera-state" label="State or union territory">
        <select
          id="rera-state"
          value={state}
          onChange={(event) => setState(event.target.value)}
          className={inputClass}
        >
          <option value="">Select your state</option>
          {/* Grouped: in one flat list of 36, nobody can tell whether their
              own union territory is in there or simply absent. */}
          <optgroup label="States">
            {STATES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Union territories">
            {UNION_TERRITORIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field
        id="rera-number"
        label="RERA agent registration number"
        hint="Exactly as it appears on your certificate."
      >
        <input
          id="rera-number"
          name="rera-number"
          autoFocus
          maxLength={60}
          value={number}
          onChange={(event) => setNumber(event.target.value.toUpperCase())}
          placeholder="K-RERA/AG/…"
          className={`${inputClass} tabular-nums`}
        />
      </Field>

      {/* What the number buys them, stated before the buttons rather than as
          an afterthought: a seller weighing "later" against "now" is weighing
          this. All three claims are things the site actually does. */}
      <div className="rounded-lg bg-ground p-3.5 text-[13px] leading-relaxed text-muted">
        <p className="font-medium text-ink">
          What a verified registration does for you
        </p>
        <ul className="mt-1.5 space-y-1">
          <li>
            Your listings carry a{" "}
            <span className="font-medium text-accent">RERA verified</span>{" "}
            badge, on every card and on the listing page.
          </li>
          <li>
            Without one, a sale listing of yours says{" "}
            <span className="font-medium">No RERA number</span> instead, which
            buyers reading several listings do notice.
          </li>
          <li>
            We show the number as you gave it until someone checks it against
            the state register. The badge appears only after that.
          </li>
        </ul>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={!canSave} className={primaryButton}>
          {saving
            ? "Saving…"
            : variant === "page"
              ? "Save and continue"
              : "Save"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className={secondaryButton}
        >
          {variant === "page" ? "Back" : "Cancel"}
        </button>
      </div>

      {onSkip && (
        // Third in the row's reading order and quiet, because it is the
        // answer with a cost: nothing blocks them, and the listing carries no
        // badge until a checked number arrives. The cost is the badge, not a
        // mark against them — lib/rera publishes VERIFIED and nothing else, so
        // skipping this is silent to buyers rather than held against the
        // listing.
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="text-[13.5px] font-medium text-muted underline decoration-line decoration-1 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          I will do this later — carry on without it
        </button>
      )}
    </form>
  );

  // Inside a settings card: no page heading, the card already has one.
  if (variant === "inline") return form;

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 lg:py-14">
      <h1 className="font-display text-[26px] leading-tight lg:text-[30px]">
        Your RERA registration
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {priorStatus === "REJECTED"
          ? "We checked the number you gave and could not confirm it on your state's register. Check it against your certificate and send it again — the reason we gave is in your settings."
          : priorStatus === "REVOKED"
            ? "The registration we had verified for you is no longer in good standing, so the badge is off your listings. Add a current one to get it back."
            : "Agents must be registered with their state RERA to handle a sale. Giving us the number is optional \u2014 what it buys is a RERA verified badge on your listings, once we have checked it against your state's register."}
      </p>

      {form}

      <p className="mt-6 text-[13px] text-muted">
        Renting or letting a PG instead? Go back and choose Rent, which needs no
        registration.
      </p>
    </main>
  );
};

export default AgentReraForm;
