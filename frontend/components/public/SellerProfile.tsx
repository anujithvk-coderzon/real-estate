"use client";

// A seller's public profile, reached from "Listed by …" on a listing.
// Projects appear only for builders who have some; listings load a page at a time.

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicListingCard from "@/components/listing/PublicListingCard";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { labelOf } from "@/lib/listing";
import { PROJECT_STATUS } from "@/lib/project";
import type { PublicListingSummary, VerificationStatus } from "@/lib/types";
import { secondaryButton } from "@/lib/ui";

type Project = {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  propertyType?: string | null;
  totalUnits?: number | null;
  locality: string;
  city: string;
  reraNumber?: string | null;
  reraStatus: string;
  isReraExempt: boolean;
  images: { path: string }[];
};

type Profile = {
  name: string;
  slug: string;
  avatarUrl: string | null;
  description?: string | null;
  accountType?: string | null;
  agentReraNumber?: string | null;
  agentReraState?: string | null;
  agentReraStatus: VerificationStatus;
  memberSince: string;
  listingCount: number;
  projects: Project[];
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

// Only a checked registration says "verified"; the rest say what they are.
const RERA_BADGE: Record<
  VerificationStatus,
  { text: string; className: string } | null
> = {
  NONE: null,
  PENDING: { text: "RERA number provided", className: "bg-ground text-muted" },
  VERIFIED: { text: "RERA verified", className: "bg-accent-soft text-accent" },
  REVOKED: {
    text: "Registration removed by the registry",
    className: "bg-danger/10 text-danger",
  },
};

const SellerProfile = ({ slug }: { slug: string }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [listings, setListings] = useState<PublicListingSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api
      .get(`/auth/public/${slug}`)
      .then((response) => setProfile(response.data.profile))
      .catch(() => setNotFound(true));

    api
      .get(`/list/seller/${slug}`, { params: { page: 1 } })
      .then((response) => {
        setListings(response.data.lists ?? []);
        setTotal(response.data.total ?? 0);
      })
      .catch(() => setListings([]));
  }, [slug]);

  // One page at a time, so a seller with 200 listings doesn't send them all at once.
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const response = await api.get(`/list/seller/${slug}`, {
        params: { page: page + 1 },
      });
      setListings((prev) => [...(prev ?? []), ...(response.data.lists ?? [])]);
      setPage(page + 1);
    } catch {
      // Keep what is already shown; the button stays for another try.
    } finally {
      setLoadingMore(false);
    }
  };

  if (notFound) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-[22px]">
          This profile is not available
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          The link may be wrong, or the account was removed.
        </p>
        <Link href="/" className={`mt-6 inline-block ${secondaryButton}`}>
          See all properties
        </Link>
      </main>
    );
  }

  const badge = profile ? RERA_BADGE[profile.agentReraStatus] : null;
  const hasMore = (listings?.length ?? 0) < total;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:py-12">
      <Link
        href="/"
        className="text-[14px] font-medium text-muted transition-colors hover:text-ink"
      >
        ← All properties
      </Link>

      {/* ---------- who they are ---------- */}
      <section
        aria-labelledby="seller-heading"
        className="mt-6 border-b border-line pb-8"
      >
        {profile ? (
          <div className="flex flex-col items-center text-center">
            <span className="font-display flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-accent text-[28px] text-white">
              {profile.avatarUrl && !avatarFailed ? (
                // Google photos refuse requests that send a Referer, hence no-referrer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                initialsOf(profile.name)
              )}
            </span>

            <h1
              id="seller-heading"
              className="mt-4 font-display text-[28px] leading-tight sm:text-[32px]"
            >
              {profile.name}
            </h1>
            <p className="mt-1 text-[15px] text-muted">
              {labelOf(profile.accountType ?? "") || "Seller"} ·{" "}
              {profile.listingCount}{" "}
              {profile.listingCount === 1 ? "listing" : "listings"} · on the
              site since {formatDate(profile.memberSince)}
            </p>

            {profile.description && (
              <p className="mt-4 max-w-prose whitespace-pre-line text-[15px] leading-relaxed">
                {profile.description}
              </p>
            )}

            {(badge || profile.agentReraNumber) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]">
                {badge && (
                  <span
                    className={`rounded-full px-3 py-1 font-medium ${badge.className}`}
                  >
                    {badge.text}
                  </span>
                )}
                {profile.agentReraNumber && (
                  <span className="rounded-full bg-ground px-3 py-1 tabular-nums text-muted">
                    {profile.agentReraNumber}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center" aria-busy="true">
            <div className="h-24 w-24 animate-pulse rounded-full bg-line" />
            <div className="mt-4 h-7 w-44 animate-pulse rounded bg-line" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-line" />
          </div>
        )}
      </section>

      {/* ---------- projects, only when there are any ---------- */}
      {profile && profile.projects.length > 0 && (
        <section aria-labelledby="projects-heading" className="mt-8">
          <h2 id="projects-heading" className="font-display text-[20px]">
            Projects
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.projects.map((project) => (
              <li
                key={project.id}
                className="overflow-hidden rounded-xl bg-panel ring-1 ring-line"
              >
                {project.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.images[0].path}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/10] w-full bg-ground object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-ground text-[13px] text-muted">
                    No photos
                  </div>
                )}
                <div className="p-4">
                  <p className="truncate text-[16px] font-semibold">
                    {project.name}
                  </p>
                  <p className="mt-1 text-[14px] text-muted">
                    {PROJECT_STATUS.find(
                      (option) => option.value === project.status,
                    )?.label ?? project.status}
                    {" · "}
                    {[project.locality, project.city]
                      .filter(Boolean)
                      .join(", ")}
                    {typeof project.totalUnits === "number" &&
                      ` · ${project.totalUnits} units`}
                  </p>
                  {project.isReraExempt ? (
                    <p className="mt-2 text-[12px] text-muted">
                      Stated as exempt from RERA registration
                    </p>
                  ) : (
                    project.reraNumber && (
                      <p className="mt-2 tabular-nums text-[12px] text-muted">
                        RERA {project.reraNumber}
                      </p>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- their listings ---------- */}
      <section aria-labelledby="listings-heading" className="mt-10">
        <h2 id="listings-heading" className="font-display text-[20px]">
          {total > 0
            ? `${total} ${total === 1 ? "property" : "properties"}`
            : "Properties"}
        </h2>

        {listings === null ? (
          <ul
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="overflow-hidden rounded-xl bg-panel ring-1 ring-line"
              >
                <div className="aspect-[16/10] animate-pulse bg-line/50" />
                <div className="space-y-2.5 p-3.5">
                  <div className="h-5 w-24 animate-pulse rounded bg-line/70" />
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-line/70" />
                </div>
              </li>
            ))}
          </ul>
        ) : listings.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">
            Nothing listed right now.
          </p>
        ) : (
          <>
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing, index) => (
                <li key={listing.slug ?? `listing-${index}`}>
                  <PublicListingCard listing={listing} />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className={secondaryButton}
                >
                  {loadingMore
                    ? "Loading…"
                    : `Show more (${total - listings.length} left)`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default SellerProfile;
