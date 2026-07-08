"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

// Founder photo is added separately; show a quiet placeholder so the page
// (and the build) keeps working while the file is missing.
const FOUNDER_PHOTO_SRC = "/images/about/founder.jpg";

export function FounderPortrait() {
  const [photoMissing, setPhotoMissing] = useState(false);

  if (photoMissing) {
    return (
      <div className="grid aspect-[4/5] w-full place-items-center rounded-3xl border border-line bg-panel-muted p-6">
        <div className="grid justify-items-center gap-2 text-center text-ink-soft">
          <ImageOff className="size-6" aria-hidden="true" />
          <p className="text-sm leading-6">Ảnh founder sẽ được cập nhật sau.</p>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={FOUNDER_PHOTO_SRC}
      alt="Lương Trọng Quý, người sáng lập Englishphile"
      width={640}
      height={800}
      className="aspect-[4/5] w-full rounded-3xl object-cover"
      onError={() => setPhotoMissing(true)}
    />
  );
}
