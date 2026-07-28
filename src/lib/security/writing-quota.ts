import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createWritingQuotaReserver,
  getUtcQuotaKey,
  WRITING_DAILY_LIMIT,
  type WritingReservationResult,
  type WritingSlotStore,
} from "@/lib/security/writing-quota-core";
import type { CleanupOperationResult } from "@/lib/security/cleanup-core";

export type { WritingReservationResult as ReservationResult } from "@/lib/security/writing-quota-core";

const writingSlotStore: WritingSlotStore = {
  async tryCreateSlot({ userId, quotaKey, slotNumber, expiresAt }) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "WritingQuotaReservation" (
        "userId",
        "quota_date",
        "slot_number",
        "expires_at"
      )
      VALUES (${userId}, ${quotaKey}::date, ${slotNumber}, ${expiresAt})
      ON CONFLICT ("userId", "quota_date", "slot_number") DO UPDATE
      SET
        "status" = 'PENDING',
        "provider_started_at" = NULL,
        "completed_at" = NULL,
        "failure_code" = NULL,
        "expires_at" = EXCLUDED."expires_at"
      WHERE "WritingQuotaReservation"."status" = 'FAILED'
      RETURNING "id"
    `;
    return rows[0] ?? null;
  },
};

export const reserveWritingQuota: (userId: string) => Promise<WritingReservationResult> =
  createWritingQuotaReserver(writingSlotStore);

export async function markProviderStarted(reservationId: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.writingQuotaReservation.updateMany({
      where: {
        id: reservationId,
        userId,
        status: "PENDING",
        providerStartedAt: null,
      },
      data: { providerStartedAt: new Date() },
    });
    return result.count === 1;
  } catch {
    console.error("[writing-quota]", { event: "provider-start-persistence-failure" });
    return false;
  }
}

/**
 * Release only the exact provider-started reservation while it is still
 * PENDING. A successful submission changes the row to COMPLETED atomically
 * before this delete can match, so completed learner slots are never reopened.
 */
export async function releaseProviderStartedWritingReservation(
  reservationId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await prisma.writingQuotaReservation.deleteMany({
      where: {
        id: reservationId,
        userId,
        status: "PENDING",
        providerStartedAt: { not: null },
      },
    });
    return result.count === 1;
  } catch {
    console.error("[writing-quota]", { event: "provider-started-release-failure" });
    return false;
  }
}

export async function cancelWritingReservation(
  reservationId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await prisma.writingQuotaReservation.deleteMany({
      where: {
        id: reservationId,
        userId,
        status: "PENDING",
        providerStartedAt: null,
      },
    });
    return result.count === 1;
  } catch {
    console.error("[writing-quota]", { event: "unstarted-cancellation-failure" });
    return false;
  }
}

export type CompletedWritingSubmissionInput = {
  promptSlug: string;
  promptText: string;
  essayType: string;
  targetWordCount: string;
  essayText: string;
  resultJson: Prisma.InputJsonValue;
};

/**
 * Persist the successful submission and finalize its reservation atomically.
 * The provider call has already completed and is never inside this transaction.
 */
export async function persistCompletedWritingSubmission(
  reservationId: string,
  userId: string,
  submission: CompletedWritingSubmissionInput,
) {
  return prisma.$transaction(async (tx) => {
    const finalized = await tx.writingQuotaReservation.updateMany({
      where: {
        id: reservationId,
        userId,
        status: "PENDING",
        providerStartedAt: { not: null },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        failureCode: null,
      },
    });

    if (finalized.count !== 1) {
      throw new Error("WRITING_RESERVATION_NOT_FINALIZABLE");
    }

    return tx.writingSubmission.create({
      data: {
        userId,
        ...submission,
      },
    });
  });
}

export async function getWritingQuotaStatus(
  userId: string,
): Promise<{ remaining: number; total: number; used: number }> {
  const quotaKey = getUtcQuotaKey(new Date());
  const rows = await prisma.$queryRaw<Array<{ occupied: number }>>`
    SELECT COUNT(*)::int AS "occupied"
    FROM "WritingQuotaReservation"
    WHERE "userId" = ${userId}
      AND "quota_date" = ${quotaKey}::date
      AND "status" IN ('PENDING', 'COMPLETED')
  `;
  const occupied = rows[0]?.occupied ?? 0;

  return {
    remaining: Math.max(0, WRITING_DAILY_LIMIT - occupied),
    total: WRITING_DAILY_LIMIT,
    used: Math.min(occupied, WRITING_DAILY_LIMIT),
  };
}

const WRITING_QUOTA_CLEANUP_BATCH = 500;
const WRITING_ARCHIVE_DAYS = 7;

/**
 * Bounded maintenance operation for the external scheduler.
 *
 * - Only expired PENDING rows with provider_started_at IS NULL are reclaimed.
 * - Provider-started PENDING rows from an earlier quota day become FAILED.
 * - COMPLETED/FAILED rows are archived only after the quota day and retention
 *   window have both passed.
 */
export async function cleanupWritingReservations(): Promise<CleanupOperationResult> {
  const now = new Date();
  const quotaKey = getUtcQuotaKey(now);
  const archiveCutoff = new Date(now);
  archiveCutoff.setUTCDate(archiveCutoff.getUTCDate() - WRITING_ARCHIVE_DAYS);

  try {
    const affected = await prisma.$transaction(async (tx) => {
      const reclaimed = await tx.$executeRaw`
      DELETE FROM "WritingQuotaReservation"
      WHERE "id" IN (
        SELECT "id"
        FROM "WritingQuotaReservation"
        WHERE "status" = 'PENDING'
          AND "provider_started_at" IS NULL
          AND "expires_at" < ${now}
        ORDER BY "expires_at" ASC
        LIMIT ${WRITING_QUOTA_CLEANUP_BATCH}
      )
      AND "status" = 'PENDING'
      AND "provider_started_at" IS NULL
      AND "expires_at" < ${now}
    `;

      const reconciled = await tx.$executeRaw`
      UPDATE "WritingQuotaReservation"
      SET
        "status" = 'FAILED',
        "completed_at" = ${now},
        "failure_code" = 'STATE_UPDATE_INCOMPLETE'
      WHERE "id" IN (
        SELECT "id"
        FROM "WritingQuotaReservation"
        WHERE "status" = 'PENDING'
          AND "provider_started_at" IS NOT NULL
          AND "quota_date" < ${quotaKey}::date
          AND "expires_at" < ${now}
        ORDER BY "quota_date" ASC, "createdAt" ASC
        LIMIT ${WRITING_QUOTA_CLEANUP_BATCH}
      )
      AND "status" = 'PENDING'
      AND "provider_started_at" IS NOT NULL
      AND "quota_date" < ${quotaKey}::date
      AND "expires_at" < ${now}
    `;

      const archived = await tx.$executeRaw`
      DELETE FROM "WritingQuotaReservation"
      WHERE "id" IN (
        SELECT "id"
        FROM "WritingQuotaReservation"
        WHERE "status" IN ('COMPLETED', 'FAILED')
          AND "quota_date" < ${quotaKey}::date
          AND "createdAt" < ${archiveCutoff}
        ORDER BY "createdAt" ASC
        LIMIT ${WRITING_QUOTA_CLEANUP_BATCH}
      )
      AND "status" IN ('COMPLETED', 'FAILED')
      AND "quota_date" < ${quotaKey}::date
      AND "createdAt" < ${archiveCutoff}
    `;

      return Number(reclaimed) + Number(reconciled) + Number(archived);
    });
    return { status: "success", affected };
  } catch {
    return { status: "infrastructure-error" };
  }
}
