"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Select } from "@/components/form/Field";
import { api } from "@/lib/api";
import { inputClass, labelClass } from "@/lib/ui";

type Found = {
  id: string;
  name: string;
  status: string;
  locality: string;
  city: string;
  reraNumber?: string | null;
  isReraExempt?: boolean;
  builderName?: string | null;
};

// The answer to "which project is this unit in?". Four shapes:
//   ""        nothing answered yet
//   "<id>"    one of our registered projects
//   "manual"  not in our records: the lister types the name and RERA number
//   "none"    a resale, a plot, an old building
export const MANUAL = "manual";
export const NONE = "none";

type Props = {
  // A builder picks from the projects they registered; an agent searches all of them.
  mode: "own" | "search";
  value: string;
  onChange: (value: string) => void;
  // Only used when value is "manual".
  manualName: string;
  manualRera: string;
  manualBuilder: string;
  onManualChange: (
    field: "manualName" | "manualRera" | "manualBuilder",
    value: string,
  ) => void;
  // Under construction: the advertisement needs a registration number, so
  // "not part of a project" is not an available answer.
  mustHaveProject: boolean;
};

const ProjectPicker = ({
  mode,
  value,
  onChange,
  manualName,
  manualRera,
  manualBuilder,
  onManualChange,
  mustHaveProject,
}: Props) => {
  const [own, setOwn] = useState<
    { id: string; name: string; reraNumber?: string | null }[] | null
  >(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[] | null>(null);
  const [more, setMore] = useState(false); // the server had matches it did not send
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Found | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (mode !== "own") return;
    api
      .get("/project/mine")
      .then((response) => setOwn(response.data.projects ?? []))
      .catch(() => setOwn([]));
  }, [mode]);

  // Search as they type, but only after a pause, so every keystroke is not a request.
  useEffect(() => {
    const text = query.trim();
    const id = ++requestId.current; // a slow answer to an older query is ignored
    const timer = setTimeout(() => {
      // One letter is enough: the pause above and the result cap below are what
      // keep the search cheap, not a minimum length.
      if (mode !== "search" || text === "") {
        setResults(null);
        setSearching(false);
        return;
      }
      setSearching(true);
      api
        .get("/project/search", { params: { q: text } })
        .then((response) => {
          if (id !== requestId.current) return;
          setResults(response.data.projects ?? []);
          setMore(Boolean(response.data.more));
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        })
        .finally(() => {
          if (id === requestId.current) setSearching(false);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, mode]);

  // Said plainly, because a buyer reads it: the registry number, or why there is none.
  const reraNote = (project: Found) =>
    project.reraNumber
      ? ` · RERA ${project.reraNumber}`
      : project.isReraExempt
        ? " · RERA exempt (8 units or fewer)"
        : " · no RERA number";

  // ---------- a builder's own projects ----------
  if (mode === "own") {
    return (
      <div className="max-w-sm">
        <Field id="projectId" label="Project">
          <Select
            id="projectId"
            value={value}
            options={[
              ...(own ?? []).map((project) => ({
                value: project.id,
                label: project.reraNumber
                  ? `${project.name} — ${project.reraNumber}`
                  : project.name,
              })),
              {
                value: NONE,
                label: "Not part of a project (resale, plot, old building)",
              },
            ]}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>

        {value === NONE && mustHaveProject && (
          <p className="mt-3 text-[14px] leading-snug text-warn">
            An under-construction unit is sold off-plan, so the advertisement
            needs the project&apos;s RERA number. Choose the project, or add it
            first.
          </p>
        )}

        {own !== null && own.length === 0 && (
          <p className="mt-3 text-[14px] text-muted">
            You have no projects yet.{" "}
            <a
              href="/list/my/projects/new"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              Add one
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            and it will appear here.
          </p>
        )}
      </div>
    );
  }

  // ---------- an agent searching every registered project ----------
  const picked = chosen && value === chosen.id;

  return (
    <div className="max-w-xl">
      {picked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3">
          <div>
            <p className="text-[15px] font-semibold text-accent">
              {chosen.name}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {[chosen.locality, chosen.city].filter(Boolean).join(", ")}
              {chosen.builderName && ` · ${chosen.builderName}`}
              {reraNote(chosen)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              onChange("");
            }}
            className="text-[14px] font-medium text-muted transition-colors hover:text-ink"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <Field
            id="project-search"
            label="Search our registered projects"
            hint="By project name, locality or city."
          >
            <input
              id="project-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Skyline Meadows"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          {searching && (
            <p className="mt-2 text-[14px] text-muted">Searching…</p>
          )}

          {results !== null && !searching && results.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-lg ring-1 ring-line">
              {results.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(project);
                      onChange(project.id);
                    }}
                    className="flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-accent-soft"
                  >
                    <span className="text-[15px] font-medium">
                      {project.name}
                    </span>
                    <span className="mt-0.5 text-[13px] text-muted">
                      {[project.locality, project.city]
                        .filter(Boolean)
                        .join(", ")}
                      {project.builderName && ` · ${project.builderName}`}
                      {reraNote(project)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {more && !searching && (
            <p className="mt-2 text-[13px] text-muted">
              More projects match this. Add the locality or city to narrow the
              list.
            </p>
          )}

          {results !== null && !searching && results.length === 0 && (
            <p className="mt-3 text-[14px] text-muted">
              No registered project matches “{query.trim()}”. Check the spelling
              of the builder&apos;s name, or type the project name below
              instead.
            </p>
          )}
        </>
      )}

      {/* ---------- the other two answers ---------- */}
      {!picked && (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2.5 text-[14px]">
            <input
              type="radio"
              name="project-answer"
              checked={value === MANUAL}
              onChange={() => onChange(MANUAL)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              The project is not in the list — I will type its name
              <span className="mt-0.5 block text-[13px] text-muted">
                You will need the project name, the builder, and the RERA
                registration number.
              </span>
            </span>
          </label>

          {/* Shown only on that answer: the builder's details, in the agent's words. */}
          {value === MANUAL && (
            <div className="grid grid-cols-1 gap-4 sm:ml-7 sm:grid-cols-2">
              <Field id="manualName" label="Project name">
                <input
                  id="manualName"
                  type="text"
                  value={manualName}
                  onChange={(event) =>
                    onManualChange("manualName", event.target.value)
                  }
                  maxLength={120}
                  placeholder="As the builder calls it"
                  className={inputClass}
                />
              </Field>

              {/* A buyer needs to know whose project they are buying into, and we
                  have no builder account to read it from. */}
              <Field
                id="manualBuilder"
                label="Builder"
                hint="The company building the project."
              >
                <input
                  id="manualBuilder"
                  type="text"
                  value={manualBuilder}
                  onChange={(event) =>
                    onManualChange("manualBuilder", event.target.value)
                  }
                  maxLength={120}
                  placeholder="e.g. Skyline Builders"
                  className={inputClass}
                />
              </Field>

              <div>
                {/* Always required on this answer: an unregistered project with no
                    number is a name a buyer cannot check anywhere. */}
                <label htmlFor="manualRera" className={labelClass}>
                  Project RERA number
                  <span className="text-danger" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </label>
                <input
                  id="manualRera"
                  type="text"
                  value={manualRera}
                  onChange={(event) =>
                    onManualChange("manualRera", event.target.value)
                  }
                  maxLength={60}
                  placeholder="e.g. K-RERA/PRJ/ERN/123/2024"
                  className={`${inputClass} tabular-nums`}
                />
                <p className="mt-1.5 text-[13px] text-muted">
                  The builder has not registered this project here, so this
                  number is the only way a buyer can check it on the state RERA
                  site.
                  {mustHaveProject
                    ? " A unit under construction is sold off-plan, so the advertisement cannot go out without it."
                    : " If the building is old or exempt and has no number, choose \u201cNot part of a project\u201d below."}
                </p>
              </div>

              <p className="text-[13px] leading-snug text-muted sm:col-span-2">
                These details are shown to buyers as stated by you, not as
                confirmed by the builder, until the builder registers the
                project here.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2.5 text-[14px]">
            <input
              type="radio"
              name="project-answer"
              checked={value === NONE}
              onChange={() => onChange(NONE)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              Not part of a project
              <span className="mt-0.5 block text-[13px] text-muted">
                A resale, a plot, or an old building.
              </span>
            </span>
          </label>

          {value === NONE && mustHaveProject && (
            <p className="text-[14px] leading-snug text-warn">
              An under-construction unit is sold off-plan, so it belongs to a
              project that must be registered before it is advertised. Choose
              the project, or type its name and RERA number.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectPicker;
