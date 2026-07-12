export const WRITING_DAILY_LIMIT = 5;
export const WRITING_SLOT_NUMBERS = [1, 2, 3, 4, 5] as const;

export type WritingReservationResult =
  | { allowed: true; reservationId: string; remaining: number }
  | { allowed: false; reason: "quota-exceeded"; remaining: number }
  | { allowed: false; reason: "infrastructure-error"; retryAfterSeconds: number };

export type WritingSlotStore = {
  tryCreateSlot(input: {
    userId: string;
    quotaKey: string;
    slotNumber: number;
    expiresAt: Date;
  }): Promise<{ id: string } | null>;
};

type WritingQuotaLogger = Pick<Console, "error">;

const RESERVATION_TTL_MINUTES = 30;

export function getUtcQuotaKey(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error("INVALID_QUOTA_DATE");
  return now.toISOString().slice(0, 10);
}

export function createWritingQuotaReserver(
  store: WritingSlotStore,
  options: { now?: () => Date; logger?: WritingQuotaLogger } = {},
) {
  const nowFactory = options.now ?? (() => new Date());
  const logger = options.logger ?? console;

  return async function reserveWritingQuota(userId: string): Promise<WritingReservationResult> {
    const now = nowFactory();
    const quotaKey = getUtcQuotaKey(now);
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MINUTES * 60 * 1000);

    try {
      for (const slotNumber of WRITING_SLOT_NUMBERS) {
        const reservation = await store.tryCreateSlot({ userId, quotaKey, slotNumber, expiresAt });
        if (reservation === null) continue;

        return {
          allowed: true,
          reservationId: reservation.id,
          // Slots are attempted in order. A higher slot is reached only after
          // lower unique keys were occupied; this conservative snapshot avoids
          // a fallible read after the reservation has already committed.
          remaining: Math.max(0, WRITING_DAILY_LIMIT - slotNumber),
        };
      }

      return { allowed: false, reason: "quota-exceeded", remaining: 0 };
    } catch (error) {
      logger.error(
        "[writing-quota] Reservation infrastructure error:",
        error instanceof Error ? error.name : "unknown",
      );
      return { allowed: false, reason: "infrastructure-error", retryAfterSeconds: 30 };
    }
  };
}
