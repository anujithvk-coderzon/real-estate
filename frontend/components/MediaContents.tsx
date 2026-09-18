"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePreview, VideoPreview } from "@/components/FilePreview";
import { formatFileSize } from "@/lib/format";
import {
  IMAGE_TYPES,
  MAX_MEDIA_FILES,
  MAX_PHOTOS_BYTES,
  VIDEO_TYPES,
  checkImage,
  checkVideo,
  pickFile,
  uploadImages,
  uploadVideo,
  type PickedFile,
} from "@/lib/media";
import { errorToast, successToast } from "@/lib/toast";
import { primaryButton, secondaryButton, sectionTitle, textButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type Props = { id: string };

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "saving" | "saved" | "failed" };

const IDLE: UploadState = { status: "idle" };

const statusText = (upload: UploadState) => {
  switch (upload.status) {
    case "uploading":
      return `${upload.percent}%`;
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "failed":
      return "Failed";
    default:
      return "";
  }
};

// Upload progress reaches 100% once the browser has sent the file to our
// server; the server still has to store it, so 100% is shown as "Saving…".
const progressState = (percent: number): UploadState =>
  percent < 100 ? { status: "uploading", percent } : { status: "saving" };

const MediaContents = ({ id }: Props) => {
  const router = useRouter();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<PickedFile[]>([]);
  const [video, setVideo] = useState<PickedFile | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [imageUpload, setImageUpload] = useState<UploadState>(IDLE);
  const [videoUpload, setVideoUpload] = useState<UploadState>(IDLE);

  // Ten files in total, and the video takes one of them.
  const imageLimit = MAX_MEDIA_FILES - (video ? 1 : 0);
  const canAddVideo = !video && images.length < MAX_MEDIA_FILES;
  const imageBytes = images.reduce((sum, image) => sum + image.file.size, 0);
  const photosTooLarge = imageBytes > MAX_PHOTOS_BYTES;

  // Once a part is saved it lives on the server; changing it would upload duplicates.
  const imagesLocked = submitting || imageUpload.status === "saved";
  const videoLocked = submitting || videoUpload.status === "saved";

  // Any change to the photos makes an earlier result (Failed, a stale %) meaningless.
  const updateImages = (next: PickedFile[]) => {
    setImages(next);
    setImageUpload(IDLE);
  };

  const addImages = (files: FileList | null) => {
    const accepted: PickedFile[] = [];
    const problems: string[] = [];

    for (const file of Array.from(files ?? [])) {
      const problem =
        checkImage(file) ??
        (images.length + accepted.length >= imageLimit
          ? `${file.name} — ${MAX_MEDIA_FILES} files in total, including the video`
          : null);

      if (problem) problems.push(problem);
      else accepted.push(pickFile(file));
    }

    if (accepted.length > 0) updateImages([...images, ...accepted]);
    setSkipped(problems);
  };

  const moveImage = (index: number, offset: -1 | 1) => {
    const next = [...images];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    updateImages(next);
  };

  const addVideo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const problem = checkVideo(file);
    setSkipped(problem ? [problem] : []);
    if (problem) return;

    setVideo(pickFile(file));
    setVideoUpload(IDLE);
  };

  const removeVideo = () => {
    setVideo(null);
    setVideoUpload(IDLE);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    let failed = false;

    if (images.length > 0 && imageUpload.status !== "saved") {
      try {
        const response = await uploadImages(
          id,
          images.map((image) => image.file),
          (percent) => setImageUpload(progressState(percent)),
        );
        setImageUpload({ status: "saved" });
        successToast(response.data.message);
      } catch (error) {
        failed = true;
        setImageUpload({ status: "failed" });
        errorToast(apiMessage(error));
      }
    }

    if (video && videoUpload.status !== "saved") {
      try {
        const response = await uploadVideo(id, video.file, (percent) =>
          setVideoUpload(progressState(percent)),
        );
        setVideoUpload({ status: "saved" });
        successToast(response.data.message);
      } catch (error) {
        failed = true;
        setVideoUpload({ status: "failed" });
        errorToast(apiMessage(error));
      }
    }

    setSubmitting(false);
    if (!failed) router.push(`/list/my/listings/${id}`);
  };

  const uploadLines = [
    { name: "Photos", upload: imageUpload, visible: images.length > 0 },
    { name: "Video", upload: videoUpload, visible: video !== null },
  ].filter((line) => line.visible && line.upload.status !== "idle");

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-8 lg:py-10">
      <p className="text-[13px] font-medium text-muted">Step 2 of 2</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight lg:text-[34px]">
        Photos and video
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        Listings with clear photos get far more enquiries. The first photo is what buyers see in
        search results.
      </p>

      {/* Hidden native inputs, opened by the styled buttons below. */}
      <input
        ref={imageInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(event) => {
          addImages(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        hidden
        onChange={(event) => {
          addVideo(event.target.files);
          event.target.value = "";
        }}
      />

      {/* ---------- photos ---------- */}
      <section className="mt-8 rounded-lg border border-line bg-panel p-5 lg:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>Photos</h2>
          <p className="font-mono text-[13px] text-muted">
            {images.length}/{imageLimit} · {formatFileSize(imageBytes)}
          </p>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          JPG, PNG or WebP · up to 10 MB each · {MAX_MEDIA_FILES} files in total, including the video
        </p>

        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={imagesLocked}
            className="mt-4 flex h-44 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <span className="text-[15px] font-medium">Choose photos</span>
            <span className="text-[13px]">At least one, up to {imageLimit}</span>
          </button>
        ) : (
          <>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image, index) => (
                <li key={image.key} className="overflow-hidden rounded-md border border-line">
                  <div className="relative aspect-[4/3] bg-ground">
                    <ImagePreview file={image.file} className="h-full w-full object-cover" />
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white">
                        Cover
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="font-mono text-[11px] text-muted">
                      {formatFileSize(image.file.size)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(index, -1)}
                        disabled={imagesLocked || index === 0}
                        aria-label={`Move photo ${index + 1} earlier`}
                        className={`px-1 ${textButton}`}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, 1)}
                        disabled={imagesLocked || index === images.length - 1}
                        aria-label={`Move photo ${index + 1} later`}
                        className={`px-1 ${textButton}`}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => updateImages(images.filter((i) => i.key !== image.key))}
                        disabled={imagesLocked}
                        aria-label={`Remove photo ${index + 1}`}
                        className={`px-1 ${textButton}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {images.length < imageLimit && !imagesLocked && (
              <button
                type="button"
                onClick={() => imageInput.current?.click()}
                className={`mt-3 ${secondaryButton}`}
              >
                Add more photos
              </button>
            )}
          </>
        )}
      </section>

      {/* ---------- video ---------- */}
      <section className="mt-6 rounded-lg border border-line bg-panel p-5 lg:p-6">
        <h2 className={sectionTitle}>
          Video <span className="text-[14px] font-normal text-muted">(optional)</span>
        </h2>
        <p className="mt-1 text-[13px] text-muted">MP4 or WebM · one video · up to 30 MB</p>

        {video ? (
          <div className="mt-4 overflow-hidden rounded-md border border-line">
            <VideoPreview file={video.file} className="aspect-video w-full bg-ground" />
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-[13px] text-muted">
                {video.file.name} · {formatFileSize(video.file.size)}
              </span>
              {!videoLocked && (
                <div className="flex gap-3">
                  <button type="button" onClick={() => videoInput.current?.click()} className={textButton}>
                    Replace
                  </button>
                  <button type="button" onClick={removeVideo} className={textButton}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={!canAddVideo || videoLocked}
            className="mt-4 flex h-28 w-full items-center justify-center rounded-md border border-dashed border-line text-[15px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {canAddVideo ? "Choose a video" : "Remove a photo to add a video"}
          </button>
        )}
      </section>

      {skipped.length > 0 && (
        <div role="status" className="mt-6 rounded-md border border-warn/25 bg-warn/5 px-3.5 py-3">
          <p className="text-[14px] font-medium text-ink">These files were skipped</p>
          <ul className="mt-1.5 space-y-1">
            {skipped.map((problem) => (
              <li key={problem} className="text-[13px] leading-snug text-muted">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploadLines.length > 0 && (
        <div className="mt-6 space-y-1 text-[14px] text-muted">
          {uploadLines.map(({ name, upload }) => (
            <p key={name}>
              {name}:{" "}
              <span className={`font-mono ${upload.status === "failed" ? "text-warn" : "text-ink"}`}>
                {statusText(upload)}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">
          {images.length === 0
            ? "Add at least one photo to continue."
            : photosTooLarge
              ? "Photos are over 60 MB in total. Remove one to continue."
              : "Ready to continue."}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={images.length === 0 || photosTooLarge || submitting}
          className={primaryButton}
        >
          {submitting ? "Uploading…" : "Save & continue"}
        </button>
      </div>
    </main>
  );
};

export default MediaContents;
