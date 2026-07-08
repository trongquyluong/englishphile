"use client";

import Image from "next/image";
import { useState } from "react";
import { BookOpenCheck } from "lucide-react";

// Logo asset is added separately; fall back to the icon mark so the UI
// keeps working (and the build never breaks) while the file is missing.
const BRAND_LOGO_SRC = "/images/brand/englishphile-logo.png";

export function BrandMark() {
  const [logoMissing, setLogoMissing] = useState(false);

  if (logoMissing) {
    return (
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent">
        <BookOpenCheck className="size-5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt=""
      width={36}
      height={36}
      className="size-9 rounded-xl object-cover"
      onError={() => setLogoMissing(true)}
    />
  );
}
