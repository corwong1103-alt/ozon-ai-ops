"use client";

import { useEffect, useMemo, useState } from "react";
import { proxiedImageUrl } from "@/lib/proxied-image";

function imageSources(url: string) {
  const proxy = proxiedImageUrl(url);
  return [url, proxy].filter((item, index, list) => item && list.indexOf(item) === index);
}

export function ReliableProductImage({
  images,
  alt,
  className = "",
  emptyLabel = "无图",
  priority = false
}: {
  images: string[];
  alt: string;
  className?: string;
  emptyLabel?: string;
  priority?: boolean;
}) {
  const candidates = useMemo(() => images.filter(Boolean).flatMap(imageSources), [images]);
  const [index, setIndex] = useState(0);
  const image = candidates[index];
  const src = image || "";

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  if (!src) {
    return (
      <div className={`grid h-full w-full place-items-center bg-rail text-xs font-bold text-steel ${className}`}>
        {candidates.length ? "图片失效" : emptyLabel}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
