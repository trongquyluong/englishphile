import "server-only";

import { prisma } from "@/lib/prisma";
import {
  createDbRateLimitChecker,
  hashRateLimitSubject,
  type RateLimitAuthorizationStore,
  type RateLimitPolicy,
  type RateLimitResult,
} from "@/lib/security/rate-limit-core";
import type { CleanupOperationResult } from "@/lib/security/cleanup-core";

export type { RateLimitPolicy, RateLimitResult } from "@/lib/security/rate-limit-core";

/**
 * One PostgreSQL statement is the complete authorization decision.
 *
 * - Missing bucket: INSERT count=1.
 * - Active bucket below limit: conflict UPDATE increments count.
 * - Expired bucket: conflict UPDATE resets count=1 and starts a new window.
 * - Active bucket at limit: conflict UPDATE's WHERE predicate is false, so
 *   RETURNING yields no row and the request is denied.
 *
 * PostgreSQL locks the conflicting row and re-evaluates the predicate after a
 * concurrent writer commits. Therefore two concurrent expired-window requests
 * become counts 1 and 2 rather than two independent resets.
 */
const postgresAuthorizationStore: RateLimitAuthorizationStore = {
  async authorize({ action, subject, limit, now, expiresAt }) {
    const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
      INSERT INTO "RateLimitBucket" (
        "action",
        "subject",
        "count",
        "windowStart",
        "expiresAt"
      )
      VALUES (${action}, ${subject}, 1, ${now}, ${expiresAt})
      ON CONFLICT ("action", "subject") DO UPDATE
      SET
        "count" = CASE
          WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now}
          ELSE "RateLimitBucket"."windowStart"
        END,
        "expiresAt" = CASE
          WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt}
          ELSE "RateLimitBucket"."expiresAt"
        END
      WHERE
        "RateLimitBucket"."expiresAt" <= ${now}
        OR "RateLimitBucket"."count" < ${limit}
      RETURNING "count", "expiresAt"
    `;

    return rows[0] ?? null;
  },
};

export const checkDbRateLimit = createDbRateLimitChecker(postgresAuthorizationStore);

export type ConfiguredRateLimit = {
  action: string;
  subject: string;
  policy: RateLimitPolicy;
};

export function checkConfiguredRateLimit(config: ConfiguredRateLimit): Promise<RateLimitResult> {
  return checkDbRateLimit(config.action, config.subject, config.policy);
}

export const RATE_LIMITS = {
  SIGN_IN: (email: string): ConfiguredRateLimit => ({
    action: "sign-in",
    subject: hashRateLimitSubject(email),
    policy: { limit: 10, windowSeconds: 15 * 60 },
  }),
  SIGN_UP: (email: string): ConfiguredRateLimit => ({
    action: "sign-up",
    subject: hashRateLimitSubject(email),
    policy: { limit: 5, windowSeconds: 60 * 60 },
  }),
  CONTEST_ACCESS_CODE: (userId: string): ConfiguredRateLimit => ({
    action: "contest-access",
    subject: userId,
    policy: { limit: 5, windowSeconds: 15 * 60 },
  }),
  CONTEST_START: (contestId: string, userId: string): ConfiguredRateLimit => ({
    action: "contest-start",
    subject: `${contestId}:${userId}`,
    policy: { limit: 6, windowSeconds: 10 * 60 },
  }),
  CONTEST_SUBMIT: (contestId: string, userId: string): ConfiguredRateLimit => ({
    action: "contest-submit",
    subject: `${contestId}:${userId}`,
    policy: { limit: 8, windowSeconds: 10 * 60 },
  }),
  DIAGNOSTIC_START: (userId: string): ConfiguredRateLimit => ({
    action: "diagnostic-start",
    subject: userId,
    policy: { limit: 6, windowSeconds: 10 * 60 },
  }),
  DIAGNOSTIC_SUBMIT: (userId: string): ConfiguredRateLimit => ({
    action: "diagnostic-submit",
    subject: userId,
    policy: { limit: 8, windowSeconds: 10 * 60 },
  }),
  WRITING_GRADE: (userId: string): ConfiguredRateLimit => ({
    action: "writing-grade",
    subject: userId,
    policy: { limit: 6, windowSeconds: 10 * 60 },
  }),
  WRITING_GRADE_GLOBAL: {
    action: "writing-grade-global",
    subject: "global",
    policy: { limit: 60, windowSeconds: 10 * 60 },
  } satisfies ConfiguredRateLimit,
  EXCEL_PARSE: (adminId: string): ConfiguredRateLimit => ({
    action: "excel-parse",
    subject: adminId,
    policy: { limit: 10, windowSeconds: 60 * 60 },
  }),
  CONTENT_PACK_COMMIT: (adminId: string): ConfiguredRateLimit => ({
    action: "content-pack-commit",
    subject: adminId,
    policy: { limit: 5, windowSeconds: 60 * 60 },
  }),
  IMPORT_VALIDATE: (adminId: string): ConfiguredRateLimit => ({
    action: "import-validate",
    subject: adminId,
    policy: { limit: 30, windowSeconds: 10 * 60 },
  }),
  IMPORT_COMMIT: (adminId: string): ConfiguredRateLimit => ({
    action: "import-commit",
    subject: adminId,
    policy: { limit: 12, windowSeconds: 10 * 60 },
  }),
  CONTENT_PACK_VALIDATE: (adminId: string): ConfiguredRateLimit => ({
    action: "content-pack-validate",
    subject: adminId,
    policy: { limit: 30, windowSeconds: 10 * 60 },
  }),
  SUBMISSION: (userId: string): ConfiguredRateLimit => ({
    action: "submission",
    subject: userId,
    policy: { limit: 30, windowSeconds: 60 },
  }),
  RANDOM_PRACTICE: (userId: string): ConfiguredRateLimit => ({
    action: "random-practice",
    subject: userId,
    policy: { limit: 60, windowSeconds: 60 },
  }),
  ASSIGNMENT_SUBMIT: (userId: string): ConfiguredRateLimit => ({
    action: "assignment-submit",
    subject: userId,
    policy: { limit: 12, windowSeconds: 60 },
  }),
} as const;

const RATE_LIMIT_CLEANUP_BATCH = 500;

/**
 * Bounded cleanup operation for the external scheduler.
 */
export async function cleanupExpiredRateLimits(): Promise<CleanupOperationResult> {
  const cutoff = new Date();

  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "RateLimitBucket"
      WHERE "id" IN (
        SELECT "id"
        FROM "RateLimitBucket"
        WHERE "expiresAt" < ${cutoff}
        ORDER BY "expiresAt" ASC
        LIMIT ${RATE_LIMIT_CLEANUP_BATCH}
      )
      AND "expiresAt" < ${cutoff}
    `;
    return { status: "success", affected: Number(deleted) };
  } catch {
    return { status: "infrastructure-error" };
  }
}
