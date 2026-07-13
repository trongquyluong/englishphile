import "server-only";

import { cleanupExpiredAccessGrants } from "@/lib/security/access-grant";
import { createSecurityCleanupOrchestrator } from "@/lib/security/cleanup-core";
import { cleanupExpiredRateLimits } from "@/lib/security/rate-limit";
import { cleanupWritingReservations } from "@/lib/security/writing-quota";

const executeSecurityCleanup = createSecurityCleanupOrchestrator({
  rateLimits: cleanupExpiredRateLimits,
  accessGrants: cleanupExpiredAccessGrants,
  writingReservations: cleanupWritingReservations,
});

export function runSecurityCleanup() {
  return executeSecurityCleanup();
}
