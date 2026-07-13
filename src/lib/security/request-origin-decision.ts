export type OriginValidationResult =
  | { valid: true }
  | { valid: false; reason: "missing-origin" | "untrusted-origin" | "cross-site" | "malformed" };

export type RequestOriginHeaders = {
  origin: string | null;
  secFetchSite: string | null;
  secFetchMode: string | null;
};

export function validateOriginDecision(
  requestHeaders: RequestOriginHeaders,
  trustedOrigins: readonly string[],
): OriginValidationResult {
  const { origin, secFetchSite } = requestHeaders;

  if (origin !== null) {
    if (origin === "null") return { valid: false, reason: "malformed" };

    try {
      if (new URL(origin).origin !== origin) {
        return { valid: false, reason: "malformed" };
      }
    } catch {
      return { valid: false, reason: "malformed" };
    }

    return trustedOrigins.includes(origin)
      ? { valid: true }
      : { valid: false, reason: "untrusted-origin" };
  }

  if (secFetchSite === "same-origin") return { valid: true };
  if (secFetchSite === "cross-site") return { valid: false, reason: "cross-site" };

  return { valid: false, reason: "missing-origin" };
}
