import { api } from "@/lib/api";
import { formatFileSize } from "@/lib/format";

// Mirrors backend/src/lib/multer.ts and imageUploadService.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const MAX_MEDIA_FILES = 10; // photos and video together
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
export const MAX_PHOTOS_BYTES = 60 * 1024 * 1024; // one upload request
const UPLOAD_TIMEOUT = 120_000; // uploads take far longer than the default 10 s

// A file the broker picked but has not uploaded yet. The key keeps list
// rendering stable when two files share a name.
export type PickedFile = { key: string; file: File };

let pickCount = 0;

export const pickFile = (file: File): PickedFile => ({
  key: `${file.name}-${file.size}-${pickCount++}`,
  file,
});

// Each check returns a message for the broker, or null when the file is fine.
export const checkImage = (file: File) => {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name} — only JPG, PNG or WebP`;
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} — ${formatFileSize(file.size)}, over the 10 MB limit`;
  }
  return null;
};

export const checkVideo = (file: File) => {
  if (!VIDEO_TYPES.includes(file.type)) return `${file.name} — only MP4 or WebM`;
  if (file.size > MAX_VIDEO_BYTES) {
    return `${file.name} — ${formatFileSize(file.size)}, over the 30 MB limit`;
  }
  return null;
};

const toPercent = (loaded: number, total?: number) =>
  total ? Math.min(100, Math.round((loaded * 100) / total)) : 0;

export const uploadImages = (
  listingId: string,
  files: File[],
  onProgress?: (percent: number) => void,
) => {
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  return api.post(`/list/images/${listingId}`, form, {
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => onProgress?.(toPercent(event.loaded, event.total)),
  });
};

export const uploadVideo = (
  listingId: string,
  file: File,
  onProgress?: (percent: number) => void,
) => {
  const form = new FormData();
  form.append("video", file);
  return api.post(`/list/video/${listingId}`, form, {
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => onProgress?.(toPercent(event.loaded, event.total)),
  });
};
