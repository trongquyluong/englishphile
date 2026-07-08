"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

// Logo asset is added separately; show a quiet placeholder so the page
// (and the build) keeps working while the file is missing.
const LOGO_SRC = "/images/brand/englishphile-logo.png";

export function EnglishphileLogo() {
  const [logoMissing, setLogoMissing] = useState(false);

  if (logoMissing) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-3xl border border-line bg-panel-muted p-6">
        <div className="grid justify-items-center gap-2 text-center text-ink-soft">
          <ImageOff className="size-8" aria-hidden="true" />
          <p className="text-sm leading-6">Logo Englishphile sẽ được cập nhật sau.</p>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={LOGO_SRC}
      alt="Logo Englishphile"
      width={400}
      height={400}
      className="aspect-square w-full rounded-3xl object-contain"
      onError={() => setLogoMissing(true)}
    />
  );
}
