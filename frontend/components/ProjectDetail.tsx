"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { formatDate, formatRupeesShort } from "@/lib/format";
import { labelOf } from "@/lib/listing";
import { PROJECT_STATUS, type ProjectDetail as Project } from "@/lib/project";
import { errorToast, successToast } from "@/lib/toast";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// Only a checked registration earns the word "verified".
const RERA_TEXT: Record<string, { text: string; className: string }> = {
  NONE: { text: "Number as provided by you", className: "bg-ground text-muted" },
  PENDING: { text: "Awaiting check", className: "bg-warn/10 text-warn" },
  VERIFIED: { text: "Verified", className: "bg-accent-soft text-accent" },
  REVOKED: { text: "Removed by the registry", className: "bg-danger/10 text-danger" },
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="py-3">
    <dt className="text-[13px] text-muted">{label}</dt>
    <dd className="mt-0.5 text-[15px]">{value}</dd>
  </div>
);

const ProjectDetail = ({ projectId }: { projectId: string }) => {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/project/single/${projectId}`)
      .then((response) => setProject(response.data.project))
      .catch((error) => {
        setFailed(true);
        errorToast(apiMessage(error));
      });
  }, [projectId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await api.delete(`/project/delete/${projectId}`);
      successToast(response.data.message ?? "Project deleted");
      router.replace("/list/my/profile");
    } catch (error) {
      errorToast(apiMessage(error));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">This project could not be loaded</h1>
        <p className="mt-2 text-[15px] text-muted">It may have been deleted, or the link is wrong.</p>
        <Link href="/list/my/profile" className={`mt-6 inline-block ${secondaryButton}`}>
          Back to my profile
        </Link>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:py-12" aria-busy="true">
        <div className="h-9 w-64 animate-pulse rounded bg-line" />
        <div className="mt-6 aspect-[16/9] animate-pulse rounded-xl bg-line" />
      </main>
    );
  }

  const stage = PROJECT_STATUS.find((option) => option.value === project.status)?.label ?? project.status;
  const rera = RERA_TEXT[project.reraStatus] ?? RERA_TEXT.NONE!;
  const price =
    project.minPrice && project.maxPrice
      ? `${formatRupeesShort(project.minPrice)} – ${formatRupeesShort(project.maxPrice)}`
      : project.minPrice
        ? `From ${formatRupeesShort(project.minPrice)}`
        : project.maxPrice
          ? `Up to ${formatRupeesShort(project.maxPrice)}`
          : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:py-12">
      <Link href="/list/my/profile" className="text-[14px] font-medium text-muted transition-colors hover:text-ink">
        ← My profile
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] leading-tight lg:text-[38px]">{project.name}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {stage} · {[project.locality, project.city].filter(Boolean).join(", ")}
            {typeof project.totalUnits === "number" && ` · ${project.totalUnits} units`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/list/my/projects/${projectId}/edit`} className={secondaryButton}>
            Edit
          </Link>
          <Link href={`/list/my/projects/${projectId}/photos`} className={secondaryButton}>
            Photos
          </Link>
        </div>
      </header>

      {/* ---------- photos ---------- */}
      {project.images.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {project.images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-lg bg-ground ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.path} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[14px] text-muted">
          No photos yet.{" "}
          <Link href={`/list/my/projects/${projectId}/photos`} className="font-medium text-accent hover:underline">
            Add some
          </Link>
          .
        </p>
      )}

      {project.description && (
        <p className="mt-8 max-w-prose whitespace-pre-line text-[15px] leading-relaxed">{project.description}</p>
      )}

      {/* ---------- the details ---------- */}
      <dl className="mt-8 grid grid-cols-1 gap-x-10 border-t border-line sm:grid-cols-2">
        <Row label="Stage" value={stage} />
        {project.propertyType && <Row label="Type" value={labelOf(project.propertyType)} />}
        {typeof project.totalUnits === "number" && <Row label="Total units" value={project.totalUnits} />}
        {price && <Row label="Price range" value={price} />}
        {project.startedAt && <Row label="Started" value={formatDate(project.startedAt)} />}
        {project.handoverAt && (
          <Row
            label={project.status === "COMPLETED" ? "Completed in" : "Expected handover"}
            value={formatDate(project.handoverAt)}
          />
        )}
        <Row
          label="Where"
          value={[project.locality, project.city, project.district, project.state, project.pincode]
            .filter(Boolean)
            .join(", ")}
        />
        <Row label="Listings in this project" value={project.listingCount} />
      </dl>

      {/* ---------- registration ---------- */}
      <section aria-labelledby="rera-heading" className="mt-8 border-t border-line pt-6">
        <h2 id="rera-heading" className="text-[17px] font-semibold tracking-tight">
          RERA registration
        </h2>
        {project.isReraExempt ? (
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed">
            Stated as exempt: <span className="text-muted">{project.exemptReason}</span>
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[15px]">{project.reraNumber}</span>
            {project.reraState && <span className="text-[14px] text-muted">· {project.reraState}</span>}
            <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${rera.className}`}>{rera.text}</span>
          </div>
        )}
      </section>

      {/* ---------- remove ---------- */}
      <section className="mt-10 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-muted">
            {project.listingCount > 0
              ? `${project.listingCount} listings point at this project, so it can't be deleted yet.`
              : "Deleting removes the project and its photos. This cannot be undone."}
          </p>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={project.listingCount > 0 || deleting}
            className={secondaryButton}
          >
            Delete project
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this project?"
        message={
          <>
            <span className="font-medium text-ink">“{project.name}”</span> and its photos will be deleted. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      <div className="mt-10">
        <Link href="/list/my/profile" className={primaryButton}>
          Done
        </Link>
      </div>
    </main>
  );
};

export default ProjectDetail;
