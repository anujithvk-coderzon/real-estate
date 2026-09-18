"use client";

import { useEffect, useRef } from "react";

// A picked file has no URL until we create one, and that URL keeps the whole
// file in memory until it is revoked. Creating it here and revoking it in the
// cleanup releases it automatically when the preview disappears.
const useFileSource = <T extends HTMLImageElement | HTMLVideoElement>(file: File) => {
  const element = useRef<T>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (element.current) element.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return element;
};

type Props = {
  file: File;
  className?: string;
};

export const ImagePreview = ({ file, className }: Props) => {
  const image = useFileSource<HTMLImageElement>(file);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={file.name} className={className} />;
};

export const VideoPreview = ({ file, className }: Props) => {
  const video = useFileSource<HTMLVideoElement>(file);
  return <video ref={video} controls className={className} />;
};
