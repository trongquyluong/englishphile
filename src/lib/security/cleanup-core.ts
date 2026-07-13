import { createHash, timingSafeEqual } from "node:crypto";

export const CRON_SECRET_MIN_BYTES = 16;
export const CRON_SECRET_MAX_BYTES = 512;

const BEARER_PREFIX = "Bearer ";

export const SECURITY_CLEANUP_COMPONENTS = [
  "rateLimits",
  "accessGrants",
  "writingReservations",
] as const;

export type SecurityCleanupComponent = (typeof SECURITY_CLEANUP_COMPONENTS)[number];

export type CleanupOperationResult =
  | { status: "success"; affected: number }
  | { status: "infrastructure-error" };

export type CleanupOperation = () => Promise<CleanupOperationResult>;

export type SecurityCleanupDependencies = Record<SecurityCleanupComponent, CleanupOperation>;

export type SecurityCleanupResult = {
  status: "success" | "failure";
  counts: Record<SecurityCleanupComponent, number>;
  totalAffected: number;
  failedComponents: SecurityCleanupComponent[];
  durationMs: number;
};

function digestCredential(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function hasAllowedCredentialLength(value: string): boolean {
  if (value.length > CRON_SECRET_MAX_BYTES) return false;
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= CRON_SECRET_MIN_BYTES && bytes <= CRON_SECRET_MAX_BYTES;
}

/**
 * Verify the opaque, case-sensitive Vercel Cron bearer credential.
 * Neither configured nor presented values are trimmed or normalized. Both
 * values must stay within the explicit UTF-8 byte bounds before hashing.
 */
export function isCronRequestAuthorized(
  configuredSecret: string | null | undefined,
  authorizationHeader: string | null | undefined,
): boolean {
  if (!configuredSecret || !authorizationHeader?.startsWith(BEARER_PREFIX)) return false;
  if (authorizationHeader.length > BEARER_PREFIX.length + CRON_SECRET_MAX_BYTES) return false;
  if (!hasAllowedCredentialLength(configuredSecret)) return false;

  const presentedSecret = authorizationHeader.slice(BEARER_PREFIX.length);
  if (!hasAllowedCredentialLength(presentedSecret)) return false;

  const configuredDigest = digestCredential(configuredSecret);
  const presentedDigest = digestCredential(presentedSecret);
  return timingSafeEqual(configuredDigest, presentedDigest);
}

function isSuccessfulCount(result: CleanupOperationResult): result is Extract<CleanupOperationResult, { status: "success" }> {
  return result.status === "success" && Number.isSafeInteger(result.affected) && result.affected >= 0;
}

/**
 * Run every independent component once, sequentially. A failed component does
 * not prevent later components from reconciling, but any failure makes the
 * aggregate result fail. There are no retries and no process-local lock.
 */
export function createSecurityCleanupOrchestrator(
  dependencies: SecurityCleanupDependencies,
  options: { now?: () => number } = {},
) {
  const now = options.now ?? Date.now;

  return async function runSecurityCleanup(): Promise<SecurityCleanupResult> {
    const startedAt = now();
    const counts: Record<SecurityCleanupComponent, number> = {
      rateLimits: 0,
      accessGrants: 0,
      writingReservations: 0,
    };
    const failedComponents: SecurityCleanupComponent[] = [];

    for (const component of SECURITY_CLEANUP_COMPONENTS) {
      try {
        const result = await dependencies[component]();
        if (isSuccessfulCount(result)) counts[component] = result.affected;
        else failedComponents.push(component);
      } catch {
        failedComponents.push(component);
      }
    }

    return {
      status: failedComponents.length === 0 ? "success" : "failure",
      counts,
      totalAffected: Object.values(counts).reduce((total, count) => total + count, 0),
      failedComponents,
      durationMs: Math.max(0, now() - startedAt),
    };
  };
}
