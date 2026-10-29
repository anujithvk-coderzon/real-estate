"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PROJECT_STATUS } from "@/lib/project";
import { primaryButton, secondaryButton } from "@/lib/ui";

// Only what this page shows. The full project lives on its own page, and the
// same shape is read on the profile — GET /project/mine answers both.
type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  locality: string;
  city: string;
  totalUnits?: number | null;
  reraNumber?: string | null;
};

const statusLabel = (status: string) =>
  PROJECT_STATUS.find((option) => option.value === status)?.label ?? status;

const MyProjects = () => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by Try again, so asking a second time is a new request rather than
  // a no-op on an unchanged dependency list.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api.get("/project/mine").then(
      ({ data }) => {
        if (live) setProjects(data.projects ?? []);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      // Left the page before it answered.
      live = false;
    };
  }, [attempt]);

  const reload = () => {
    setFailed(false);
    setProjects(null);
    setAttempt((n) => n + 1);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[30px] leading-none sm:text-[40px] lg:text-[48px]">
            Projects
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {projects === null
              ? "Loading your projects…"
              : projects.length === 0
                ? "Developments you have built or are building."
                : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
          </p>
        </div>
        {projects !== null && projects.length > 0 && (
          <Link href="/list/my/projects/new" className={primaryButton}>
            Add project
          </Link>
        )}
      </header>

      {failed ? (
        <div className="mt-10 rounded-2xl bg-panel p-6 text-center ring-1 ring-line sm:p-10">
          <h2 className="font-display text-[18px]">
            Your projects could not be loaded
          </h2>
          <p className="mt-2 text-[15px] text-muted">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={reload}
            className={`mt-5 ${secondaryButton}`}
          >
            Try again
          </button>
        </div>
      ) : projects === null ? (
        <ul
          className="mt-8 divide-y divide-line border-y border-line"
          aria-busy="true"
        >
          <span className="sr-only">Loading your projects</span>
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="space-y-2 py-5">
              <div className="h-4 w-48 animate-pulse rounded bg-line" />
              <div className="h-3 w-32 animate-pulse rounded bg-line" />
            </li>
          ))}
        </ul>
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
          <h2 className="font-display text-[30px] leading-tight">
            No projects yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">
            Add the developments you have built or are building. Buyers see them
            on your profile, and every flat you list inside one carries the
            project&apos;s registration number automatically.
          </p>
          <Link
            href="/list/my/projects/new"
            className={`mt-6 inline-block ${primaryButton}`}
          >
            Add your first project
          </Link>
        </div>
      ) : (
        /* A list, not cards: the name is what a builder scans for, and a row
           puts it at the same left edge every time. */
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/list/my/projects/${project.id}`}
                  className="block truncate text-[16px] font-semibold hover:text-accent hover:underline"
                >
                  {project.name}
                </Link>
                <p className="mt-0.5 text-[14px] text-muted">
                  {statusLabel(project.status)}
                  {" · "}
                  {[project.locality, project.city].filter(Boolean).join(", ")}
                  {typeof project.totalUnits === "number" &&
                    ` · ${project.totalUnits} units`}
                </p>
              </div>
              {project.reraNumber && (
                <p className="text-[12.5px] tabular-nums text-muted">
                  RERA {project.reraNumber}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default MyProjects;
