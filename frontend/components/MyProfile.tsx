"use client";

// "My profile": what buyers see when they look at the person behind a listing.
// Builders will also show their projects here once that feature exists.

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicListingCard from "@/components/listing/PublicListingCard";
import { api } from "@/lib/api";
import { labelOf } from "@/lib/listing";
import { PROJECT_STATUS } from "@/lib/project";
import { errorToast } from "@/lib/toast";
import type { AuthUser, PublicListingSummary, VerificationStatus } from "@/lib/types";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// Only what this page shows. The full project lives on its own page.
type ProjectSummary = {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  locality: string;
  city: string;
  totalUnits?: number | null;
  reraNumber?: string | null;
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

// Only a checked registration earns a badge; anything else is stated plainly.
const RERA_BADGE: Record<VerificationStatus, { text: string; className: string } | null> = {
  NONE: null,
  PENDING: { text: "RERA number on file", className: "bg-warn/10 text-warn" },
  VERIFIED: { text: "RERA verified", className: "bg-accent-soft text-accent" },
  REVOKED: { text: "Registration removed by the registry", className: "bg-danger/10 text-danger" },
};

const MyProfile = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [listings, setListings] = useState<PublicListingSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch((error) => errorToast(apiMessage(error)));

    // Only published listings: this page shows what buyers can actually see.
    api
      .get("/list/owner/all", { params: { status: "ACTIVE", page: 1 } })
      .then((response) => {
        setListings(response.data.lists ?? []);
        setTotal(response.data.total ?? 0);
      })
      .catch(() => setListings([]));

    // Builders only; the endpoint may not exist yet, and an empty list is fine.
    api
      .get("/project/mine")
      .then((response) => setProjects(response.data.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  const badge = user ? RERA_BADGE[user.agentReraStatus] : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-tight lg:text-[40px]">My profile</h1>
          <p className="mt-1 text-[15px] text-muted">How you appear to buyers on your listings.</p>
        </div>
        <Link href="/list/settings" className={secondaryButton}>
          Edit in settings
        </Link>
      </header>

      {/* ---------- who you are ---------- */}
      <section aria-labelledby="identity-heading" className="mt-8 border-b border-line pb-8">
        <h2 id="identity-heading" className="sr-only">
          Your details
        </h2>

        {user ? (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-accent text-[28px] font-semibold text-white">
              {user.avatarUrl && !avatarFailed ? (
                // Google photos refuse requests that send a Referer, hence no-referrer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                initialsOf(user.name)
              )}
            </span>

            <h3 className="mt-4 font-display text-[28px] leading-tight sm:text-[32px]">{user.name}</h3>

            <p className="mt-1 text-[15px] text-muted">
              {labelOf(user.accountType) || "Owner"} · {total} {total === 1 ? "listing" : "listings"} live
            </p>

            {user.description && (
              <p className="mt-4 max-w-prose whitespace-pre-line text-[15px] leading-relaxed">{user.description}</p>
            )}

            {(badge || user.agentReraNumber) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]">
                {badge && (
                  <span className={`rounded-full px-3 py-1 font-medium ${badge.className}`}>{badge.text}</span>
                )}
                {user.agentReraNumber && (
                  <span className="rounded-full bg-ground px-3 py-1 font-mono text-muted">{user.agentReraNumber}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center" aria-busy="true">
            <div className="h-24 w-24 animate-pulse rounded-full bg-line" />
            <div className="mt-4 h-7 w-44 animate-pulse rounded bg-line" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-line" />
          </div>
        )}
      </section>

      {/* ---------- projects, for builders ---------- */}
      {/* Projects belong to builders only. */}
      {user?.accountType === "BUILDER" && (
        <section aria-labelledby="projects-heading" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="projects-heading" className="text-[20px] font-semibold tracking-tight">
              Projects
            </h2>
            <Link href="/list/my/projects/new" className={secondaryButton}>
              Add project
            </Link>
          </div>

          {projects && projects.length > 0 ? (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {projects.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <Link
                      href={`/list/my/projects/${project.id}`}
                      className="block truncate text-[16px] font-semibold hover:text-accent hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-0.5 text-[14px] text-muted">
                      {PROJECT_STATUS.find((option) => option.value === project.status)?.label ?? project.status}
                      {" · "}
                      {[project.locality, project.city].filter(Boolean).join(", ")}
                      {typeof project.totalUnits === "number" && ` · ${project.totalUnits} units`}
                    </p>
                  </div>
                  {project.reraNumber && (
                    <span className="min-w-0 rounded-full bg-ground px-3 py-1 font-mono text-[12px] text-muted">
                      {project.reraNumber}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-muted">
              Add the projects you have built or are building. Buyers see them here, and the flats you list
              in a project carry its registration number.
            </p>
          )}
        </section>
      )}

      {/* ---------- what you have listed ---------- */}
      <section aria-labelledby="live-heading" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="live-heading" className="text-[20px] font-semibold tracking-tight">
            Live listings
          </h2>
          {total > 0 && (
            <Link href="/list/my/listings" className="text-[14px] font-medium text-accent hover:underline">
              Manage all listings
            </Link>
          )}
        </div>

        {listings === null ? (
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="overflow-hidden rounded-xl">
                <div className="aspect-[16/10] animate-pulse bg-line/50" />
                <div className="space-y-2.5 p-3.5">
                  <div className="h-5 w-24 animate-pulse rounded bg-line/70" />
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-line/70" />
                </div>
              </li>
            ))}
          </ul>
        ) : listings.length === 0 ? (
          <div className="mt-5 py-10 text-center">
            <h3 className="text-[17px] font-semibold">Nothing published yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-muted">
              Published listings appear here, exactly as buyers see them.
            </p>
            <Link href="/list/create" className={`mt-5 inline-block ${primaryButton}`}>
              List a property
            </Link>
          </div>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <li key={listing.slug ?? `listing-${index}`}>
                <PublicListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default MyProfile;
