"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// One row of GET /admin/rera/all. Exactly the select the service makes: an
// agent, and the three things printed on the certificate they are claiming.
type Request = {
  id: string;
  name: string;
  email: string;
  accountType: string | null;
  agentReraName: string | null;
  agentReraState: string | null;
  agentReraNumber: string | null;
};

// The real VerificationStatus values, which are NOT approved/rejected:
// approving writes VERIFIED, revoking writes REVOKED. NONE is left out — it
// means "never applied", so filtering by it lists every account that has not
// asked for anything, which is not a queue.
const TABS = [
  { key: "PENDING", label: "Waiting" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REVOKED", label: "Revoked" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ACCOUNT: Record<string, string> = {
  OWNER: "Owner",
  BROKER: "Broker or dealer",
  BUILDER: "Builder",
};

const focusable =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const button = `inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[14px] font-medium transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

const solidButton = `inline-flex min-h-11 items-center rounded-lg bg-accent px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

const dangerButton = `inline-flex min-h-11 items-center rounded-lg bg-danger px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusable}`;

const quietButton = `inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink ${focusable}`;

type Result =
  { key: string; requests: Request[] } | { key: string; error: true };

const reason = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  return typeof message === "string" ? message : fallback;
};

// The one check an operator cannot make from the row itself is whether the
// name on the certificate is the person who owns the account. Saying so beats
// hoping they compare two lines in different columns.
const nameMismatch = (request: Request) =>
  Boolean(
    request.agentReraName &&
    request.agentReraName.trim().toLowerCase() !==
      request.name.trim().toLowerCase(),
  );

const Page = () => {
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  // Which row is being asked about, and which is in flight. Ids, because both
  // questions are about one row out of many.
  const [asking, setAsking] = useState<string | null>(null);
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

  const decide = async (request: Request, approve: boolean) => {
    // Which list the row came from. Without it, an operator who approves and
    // switches tabs before the answer lands has the row cut out of whichever
    // list is on screen instead.
    const from = key;
    setAsking(null);
    setWorking(request.id);
    try {
      const { data } = await api.patch(
        `/admin/rera/${approve ? "approve" : "reject"}/${request.id}`,
      );
      setNotice({
        ok: true,
        text:
          data.message ??
          (approve ? "Registration verified" : "Verification revoked"),
      });
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
      setNotice({
        ok: false,
        text: reason(
          error,
          approve ? "Could not verify it" : "Could not revoke it",
        ),
      });
    } finally {
      setWorking(null);
    }
  };

  // Approving is a single tap: it is the queue's whole job, done many times in
  // a row, and it is undone from the Verified tab in one more. Revoking takes
  // something away from somebody who is already listing with it, and their
  // listings say "verified" until it lands, so that one asks first.
  const controls = (request: Request) => {
    if (working === request.id)
      return <span className="text-[13px] text-muted">Saving…</span>;

    if (asking === request.id)
      return (
        <span className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => decide(request, false)}
            className={dangerButton}
          >
            Yes, revoke
          </button>
          <button
            type="button"
            onClick={() => setAsking(null)}
            className={quietButton}
          >
            Cancel
          </button>
        </span>
      );

    return (
      <span className="flex flex-wrap items-center gap-1">
        {tab !== "VERIFIED" && (
          <button
            type="button"
            onClick={() => decide(request, true)}
            // One at a time: the queue is a sequence of decisions, and two
            // requests in flight makes it unclear which answer belongs to
            // which row.
            disabled={working !== null}
            className={solidButton}
          >
            Approve
          </button>
        )}
        {tab !== "REVOKED" && (
          <button
            type="button"
            onClick={() => setAsking(request.id)}
            disabled={working !== null}
            className={button}
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
    </>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-[32px]">
        RERA verification
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
        Agents must be registered with their state RERA to list a property for
        sale. Check each number on that state&apos;s register before approving
        it — the listing pages show it as the agent&apos;s own claim until you
        do.
      </p>

      <div
        role="group"
        aria-label="Which requests to show"
        className="mt-6 flex gap-1"
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
            className={`mt-4 ${button}`}
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
                : "Nothing revoked"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {tab === "PENDING"
              ? "Every registration an agent has submitted has been dealt with."
              : tab === "VERIFIED"
                ? "Approved registrations appear here."
                : "Registrations you have taken back appear here, and can be approved again."}
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
                  <th scope="col" className="w-[28%] px-4 py-2.5">
                    Agent
                  </th>
                  <th scope="col" className="w-[18%] px-4 py-2.5">
                    Account
                  </th>
                  <th scope="col" className="w-[30%] px-4 py-2.5">
                    Registration
                  </th>
                  <th scope="col" className="w-[24%] px-4 py-2.5">
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
    </div>
  );
};

export default Page;
