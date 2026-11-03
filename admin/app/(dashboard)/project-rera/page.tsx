"use client";

import { useEffect, useState } from "react";
import ReraDecision, {
  type Action,
  actionCopy,
  type Subject,
} from "@/components/ReraDecision";
import { api } from "@/lib/api";
import { apiMessage, onDate, outlineButton, solidButton } from "@/lib/ui";

// One row of GET /admin/project-rera/all.
type Project = {
  id: string;
  name: string;
  slug: string | null;
  locality: string;
  city: string;
  state: string;
  status: string | null;
  totalUnits: number | null;
  reraNumber: string | null;
  reraState: string | null;
  reraStatus: string;
  isReraExempt: boolean;
  exemptReason: string | null;
  reraVerifiedReason?: string | null;
  reraVerifiedAt?: string | null;
  builder: { name: string; email: string };
};

// Four statuses and one column. EXEMPT is not a status — it is a project
// listing on a stated exemption instead of a number, which has nothing to
// verify and so cannot sit in a queue of decisions. It is here because
// somebody should still read those claims.
const TABS = [
  { key: "PENDING", label: "Waiting" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Not verified" },
  { key: "REVOKED", label: "Revoked" },
  { key: "EXEMPT", label: "Exemption claimed" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type Result =
  { key: string; requests: Project[] } | { key: string; error: true };

const where = (project: Project) =>
  [project.locality, project.city, project.state].filter(Boolean).join(", ");

const units = (project: Project) =>
  project.totalUnits ? `${project.totalUnits} units` : "Units not stated";

const subjectOf = (project: Project): Subject => ({
  id: project.id,
  title: project.name,
  subtitle: `${where(project)} · ${project.builder.name}`,
  state: project.reraState ?? project.state,
  facts: [
    { label: "Number", value: project.reraNumber ?? "None on the project" },
    {
      label: "State",
      value: project.reraState ?? `${project.state} (project's own state)`,
    },
    { label: "Size", value: units(project) },
    { label: "Promoter", value: project.builder.name },
  ],
});

const Page = () => {
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [asking, setAsking] = useState<{
    project: Project;
    action: Action;
  } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const key = `${tab}:${attempt}`;

  useEffect(() => {
    let live = true;
    api.get("/admin/project-rera/all", { params: { type: tab } }).then(
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
      live = false;
    };
  }, [tab, attempt]);

  const decide = async (project: Project, action: Action, note: string) => {
    const copy = actionCopy("project", action);
    const from = key;
    setWorking(project.id);
    try {
      const { data } = await api.patch(
        `/admin/project-rera/${action}/${project.id}`,
        { reason: note },
      );
      setAsking(null);
      setNotice({ ok: true, text: data.message ?? copy.done });
      setResult((state) =>
        state && "requests" in state && state.key === from
          ? {
              ...state,
              requests: state.requests.filter((row) => row.id !== project.id),
            }
          : state,
      );
    } catch (error) {
      setNotice({ ok: false, text: apiMessage(error, copy.failed) });
    } finally {
      setWorking(null);
    }
  };

  const controls = (project: Project) => {
    // Nothing to decide: there is no register to look an exemption up in. The
    // claim is reviewed by reading it, and acted on by asking the builder for
    // the plan approval or taking the project down.
    if (tab === "EXEMPT")
      return (
        <span className="text-[12.5px] text-muted">
          Nothing to verify — no registration claimed
        </span>
      );

    if (working === project.id)
      return <span className="text-[13px] text-muted">Saving…</span>;

    const open = (action: Action) => () => {
      setNotice(null);
      setAsking({ project, action });
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

  const registration = (project: Project) => (
    <>
      {project.isReraExempt ? (
        <>
          <p className="text-[13.5px] font-medium text-warn">
            Stated as exempt
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            {project.exemptReason ?? "No reason given"}
          </p>
        </>
      ) : (
        <>
          <p className="text-[13.5px] tabular-nums">
            {project.reraNumber ?? "No number on the project"}
          </p>
          <p className="truncate text-[12.5px] text-muted">
            {[project.reraState, units(project)].filter(Boolean).join(" · ")}
          </p>
        </>
      )}
      {/* On a decided row, the note that went out with it. */}
      {project.reraVerifiedReason && (
        <p className="mt-1.5 border-l-2 border-line pl-2 text-[12.5px] leading-snug text-muted">
          {project.reraVerifiedAt && (
            <span className="font-medium">
              {onDate(project.reraVerifiedAt)} ·{" "}
            </span>
          )}
          {project.reraVerifiedReason}
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
        Project RERA verification
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
        A promoter may not advertise or sell an unregistered project at all —
        this is stricter than an agent&apos;s own registration, which only a
        sale needs. Every project here has either declared a number for you to
        check against its state authority, or claimed an exemption. Until you
        check it, buyers are told the number is the builder&apos;s own claim.
      </p>

      <div className="mt-4 max-w-2xl rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
        <p className="text-[13.5px] font-medium">
          Check the number on the authority&apos;s own register, not on anything
          the builder sent.
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          A screenshot or a PDF proves nothing: it is the live entry that says
          whether the registration is current, who the promoter is, and when it
          lapses. Your note is published on the project and on every flat listed
          inside it, so say which register you used and what you saw there.
          Under it, the site adds the same fixed warning it adds everywhere —
          visit, have the documents read by a lawyer, keep payments traceable,
          never pay an advance on the strength of a badge.
        </p>
      </div>

      <div
        role="group"
        aria-label="Which projects to show"
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
            : `${requests.length} ${requests.length === 1 ? "project" : "projects"}`}
        </p>
      )}

      {loading && (
        <div className="mt-5 space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading projects</span>
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
          <h2 className="font-display text-[17px]">Could not load projects</h2>
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
                ? "No verified projects"
                : tab === "REJECTED"
                  ? "Nothing rejected"
                  : tab === "REVOKED"
                    ? "Nothing revoked"
                    : "No exemptions claimed"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {tab === "PENDING"
              ? "Every project that declared a registration number has been dealt with."
              : tab === "VERIFIED"
                ? "Projects whose registration you confirmed appear here."
                : tab === "REJECTED"
                  ? "Projects whose number you could not confirm appear here, with the reason the builder was given."
                  : tab === "REVOKED"
                    ? "Verifications you have taken back appear here, and can be approved again."
                    : "Projects small enough to list without registering appear here, with the reason their builder gave."}
          </p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <>
          {/* ---------- phones ---------- */}
          <ul className="mt-4 space-y-3 md:hidden">
            {requests.map((project) => (
              <li
                key={project.id}
                className="space-y-1.5 rounded-xl border border-line bg-panel p-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  {project.status ?? "Project"}
                </p>
                <p className="text-[14px] font-semibold">{project.name}</p>
                <p className="truncate text-[12.5px] text-muted">
                  {where(project)}
                </p>
                <p className="truncate text-[12.5px] text-muted">
                  {project.builder.name} · {project.builder.email}
                </p>
                <div className="pt-1">{registration(project)}</div>
                <div className="pt-2">{controls(project)}</div>
              </li>
            ))}
          </ul>

          {/* ---------- from md: a table, because this is a queue ---------- */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-line bg-panel md:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                {TABS.find((option) => option.key === tab)?.label} projects
              </caption>
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="w-[28%] px-4 py-2.5">
                    Project
                  </th>
                  <th scope="col" className="w-[20%] px-4 py-2.5">
                    Builder
                  </th>
                  <th scope="col" className="w-[30%] px-4 py-2.5">
                    Registration
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-2.5">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-line align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p
                        className="truncate text-[14px] font-medium"
                        title={project.id}
                      >
                        {project.name}
                      </p>
                      <p className="truncate text-[12.5px] text-muted">
                        {where(project)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate text-[13px]">
                        {project.builder.name}
                      </p>
                      <p
                        className="truncate text-[12.5px] text-muted"
                        title={project.builder.email}
                      >
                        {project.builder.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">{registration(project)}</td>
                    <td className="px-4 py-3">{controls(project)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {asking && (
        <ReraDecision
          key={`${asking.project.id}:${asking.action}`}
          kind="project"
          subject={subjectOf(asking.project)}
          action={asking.action}
          saving={working === asking.project.id}
          failure={notice && !notice.ok ? notice.text : null}
          onCancel={() => setAsking(null)}
          onConfirm={(note) => decide(asking.project, asking.action, note)}
        />
      )}
    </div>
  );
};

export default Page;
