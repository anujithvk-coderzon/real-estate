"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePreview } from "@/components/FilePreview";
import { api } from "@/lib/api";
import { checkImage, IMAGE_TYPES, MAX_MEDIA_FILES, pickFile, uploadProjectImages, type PickedFile } from "@/lib/media";
import { errorToast, successToast } from "@/lib/toast";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type SavedImage = { id: string; path: string; position: number };

// Photos of a project, added after it is created. Up to 10, same as a listing.
const ProjectPhotos = ({ projectId }: { projectId: string }) => {
  const [projectName, setProjectName] = useState("");
  const [saved, setSaved] = useState<SavedImage[] | null>(null);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSaved = () =>
    api
      .get(`/project/images/all/${projectId}`)
      .then((response) => {
        setProjectName(response.data.name ?? "");
        setSaved(response.data.images ?? []);
      })
      .catch((error) => {
        setSaved([]);
        errorToast(apiMessage(error));
      });

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const remaining = MAX_MEDIA_FILES - (saved?.length ?? 0) - picked.length;

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // picking the same file again still fires onChange
    const problems = files.map(checkImage).filter(Boolean);
    if (problems.length > 0) {
      errorToast(problems[0]!);
      return;
    }
    if (files.length > remaining) {
      errorToast(`You can add ${remaining} more ${remaining === 1 ? "photo" : "photos"}.`);
      return;
    }
    setPicked((prev) => [...prev, ...files.map(pickFile)]);
  };

  const handleUpload = async () => {
    if (picked.length === 0) return;
    setUploading(true);
    setPercent(0);
    try {
      const response = await uploadProjectImages(projectId, picked.map((item) => item.file), setPercent);
      successToast(response.data.message ?? "Photos uploaded");
      setPicked([]);
      await loadSaved();
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    try {
      const response = await api.delete(`/project/image/delete/${imageId}`);
      successToast(response.data.message ?? "Photo deleted");
      setSaved((prev) => prev?.filter((image) => image.id !== imageId) ?? null);
    } catch (error) {
      errorToast(apiMessage(error));
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:py-12">
      <header>
        <h1 className="font-display text-[32px] leading-tight lg:text-[38px]">Project photos</h1>
        <p className="mt-1 text-[15px] text-muted">
          {projectName ? `${projectName} · ` : ""}Up to {MAX_MEDIA_FILES} photos. The first one is the cover.
        </p>
      </header>

      {/* ---------- already saved ---------- */}
      <section aria-labelledby="saved-heading" className="mt-8">
        <h2 id="saved-heading" className="text-[17px] font-semibold tracking-tight">
          On this project
        </h2>
        {saved === null ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="aspect-[4/3] animate-pulse rounded-lg bg-line" />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">No photos yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {saved.map((image, index) => (
              <li key={image.id} className="relative overflow-hidden rounded-lg bg-ground ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.path} alt="" className="aspect-[4/3] w-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-panel/95 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  aria-label="Delete this photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-panel/95 text-[13px] text-muted shadow-sm transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- waiting to upload ---------- */}
      <section aria-labelledby="add-heading" className="mt-8 border-t border-line pt-8">
        <h2 id="add-heading" className="text-[17px] font-semibold tracking-tight">
          Add photos
        </h2>
        <p className="mt-1 text-[14px] text-muted">JPG, PNG or WebP, up to 10 MB each.</p>

        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          onChange={handlePick}
          hidden
          tabIndex={-1}
          aria-hidden="true"
        />

        {picked.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {picked.map((item) => (
              <li key={item.key} className="relative overflow-hidden rounded-lg bg-ground ring-2 ring-accent">
                <ImagePreview file={item.file} className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPicked((prev) => prev.filter((other) => other.key !== item.key))}
                  disabled={uploading}
                  aria-label="Remove this photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-panel/95 text-[13px] text-muted shadow-sm transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploading && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || remaining <= 0}
            className={secondaryButton}
          >
            {remaining > 0 ? "Choose photos" : "Limit reached"}
          </button>
          {picked.length > 0 && (
            <button type="button" onClick={handleUpload} disabled={uploading} className={primaryButton}>
              {uploading ? `Uploading… ${percent}%` : `Upload ${picked.length}`}
            </button>
          )}
        </div>
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <Link href="/list/my/profile" className={primaryButton}>
          Done
        </Link>
      </div>
    </main>
  );
};

export default ProjectPhotos;
