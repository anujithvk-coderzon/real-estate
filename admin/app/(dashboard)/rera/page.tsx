"use client";

import { useEffect, useState } from "react";
import ReraDecision, {
  type Action,
  actionCopy,
  type Subject,
} from "@/components/ReraDecision";
import { api } from "@/lib/api";
import { apiMessage, onDate, outlineButton, solidButton } from "@/lib/ui";

// One row of GET /admin/rera/all. The first six fields are the agent and the
// three things printed on the certificate they are claiming; the last two are
// the decision somebody already made, which the Verified, Not verified and
// Revoked tabs exist to show.
type Request = {
  id: string;
  name: string;
  email: string;
  accountType: string | null;
  agentReraName: string | null;
  agentReraState: string | null;
  agentReraNumber: string | null;
  agentReraVerifiedReason?: string | null;
  agentReraVerifiedAt?: string | null;
};

// The real VerificationStatus values. NONE is left out — it means "never
// applied", so filtering by it lists every account that has not asked for
// anything, which is not a queue.
//
// REJECTED and REVOKED are deliberately two tabs, because they are two
// different facts: we looked at what was submitted and could not confirm it,
// versus a registration we had confirmed that is no longer good. An agent is
// told to do different things about each, so an operator has to choose between
// them rather than have one word cover both.
const TABS = [
  { key: "PENDING", label: "Waiting" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Not verified" },
  { key: "REVOKED", label: "Revoked" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ACCOUNT: Record<string, string> = {
  OWNER: "Owner",
  BROKER: "Broker or dealer",
  BUILDER: "Builder",
};

type Result =
  { key: string; requests: Request[] } | { key: string; error: true };

// The one check an operator cannot make from the row itself is whether the
// name on the certificate is the person who owns the account. Saying so beats
// hoping they compare two lines in different columns.
const nameMismatch = (request: Request) =>
  Boolean(
    request.agentReraName &&
    request.agentReraName.trim().toLowerCase() !==
      request.name.trim().toLowerCase(),
  );

const subjectOf = (request: Request): Subject => ({
  id: request.id,
  title: request.name,
  subtitle: request.email,
  state: request.agentReraState,
  facts: [
    {
      label: "Number",
      value: request.agentReraNumber ?? "None on the account",
    },
    { label: "State", value: request.agentReraState ?? "Not given" },
    {
      label: "Name on certificate",
      value: request.agentReraName ?? "Not given",
      warn: nameMismatch(request),
    },
  ],
});

const Page = () => {
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  // Which row is being decided, and which is in flight. Ids, because both
  // questions are about one row out of many.
  const [asking, setAsking] = useState<{
    request: Request;
    action: Action;
  } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // What is on screen is whatever came back for THIS tab and attempt, so
  // loading and failure are derived rather than stored and the effect never
  // calls setState in its body.
  const key = `${tab}:${attempt}`;

  useEffect(() => {
    let live = true;
    api.get("/admin/rera/all", { params: { type: tab } }).then(
      ({ data }) => {
        if (live)
          setResult({
            key: `${tab}:${attempt}`,
            requests: data.requests ?? [],
          });
      },
      () => {
        if (live) setResult({ key: `${tab}:${attempt}`, error: true });
      },
    );
    return () => {
      // The operator switched tabs before this answered; its result is stale.
      live = false;
    };
  }, [tab, attempt]);

  const decide = async (request: Request, action: Action, note: string) => {
    const copy = actionCopy("agent", action);
    // Which list the row came from. Without it, an operator who approves and
    // switches tabs before the answer lands has the row cut out of whichever
    // list is on screen instead.
    const from = key;
    setWorking(request.id);
    try {
      const { data } = await api.patch(`/admin/rera/${action}/${request.id}`, {
        reason: note,
      });
      setAsking(null);
      setNotice({ ok: true, text: data.message ?? copy.done });
      // Its status is now the opposite of this tab's filter, so it belongs in
      // another one. Dropping it here beats refetching: the operator watches
      // the queue get shorter.
      setResult((state) =>
        state && "requests" in state && state.key === from
          ? {
              ...state,
              requests: state.requests.filter((row) => row.id !== request.id),
            }
          : state,
      );
    } catch (error) {
      // The box stays open, with the note still in it: the decision was not
      // made, and retyping it is the last thing anybody wants to do.
      setNotice({ ok: false, text: apiMessage(error, copy.failed) });
    } finally {
      setWorking(null);
    }
  };

  // Every decision goes through the box, approvals included. A one-tap approve
  // was faster, but it published a verified badge with nothing beside it
  // explaining what had been checked.
  const controls = (request: Request) => {
    if (working === request.id)
      return <span className="text-[13px] text-muted">Saving…</span>;

    const open = (action: Action) => () => {
      setNotice(null);
      setAsking({ request, action });
    };

    return (
      <span className="flex flex-wrap items-center gap-1">
        {tab !== "VERIFIED" && (
          <button
            type="button"
            onClick={open("approve")}
            disabled={working !== null}
            className={solidButton}
          >
            {tab === "PENDING" ? "Approve" : "Approve now"}
          </button>
        )}
        {tab === "PENDING" && (
          <button
            type="button"
            onClick={open("reject")}
            disabled={working !== null}
            className={outlineButton}
          >
            Not verified
          </button>
        )}
        {tab === "VERIFIED" && (
          <button
            type="button"
            onClick={open("revoke")}
            disabled={working !== null}
            className={outlineButton}
          >
            Revoke
          </button>
        )}
      </span>
    );
  };

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && "error" in current;
  const requests = current && "requests" in current ? current.requests : null;

  const certificate = (request: Request) => (
    <>
      <p className="text-[13.5px] tabular-nums">
        {request.agentReraNumber ?? "No number on the account"}
      </p>
      <p className="truncate text-[12.5px] text-muted">
        {[request.agentReraState, request.agentReraName]
          .filter(Boolean)
          .join(" · ") || "No state or name given"}
      </p>
      {nameMismatch(request) && (
        <p className="mt-1 text-[12.5px] font-medium text-danger">
          Certificate name differs from the account name
        </p>
      )}
      {/* On a decided row, the note that went out with it. An operator
          reconsidering a rejection needs to know what the agent was told. */}
      {request.agentReraVerifiedReason && (
        <p className="mt-1.5 border-l-2 border-line pl-2 text-[12.5px] leading-snug text-muted">
          {request.agentReraVerifiedAt && (
            <span className="font-medium">
              {onDate(request.agentReraVerifiedAt)} ·{" "}
            </span>
          )}
          {request.agentReraVerifiedReason}
        </p>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
        Agent RERA verification
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
        Agents must be registered with their state RERA to list a property for
        sale. Check each number on that state&apos;s register before approving
        it — the listing pages show it as the agent&apos;s own claim until you
        do. Projects have their own queue.
      </p>

      {/* The rule, stated once, where it cannot be missed. */}
      <div className="mt-4 max-w-2xl rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
        <p className="text-[13.5px] font-medium">
          Every decision needs a written note, and on an approval that note is
          published.
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Buyers read it on the agent&apos;s public profile. It is the only
          place we say what &ldquo;verified&rdquo; means here — that a person
          matched a registration number against a state register, and nothing
          more. A tick with no words behind it reads as our word that the agent
          is safe to pay, which is not something we are in a position to say.
          Each decision below opens a box that shows you exactly how your words
          will appear before you commit them. A rejection or a revocation is
          written for the agent alone: buyers only ever see verified or not
          verified, never which of the two it was.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Under every note we publish, the site adds the same fixed paragraph:{" "}
          <span className="font-medium text-ink">
            visit the property, have the title and approval documents read by
            the buyer&apos;s own lawyer, keep payments traceable, and never pay
            an advance on the strength of a badge.
          </span>{" "}
          You do not type it and you cannot edit it — so write only what you
          actually checked, and never repeat or soften that warning in your own
          words.
        </p>
      </div>

      <div
        role="group"
        aria-label="Which requests to show"
        className="mt-6 flex flex-wrap gap-1"
      >
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={tab === option.key}
            onClick={() => {
              setTab(option.key);
              setAsking(null);
              setNotice(null);
            }}
            className={`flex min-h-11 items-center rounded-full px-4 text-[14px] font-medium transition-colors ${
              tab === option.key
                ? "bg-accent text-white"
                : "text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-5 rounded-lg border px-4 py-3 text-[13.5px] ${
            notice.ok
              ? "border-accent/30 bg-accent-soft text-accent"
              : "border-danger/30 text-danger"
          }`}
        >
          {notice.text}
        </p>
      )}

      {requests !== null && (
        <p
          className="mt-5 text-[13px] tabular-nums text-muted"
          aria-live="polite"
        >
          {requests.length === 0
            ? "Nothing here"
            : `${requests.length} ${requests.length === 1 ? "agent" : "agents"}`}
        </p>
      )}

      {loading && (
        <div className="mt-5 space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading requests</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[86px] animate-pulse rounded-xl border border-line bg-panel"
            />
          ))}
        </div>
      )}

      {failed && (
        <div className="mt-5 rounded-xl border border-line bg-panel p-6">
          <h2 className="font-display text-[17px]">Could not load requests</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            The request to the API did not come back. It may be down, or this
            session may no longer be an operator.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className={`mt-4 ${outlineButton}`}
          >
            Try again
          </button>
        </div>
      )}

      {requests?.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-panel p-8 text-center">
          <h2 className="font-display text-[17px]">
            {tab === "PENDING"
              ? "Nothing waiting"
              : tab === "VERIFIED"
                ? "No verified agents"
                : tab === "REJECTED"
                  ? "Nothing rejected"
                  : "Nothing revoked"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {tab === "PENDING"
              ? "Every registration an agent has submitted has been dealt with."
              : tab === "VERIFIED"
                ? "Approved registrations appear here."
                : tab === "REJECTED"
                  ? "Registrations you could not confirm appear here, with the reason the agent was given. They can be approved later if the agent sorts it out."
                  : "Verifications you have taken back appear here, and can be approved again."}
          </p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <>
          {/* ---------- phones ---------- */}
          <ul className="mt-4 space-y-3 md:hidden">
            {requests.map((request) => (
              <li
                key={request.id}
                className="space-y-1.5 rounded-xl border border-line bg-panel p-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  {ACCOUNT[request.accountType ?? ""] ?? "Account"}
                </p>
                <p className="text-[14px] font-semibold">{request.name}</p>
                <p className="truncate text-[12.5px] text-muted">
                  {request.email}
                </p>
                <div className="pt-1">{certificate(request)}</div>
                <div className="pt-2">{controls(request)}</div>
              </li>
            ))}
          </ul>

          {/* ---------- from md: a table, because this is a queue ---------- */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-panel md:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                {TABS.find((option) => option.key === tab)?.label} registrations
              </caption>
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="w-[26%] px-4 py-2.5">
                    Agent
                  </th>
                  <th scope="col" className="w-[16%] px-4 py-2.5">
                    Account
                  </th>
                  <th scope="col" className="w-[33%] px-4 py-2.5">
                    Registration
                  </th>
                  <th scope="col" className="w-[25%] px-4 py-2.5">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-line align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p
                        className="truncate text-[14px] font-medium"
                        title={request.id}
                      >
                        {request.name}
                      </p>
                      <p
                        className="truncate text-[12.5px] text-muted"
                        title={request.email}
                      >
                        {request.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">
                      {ACCOUNT[request.accountType ?? ""] ?? "—"}
                    </td>
                    <td className="px-4 py-3">{certificate(request)}</td>
                    <td className="px-4 py-3">{controls(request)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {asking && (
        <ReraDecision
          // A fresh box per row and per action: a note typed for one agent must
          // never be left sitting in the box for the next one.
          key={`${asking.request.id}:${asking.action}`}
          kind="agent"
          subject={subjectOf(asking.request)}
          action={asking.action}
          saving={working === asking.request.id}
          failure={notice && !notice.ok ? notice.text : null}
          onCancel={() => setAsking(null)}
          onConfirm={(note) => decide(asking.request, asking.action, note)}
        />
      )}
    </div>
  );
};

export default Page;
