"use client";

import { useEffect, useRef, useState } from "react";
import {
  dangerButton,
  focusable,
  onDate,
  outlineButton,
  quietButton,
  solidButton,
} from "@/lib/ui";

// The decision box, shared by the two RERA queues: an agent's own registration
// and a project's. The two queues check different registers and talk to
// different people, so every sentence here is chosen per kind — but the shape
// of the decision is identical, and so is the one rule it exists to enforce:
// nothing is approved without a written note, because the note is what gets
// published under the verified badge.

export type Kind = "agent" | "project";

export type Action = "approve" | "reject" | "revoke";

// Long enough that "ok" and "verified" cannot be submitted, short enough to
// stay readable on a phone-width page. Keep these two in step with
// reraDecisionValidation in the backend — the API, not this box, is what
// protects the column.
export const MIN_REASON = 25;
export const MAX_REASON = 300;

// Words that turn a record of what we checked into a promise about the deal.
// Not blocked: an operator may have a good reason to write one. Flagged,
// because the person typing is mid-sentence and not thinking about how the
// sentence will read six months later.
const PROMISE_WORDS =
  /\b(guarantee[ds]?|guaranteeing|assur(e|ed|ance)|trust(ed|worthy)?|reliable|safe|genuine|100\s*%|no\s+risk)\b/i;

// Copies of RERA_SCOPE, PROJECT_RERA_SCOPE, RERA_CAUTION_HEADING and
// RERA_CAUTION in frontend/lib/rera.ts. Two apps, no shared package, so these
// are duplicates on purpose — they exist so an operator sees the real published
// words rather than a paraphrase. Change them here in the same commit.
const PUBLISHED_SCOPE: Record<Kind, string> = {
  agent:
    "This covers the agent's registration number only — not this property, its title, its approvals or its measurements.",
  project:
    "This covers the project's registration with the state authority — not any one flat in it, its price, its plan or when it will be handed over.",
};

const PUBLISHED_CAUTION_HEADING = "Before you pay anything";

const PUBLISHED_CAUTION =
  "Visit in person, have the title and approval documents read by your own lawyer, and keep every payment traceable through a bank. Never pay an advance, a token or a booking amount on the strength of a badge on this page.";

// One row of either queue, flattened to what the box needs. The pages own their
// own API shapes; this is the part the decision is about.
export type Subject = {
  id: string;
  // "Anujith vk" or "Green Meadows"
  title: string;
  // the email, or where the project is
  subtitle: string;
  // The state whose register was checked. Goes into the templates, so a
  // template never says "the state RERA register" when it could name it.
  state: string | null;
  // The certificate, as three or four labelled facts.
  facts: { label: string; value: string; warn?: boolean }[];
};

type ActionCopy = {
  title: string;
  confirm: string;
  danger: boolean;
  audience: string;
  why: string;
  include: string[];
  avoid: string[];
  previewLabel: string;
  previewBadge: string;
  previewHeading: string;
  // Spelled out at the last press, because this is the point of no return: all
  // three write a status, notify somebody and change what buyers see, and none
  // has an undo beyond deciding again.
  consequence: (title: string) => string;
  templates: (subject: Subject) => string[];
  done: string;
  failed: string;
};

const NEVER_AGENT = [
  "Promises about the person or the deal: trusted, reliable, safe, guaranteed.",
  "The visit-and-verify warning — it is published automatically, below your note.",
  "Internal notes, ticket numbers, or anybody's phone number, email or address.",
];

const NEVER_FIX = [
  "Anything about the person rather than the registration.",
  "Internal shorthand they cannot act on.",
];

const stateOf = (subject: Subject) => subject.state ?? "state";

const COPY: Record<Kind, Record<Action, ActionCopy>> = {
  agent: {
    approve: {
      title: "Approve this registration",
      confirm: "Approve and publish the note",
      danger: false,
      audience: "Every buyer who opens this agent's profile",
      why: "A tick on its own tells a buyer nothing about what was checked, and invites them to skip their own diligence. Your note is the only place that says what we matched and what we did not. It is published under this agent's name, so write it to a buyer — not to us.",
      include: [
        "That you matched the number against that state's RERA register, and it held.",
        "What you saw there — the name it is registered to, and that it was current on the day.",
        "Anything a buyer should know about this particular registration.",
      ],
      avoid: NEVER_AGENT,
      previewLabel: "What buyers will see on the profile",
      previewBadge: "RERA verified",
      previewHeading: "What we checked",
      consequence: (title) =>
        `${title} will be marked RERA verified, your note goes live on their public profile, and every sale listing of theirs starts showing the verified badge.`,
      templates: (subject) => [
        `We matched this registration number against the ${stateOf(subject)} RERA register on the date shown. It was listed as current and registered in this agent's own name.`,
        `Checked on the ${stateOf(subject)} RERA register: the number is current and the name on the registration matches this account. We have not inspected any of this agent's properties.`,
      ],
      done: "Approved, and the note is on their profile",
      failed: "Could not approve it",
    },
    reject: {
      title: "Mark as not verified",
      confirm: "Reject and send the reason",
      danger: true,
      audience: "Only this agent, in their settings",
      why: 'This is the only thing they will be told, and it decides whether they can fix it. A reason like "not found" sends them back to submit the same number again. Say what you looked for, and what they should do. Buyers are never shown that a number was rejected — their sale listings simply read "RERA not verified".',
      include: [
        "Where you looked and what you found there — or did not find.",
        "The exact next step: correct the number, send the certificate, renew it.",
      ],
      avoid: NEVER_FIX,
      previewLabel: "What the agent will see in their settings",
      previewBadge: "",
      previewHeading: "Reason",
      consequence: (title) =>
        `${title} will be told their registration could not be verified, and your reason is sent to them. Their sale listings keep reading "RERA not verified".`,
      templates: (subject) => [
        `The number you gave is not on the ${stateOf(subject)} RERA register. Please check your registration certificate and enter the number exactly as it is printed there.`,
        `This number appears on the ${stateOf(subject)} register against a different name. Enter the number from your own certificate, or send us the certificate that carries your name.`,
        `The registration against this number has expired on the ${stateOf(subject)} register. Renew it with the authority and submit the new number here.`,
      ],
      done: "Marked as not verified, and the reason was sent",
      failed: "Could not reject it",
    },
    revoke: {
      title: "Revoke this verification",
      confirm: "Revoke and send the reason",
      danger: true,
      audience: "Only this agent, in their settings",
      why: 'Their live listings carry a verified badge until this lands, and it disappears without warning. The note is what tells them why, and how to get it back. Buyers are not told a verification was withdrawn — the badge simply goes back to "RERA not verified".',
      include: [
        "What changed on the register since it was approved.",
        "What they have to submit to be verified again.",
      ],
      avoid: NEVER_FIX,
      previewLabel: "What the agent will see in their settings",
      previewBadge: "",
      previewHeading: "Reason",
      consequence: (title) =>
        `The verified badge comes off every live listing of ${title}'s at once, and your reason is sent to them. Buyers see "RERA not verified" from that moment.`,
      templates: (subject) => [
        `This registration is no longer valid on the ${stateOf(subject)} RERA register, so the verified badge has been taken off your listings. Submit a current registration to have it back.`,
        `We rechecked this number on the ${stateOf(subject)} register and could not confirm it any more. The badge stays off until a valid registration is given.`,
      ],
      done: "Verification revoked, and the reason was sent",
      failed: "Could not revoke it",
    },
  },

  project: {
    approve: {
      title: "Approve this project registration",
      confirm: "Approve and publish the note",
      danger: false,
      audience: "Every buyer who opens this project or a flat listed in it",
      why: "A project may not legally be advertised without being registered, so this badge is the one claim on the page a buyer is entitled to rely on. Your note says which register you found it on and what the registration does not cover. It is published on the project, so write it to a buyer.",
      include: [
        "The register you found it on, and that the number is live there.",
        "That the name and the promoter on the register match this project.",
        "Anything on the register a buyer should know: phase, tower, or an end date.",
      ],
      avoid: [
        "Promises about the building, the price or the handover date.",
        "The visit-and-verify warning — it is published automatically, below your note.",
        "Internal notes, ticket numbers, or anybody's contact details.",
      ],
      previewLabel: "What buyers will see on the project",
      previewBadge: "Project RERA verified",
      previewHeading: "What we checked",
      consequence: (title) =>
        `${title} will be marked RERA verified, your note goes live on the project, and every listing inside it starts showing the verified badge.`,
      templates: (subject) => [
        `We found this registration number live on the ${stateOf(subject)} RERA register, against this project's name and promoter, on the date shown. We have not inspected the site or any individual flat.`,
        `Checked on the ${stateOf(subject)} RERA register: the project is registered under this number and the promoter's name matches this account. Registration says nothing about build quality or the handover date.`,
      ],
      done: "Approved, and the note is on the project",
      failed: "Could not approve it",
    },
    reject: {
      title: "Mark this project as not verified",
      confirm: "Reject and send the reason",
      danger: true,
      audience: "Only this builder, in a notification",
      why: 'The builder is the only one told. Buyers see "RERA not verified" on the project and on every flat listed in it, which is a serious thing for a project that must be registered to be advertised at all — so the reason has to be precise enough to act on.',
      include: [
        "What you searched for, on which register, and what came back.",
        "The exact next step: correct the number, send the certificate, or take the project down.",
      ],
      avoid: NEVER_FIX,
      previewLabel: "What the builder will be told",
      previewBadge: "",
      previewHeading: "Reason",
      consequence: (title) =>
        `${title} will be marked not verified, the builder is notified with your reason, and every listing in the project reads "RERA not verified" until it is fixed.`,
      templates: (subject) => [
        `This number is not on the ${stateOf(subject)} RERA register. Enter the registration number exactly as it appears on the certificate the authority issued.`,
        `The number is on the ${stateOf(subject)} register but against a different project. Give the registration that belongs to this project, or correct the project's details.`,
        `This project's registration has lapsed on the ${stateOf(subject)} register. Send us the extension or the renewed registration.`,
      ],
      done: "Marked as not verified, and the builder was told",
      failed: "Could not reject it",
    },
    revoke: {
      title: "Revoke this project verification",
      confirm: "Revoke and send the reason",
      danger: true,
      audience: "Only this builder, in a notification",
      why: 'Every flat listed in this project is carrying a verified badge right now, and all of them lose it at once. Buyers are not told it was revoked — the project simply reads "RERA not verified" from that moment.',
      include: [
        "What changed on the register since it was approved.",
        "What the builder must submit to have it back.",
      ],
      avoid: NEVER_FIX,
      previewLabel: "What the builder will be told",
      previewBadge: "",
      previewHeading: "Reason",
      consequence: (title) =>
        `The verified badge comes off ${title} and every listing in it at once, and the builder is notified with your reason.`,
      templates: (subject) => [
        `This registration no longer appears as live on the ${stateOf(subject)} RERA register, so the verified badge has been taken off the project. Send the current registration to have it back.`,
        `We rechecked this project on the ${stateOf(subject)} register and the registration has lapsed. The badge stays off until it is renewed.`,
      ],
      done: "Verification revoked, and the builder was told",
      failed: "Could not revoke it",
    },
  },
};

export const actionCopy = (kind: Kind, action: Action) => COPY[kind][action];

const ReraDecision = ({
  kind,
  subject,
  action,
  saving,
  failure,
  onCancel,
  onConfirm,
}: {
  kind: Kind;
  subject: Subject;
  action: Action;
  saving: boolean;
  // Why the last attempt did not go through. It has to be rendered in here:
  // below sm this box covers the screen, so the page's own notice would be
  // behind it and the operator would just see the button do nothing.
  failure: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) => {
  const copy = COPY[kind][action];
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  // The last press asks rather than acts. One state, not a second dialog: a
  // dialog on top of a dialog, on a phone, is two screens of chrome over one
  // sentence.
  const [confirming, setConfirming] = useState(false);

  // Straight into the box: the note is the whole purpose of this dialog.
  useEffect(() => {
    area.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  // The queue behind this must not scroll: on a phone the box fills the screen,
  // and a page scrolling under it is how somebody loses the row they were
  // deciding about.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const note = text.trim();
  const short = note.length < MIN_REASON;
  const long = note.length > MAX_REASON;
  const promise = PROMISE_WORDS.exec(note)?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-6">
      {/* The scrim does not close this one. There is typing in it that a
          mis-aimed click should not throw away. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        // A sheet that owns the whole phone screen, a centred card from sm. The
        // height is dvh rather than vh because an on-screen keyboard shrinks
        // the viewport, and vh would push the buttons under it.
        className="flex h-dvh w-full flex-col border-line bg-panel sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] lg:max-w-5xl"
      >
        {/* ---------- head: stays put while the body scrolls ---------- */}
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="decision-title" className="font-display text-[20px]">
              {copy.title}
            </h2>
            <p className="mt-1 truncate text-[13.5px] text-muted">
              {subject.title} · {subject.subtitle}
            </p>
          </div>
          {/* On a full-screen sheet there is no scrim left to aim at, and
              Escape is not a key a phone has. */}
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancel"
            className={`-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] leading-none text-muted transition-colors hover:text-ink sm:hidden ${focusable}`}
          >
            ×
          </button>
        </div>

        {/* ---------- body ---------- */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="lg:grid lg:grid-cols-2 lg:gap-6">
            {/* Left on a wide screen: what the decision is about and how to
                write it. Right: writing it. Stacked below lg, in that same
                order, which is the order the work happens in. */}
            <div className="min-w-0">
              {/* The certificate stays in view: the decision is about these
                  facts, and nobody should have to remember them from the row. */}
              <dl className="grid gap-x-6 gap-y-1.5 rounded-xl border border-line bg-ground px-4 py-3 text-[13px] sm:grid-cols-3">
                {subject.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-muted">{fact.label}</dt>
                    <dd className={fact.warn ? "text-danger" : ""}>
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* ---------- who reads it, and why it is required ---------- */}
              <div
                className={`mt-4 rounded-xl border px-4 py-3 ${
                  action === "approve"
                    ? "border-accent/30 bg-accent-soft"
                    : "border-line bg-ground"
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  Who reads this note
                </p>
                <p className="mt-1 text-[14px] font-medium">{copy.audience}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {copy.why}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                    Say
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-muted">
                    {copy.include.map((line) => (
                      <li key={line}>· {line}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-line px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-danger">
                    Never
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-muted">
                    {copy.avoid.map((line) => (
                      <li key={line}>· {line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              {/* ---------- templates ---------- */}
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted lg:mt-0">
                Start from one of these
              </p>
              <ul className="mt-2 space-y-2">
                {copy.templates(subject).map((template) => (
                  <li key={template}>
                    {/* Replaces the box rather than appending: these are
                        starting points, picked before typing and edited after. */}
                    <button
                      type="button"
                      onClick={() => {
                        setText(template);
                        setConfirming(false);
                      }}
                      className={`w-full rounded-xl border border-line px-4 py-3 text-left text-[13px] leading-relaxed text-muted transition-colors hover:border-accent hover:text-ink ${focusable}`}
                    >
                      {template}
                    </button>
                  </li>
                ))}
              </ul>

              {/* ---------- the note ---------- */}
              <label
                htmlFor="decision-note"
                className="mt-5 block text-[13px] font-medium"
              >
                Your note <span className="text-danger">*</span>
              </label>
              <textarea
                id="decision-note"
                ref={area}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  // An edit is a change of mind about the words, so the
                  // question has to be asked again about the new ones.
                  setConfirming(false);
                }}
                rows={4}
                maxLength={MAX_REASON + 80}
                aria-describedby="decision-count"
                className={`mt-1.5 w-full rounded-xl border border-line bg-ground px-3.5 py-2.5 text-[16px] leading-relaxed outline-none focus:border-accent sm:text-[14px] ${focusable}`}
                placeholder={
                  action === "approve"
                    ? "What you checked, where you checked it, and what it does not cover."
                    : "What you found on the register, and what they should do about it."
                }
              />
              <p
                id="decision-count"
                aria-live="polite"
                className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted"
              >
                <span className="tabular-nums">
                  {note.length}/{MAX_REASON}
                </span>
                {short && (
                  <span>
                    {MIN_REASON - note.length} more characters — one full
                    sentence at least.
                  </span>
                )}
                {long && (
                  <span className="text-danger">
                    {note.length - MAX_REASON} over. Trim it.
                  </span>
                )}
                {promise && (
                  <span className="text-warn">
                    “{promise}” reads as a promise about the deal. Say what you
                    checked instead.
                  </span>
                )}
              </p>

              {/* ---------- preview, in the shape it will be read in ---------- */}
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {copy.previewLabel}
              </p>
              <div className="mt-2 rounded-xl border border-line bg-ground px-4 py-3">
                {copy.previewBadge && (
                  <p className="inline-block rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-medium text-accent">
                    {copy.previewBadge}
                  </p>
                )}
                <p
                  className={`text-[11px] font-bold uppercase tracking-[0.12em] text-muted ${
                    copy.previewBadge ? "mt-2.5" : ""
                  }`}
                >
                  {copy.previewHeading}
                  {action === "approve" && (
                    <span className="ml-1.5 font-medium normal-case tracking-normal">
                      · {onDate(new Date().toISOString())}
                    </span>
                  )}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-muted">
                  {note || (
                    <span className="italic">
                      Nothing typed yet — this is where your words appear.
                    </span>
                  )}
                </p>

                {/* Only on an approval, because only an approval is published.
                    This is the half that protects both sides, and it is fixed
                    text: an operator cannot soften it, forget it, or be blamed
                    for it. */}
                {action === "approve" && (
                  <div className="mt-3 rounded-lg border border-line bg-panel px-3.5 py-3">
                    <p className="text-[12.5px] leading-relaxed text-muted">
                      {PUBLISHED_SCOPE[kind]}
                    </p>
                    <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.1em]">
                      {PUBLISHED_CAUTION_HEADING}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                      {PUBLISHED_CAUTION}
                    </p>
                    <p className="mt-2 text-[11.5px] font-medium text-accent">
                      Published automatically, on every page — you do not type
                      this, and it cannot be edited from here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- actions: pinned, so the decision is always one tap away
            however long the guidance above it runs ---------- */}
        <div className="shrink-0 border-t border-line px-5 py-3.5">
          {failure && (
            <p
              role="alert"
              className="mb-2.5 rounded-lg border border-danger/30 px-3.5 py-2.5 text-[13px] text-danger"
            >
              {failure} — your note is still here, nothing was saved.
            </p>
          )}

          {confirming && !saving && (
            <p className="mb-2.5 rounded-lg border border-warn/40 bg-warn/5 px-3.5 py-2.5 text-[13px] leading-relaxed">
              {copy.consequence(subject.title)}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={short || long || saving}
                  onClick={() => onConfirm(note)}
                  className={`w-full justify-center sm:w-auto ${copy.danger ? dangerButton : solidButton}`}
                >
                  {saving ? "Saving…" : "Yes, I am sure"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirming(false)}
                  className={`w-full justify-center sm:w-auto ${outlineButton}`}
                >
                  Go back
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={short || long}
                  onClick={() => setConfirming(true)}
                  className={`w-full justify-center sm:w-auto ${copy.danger ? dangerButton : solidButton}`}
                >
                  {copy.confirm}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className={`hidden w-full justify-center sm:inline-flex sm:w-auto ${quietButton}`}
                >
                  Cancel
                </button>
              </>
            )}

            {/* The counter again, where the eye already is when reaching for
                the button that it disables. */}
            <span
              className={`text-[12.5px] tabular-nums sm:ml-auto ${long ? "text-danger" : "text-muted"}`}
            >
              {note.length}/{MAX_REASON}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReraDecision;
