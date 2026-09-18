"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddressForm from "@/components/AddressForm";
import { ImagePreview, VideoPreview } from "@/components/FilePreview";
import MapPicker from "@/components/MapPicker";
import PropertyDetailsForm from "@/components/PropertyDetailsForm";
import { api } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import { addressFromPin } from "@/lib/geocode";
import {
  INDIA_CENTER,
  buildListingPayload,
  getMissingFields,
  listingLocation,
  listingToFormData,
} from "@/lib/listing";
import {
  IMAGE_TYPES,
  MAX_MEDIA_FILES,
  VIDEO_TYPES,
  checkImage,
  checkVideo,
  pickFile,
  uploadImages,
  uploadVideo,
  type PickedFile,
} from "@/lib/media";
import { errorToast, successToast } from "@/lib/toast";
import {
  emptyListing,
  type Listing,
  type ListingFormData,
  type ListingImage,
  type ListingVideo,
  type LngLat,
} from "@/lib/types";
import { primaryButton, secondaryButton, sectionTitle, textButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type Props = { id: string };

const EditListing = ({ id }: Props) => {
  const router = useRouter();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [data, setData] = useState<ListingFormData>(emptyListing);
  const [location, setLocation] = useState<LngLat | null>(null);
  const [savedImages, setSavedImages] = useState<ListingImage[]>([]);
  const [savedVideo, setSavedVideo] = useState<ListingVideo | null>(null);
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([]);
  const [removeSavedVideo, setRemoveSavedVideo] = useState(false);
  const [newImages, setNewImages] = useState<PickedFile[]>([]);
  const [newVideo, setNewVideo] = useState<PickedFile | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");

  const showSavedMedia = (listing: Listing) => {
    setSavedImages(listing.listingImages);
    setSavedVideo(listing.listingVideo);
  };

  useEffect(() => {
    api
      .get(`/list/owner/${id}`)
      .then((response) => {
        const listing: Listing = response.data.response;
        setData(listingToFormData(listing));
        setLocation(listingLocation(listing));
        showSavedMedia(listing);
        setLoaded(true);
      })
      .catch((error) => {
        setLoadFailed(true);
        errorToast(apiMessage(error));
      });
  }, [id]);

  /* ---------- the ten-file limit ---------- */


  const keptImageCount = savedImages.length - imagesToRemove.length;
  const photoCount = keptImageCount + newImages.length;
  const hasVideo = (savedVideo !== null && !removeSavedVideo) || newVideo !== null;
  const fileCount = photoCount + (hasVideo ? 1 : 0);
  const slotsLeft = MAX_MEDIA_FILES - fileCount;

  /* ---------- media changes ---------- */

  const toggleSavedImage = (imageId: string) => {
    if (!imagesToRemove.includes(imageId)) {
      setImagesToRemove([...imagesToRemove, imageId]);
    } else if (slotsLeft > 0) {
      setImagesToRemove(imagesToRemove.filter((removeId) => removeId !== imageId));
    } else {
      setSkipped(["Discard a new file first — 10 files in total, including the video."]);
    }
  };

  const toggleSavedVideo = () => {
    if (!removeSavedVideo) setRemoveSavedVideo(true);
    else if (!newVideo && slotsLeft > 0) setRemoveSavedVideo(false);
    else setSkipped(["Discard the new video or a photo first — 10 files in total."]);
  };

  const addImages = (files: FileList | null) => {
    const accepted: PickedFile[] = [];
    const problems: string[] = [];

    for (const file of Array.from(files ?? [])) {
      const problem =
        checkImage(file) ??
        (accepted.length >= slotsLeft ? `${file.name} — 10 files in total, including the video` : null);

      if (problem) problems.push(problem);
      else accepted.push(pickFile(file));
    }

    setNewImages([...newImages, ...accepted]);
    setSkipped(problems);
  };

  const addVideo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const problem = checkVideo(file);
    setSkipped(problem ? [problem] : []);
    if (!problem) setNewVideo(pickFile(file));
  };

  /* ---------- save ---------- */

  const missing = getMissingFields(data, location);

  // Each step clears its own pending change as soon as it succeeds, so if a
  // later step fails, a retry only repeats what is still outstanding.
  const handleSave = async () => {
    setSaving(true);
    try {
      // Removals first, so the backend's 10-file check counts the freed slots.
      for (const imageId of imagesToRemove) {
        setSavingStep("Removing photos…");
        await api.delete(`/list/image/delete/${imageId}`);
        setImagesToRemove((prev) => prev.filter((removeId) => removeId !== imageId));
      }
      if (removeSavedVideo && savedVideo) {
        setSavingStep("Removing the video…");
        await api.delete(`/list/video/delete/${savedVideo.id}`);
        setRemoveSavedVideo(false);
      }

      setSavingStep("Saving details…");
      await api.patch(`/list/update/${id}`, buildListingPayload(data, location));

      if (newImages.length > 0) {
        setSavingStep("Uploading photos…");
        await uploadImages(id, newImages.map((image) => image.file));
        setNewImages([]);
      }
      if (newVideo) {
        setSavingStep("Uploading the video…");
        await uploadVideo(id, newVideo.file);
        setNewVideo(null);
      }

      successToast("Listing updated");
      router.push(`/list/my/listings/${id}`);
    } catch (error) {
      errorToast(apiMessage(error));
      // Show what the server has now, including any steps that did finish.
      // Unsaved form edits are kept.
      api
        .get(`/list/owner/${id}`)
        .then((response) => showSavedMedia(response.data.response))
        .catch(() => {});
      setSaving(false);
      setSavingStep("");
    }
  };

  /* ---------- render ---------- */

  if (loadFailed) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">This listing could not be loaded</h1>
        <p className="mt-2 text-[15px] text-muted">It may have been deleted, or it is not yours to edit.</p>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8" aria-busy="true">
        <div className="h-9 w-1/2 animate-pulse rounded bg-line" />
        <div className="mt-8 h-96 animate-pulse rounded-lg bg-line" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <Link href={`/list/my/listings/${id}`} className="text-[14px] font-medium text-muted hover:text-ink">
        ← Back to listing
      </Link>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight lg:text-[34px]">
        Edit listing
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        Nothing changes, including removed photos, until you save.
      </p>

      {/* ---------- details ---------- */}
      <section className="mt-8 rounded-lg border border-line bg-panel p-5 lg:p-6">
        <h2 className={sectionTitle}>Property details</h2>
        <div className="mt-6">
          <PropertyDetailsForm data={data} setData={setData} />
        </div>
      </section>

      {/* ---------- location ---------- */}
      <h2 className={`mt-10 ${sectionTitle}`}>Location</h2>
      <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-muted">
        Drag the pin to the exact spot. Moving the pin does not change the address unless you ask it to.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <AddressForm data={data} setData={setData} onLocate={(next) => setLocation(next)} />
          {location && (
            <button
              type="button"
              onClick={() =>
                addressFromPin(location)
                  .then((address) => {
                    setData((prev) => ({ ...prev, ...address }));
                    successToast("Address filled from the pin. Check it before saving.");
                  })
                  .catch((error) => errorToast(apiMessage(error)))
              }
              className={`mt-3 w-full ${secondaryButton}`}
            >
              Get address from pin location
            </button>
          )}
        </section>

        <section className="h-[420px] overflow-hidden rounded-lg border border-line bg-panel lg:h-[560px]">
          {location ? (
            <MapPicker center={location} setLocation={setLocation} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="max-w-xs text-[15px] leading-relaxed text-muted">
                This listing has no pin, so it will not appear in map search.
              </p>
              <button type="button" onClick={() => setLocation(INDIA_CENTER)} className={secondaryButton}>
                Place a pin
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ---------- media ---------- */}
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

      <section className="mt-10 rounded-lg border border-line bg-panel p-5 lg:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>Photos and video</h2>
          <p className="font-mono text-[13px] text-muted">
            {fileCount}/{MAX_MEDIA_FILES} files
          </p>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          JPG, PNG or WebP up to 10 MB · one MP4 or WebM video up to 30 MB · 10 files in total
        </p>

        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {savedImages.map((image, index) => {
            const removing = imagesToRemove.includes(image.id);
            return (
              <li key={image.id} className="overflow-hidden rounded-md border border-line">
                <div className="relative aspect-[4/3] bg-ground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.path}
                    alt={`Photo ${index + 1}`}
                    className={`h-full w-full object-cover ${removing ? "opacity-30" : ""}`}
                  />
                  {removing && (
                    <span className="absolute inset-x-2 top-2 rounded bg-warn px-2 py-0.5 text-center text-[11px] font-medium text-white">
                      Will be removed
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[11px] text-muted">Saved</span>
                  <button type="button" onClick={() => toggleSavedImage(image.id)} disabled={saving} className={textButton}>
                    {removing ? "Undo" : "Remove"}
                  </button>
                </div>
              </li>
            );
          })}

          {newImages.map((image) => (
            <li key={image.key} className="overflow-hidden rounded-md border border-accent/40">
              <div className="aspect-[4/3] bg-ground">
                <ImagePreview file={image.file} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[11px] font-medium text-accent">New · {formatFileSize(image.file.size)}</span>
                <button
                  type="button"
                  onClick={() => setNewImages(newImages.filter((i) => i.key !== image.key))}
                  disabled={saving}
                  className={textButton}
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          disabled={saving || slotsLeft <= 0}
          className={`mt-4 ${secondaryButton}`}
        >
          {slotsLeft > 0 ? `Add photos (${slotsLeft} left)` : "No slots left"}
        </button>

        {/* video */}
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-[15px] font-semibold">Video</h3>

          {savedVideo && (
            <div className="mt-3 overflow-hidden rounded-md border border-line">
              <iframe
                src={savedVideo.url}
                title="Current video"
                loading="lazy"
                allowFullScreen
                className={`aspect-video w-full ${removeSavedVideo ? "opacity-30" : ""}`}
              />
              <div className="flex items-center justify-between px-3 py-2">
                <span className={`text-[13px] ${removeSavedVideo ? "font-medium text-warn" : "text-muted"}`}>
                  {removeSavedVideo ? "Will be removed" : "Saved"}
                </span>
                <button type="button" onClick={toggleSavedVideo} disabled={saving} className={textButton}>
                  {removeSavedVideo ? "Undo" : "Remove"}
                </button>
              </div>
            </div>
          )}

          {newVideo && (
            <div className="mt-3 overflow-hidden rounded-md border border-accent/40">
              <VideoPreview file={newVideo.file} className="aspect-video w-full bg-ground" />
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-[13px] font-medium text-accent">
                  New · {newVideo.file.name} · {formatFileSize(newVideo.file.size)}
                </span>
                <button type="button" onClick={() => setNewVideo(null)} disabled={saving} className={textButton}>
                  Discard
                </button>
              </div>
            </div>
          )}

          {!hasVideo && (
            <button
              type="button"
              onClick={() => videoInput.current?.click()}
              disabled={saving || slotsLeft <= 0}
              className={`mt-3 ${secondaryButton}`}
            >
              {slotsLeft > 0 ? "Add a video" : "Remove a photo to add a video"}
            </button>
          )}
        </div>

        {skipped.length > 0 && (
          <ul role="status" className="mt-5 space-y-1 rounded-md border border-warn/25 bg-warn/5 px-3.5 py-3">
            {skipped.map((problem) => (
              <li key={problem} className="text-[13px] leading-snug">
                {problem}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- save ---------- */}
      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">
          {saving
            ? savingStep
            : missing.length > 0
              ? `Still needed: ${missing.join(", ")}`
              : "All required details are filled in."}
        </p>
        <div className="flex gap-2">
          <Link href={`/list/my/listings/${id}`} className={secondaryButton}>
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || missing.length > 0}
            className={primaryButton}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </main>
  );
};

export default EditListing;
