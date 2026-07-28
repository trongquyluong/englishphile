export const WRITING_DAILY_LIMIT = 2;
export const WRITING_SLOT_NUMBERS = [1, 2] as const;

export type WritingReservationResult =
  | { allowed: true; reservationId: string }
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
        };
      }

      return { allowed: false, reason: "quota-exceeded", remaining: 0 };
    } catch {
      logger.error("[writing-quota]", { event: "reservation-infrastructure-failure" });
      return { allowed: false, reason: "infrastructure-error", retryAfterSeconds: 30 };
    }
  };
}
