import "server-only";

import { headers } from "next/headers";
import { getServerConfig } from "@/lib/config";
import {
  validateOriginDecision,
  type OriginValidationResult,
  type RequestOriginHeaders,
} from "@/lib/security/request-origin-decision";

export { validateOriginDecision } from "@/lib/security/request-origin-decision";
export type { OriginValidationResult } from "@/lib/security/request-origin-decision";

function normalizeHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getTrustedOrigins(): string[] {
  const config = getServerConfig();
  const origins = new Set<string>();

  if (config.appUrl) {
    const canonicalOrigin = normalizeHttpOrigin(config.appUrl);
    if (canonicalOrigin) origins.add(canonicalOrigin);
    else console.warn("[request-origin] NEXT_PUBLIC_APP_URL is not a valid HTTP(S) origin.");
  }

  const additionalOrigins = process.env.TRUSTED_ORIGINS;
  if (additionalOrigins) {
    for (const value of additionalOrigins.split(",")) {
      const origin = normalizeHttpOrigin(value.trim());
      if (origin) origins.add(origin);
      else if (value.trim()) console.warn("[request-origin] Ignored an invalid TRUSTED_ORIGINS entry.");
    }
  }

  if (process.env.VERCEL_URL) {
    const vercelOrigin = normalizeHttpOrigin(`https://${process.env.VERCEL_URL}`);
    if (vercelOrigin) origins.add(vercelOrigin);
  }

  return [...origins];
}

/**
 * Validate an unsafe Route Handler request.
 *
 * An exact trusted Origin is accepted. When Origin is absent, only
 * Sec-Fetch-Site: same-origin is independent same-origin proof. Cross-site
 * navigate requests and requests without either proof fail closed.
 */
export async function validateRequestOrigin(): Promise<OriginValidationResult> {
  const requestHeaders = await headers();
  const input: RequestOriginHeaders = {
    origin: requestHeaders.get("origin"),
    secFetchSite: requestHeaders.get("sec-fetch-site"),
    secFetchMode: requestHeaders.get("sec-fetch-mode"),
  };
  return validateOriginDecision(input, getTrustedOrigins());
}

export function getOriginErrorMessage(): string {
  return "Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.";
}
