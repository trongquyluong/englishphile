import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    writingQuotaReservation: {
      deleteMany: mocks.deleteMany,
    },
  },
}));

import {
  getWritingQuotaStatus,
  releaseProviderStartedWritingReservation,
  reserveWritingQuota,
} from "@/lib/security/writing-quota";

describe("provider-started Writing reservation release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("releases only the exact learner-owned PENDING provider-started row", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      releaseProviderStartedWritingReservation("reservation-1", "user-1"),
    ).resolves.toBe(true);

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "reservation-1",
        userId: "user-1",
        status: "PENDING",
        providerStartedAt: { not: null },
      },
    });
  });

  it("does not reopen a completed, foreign, or otherwise unmatched row", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      releaseProviderStartedWritingReservation("reservation-1", "user-1"),
    ).resolves.toBe(false);
  });

  it("fails conservatively and does not log a raw database error", async () => {
    const sentinel = "DATABASE-SENSITIVE-SENTINEL";
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deleteMany.mockRejectedValue(new Error(sentinel));

    await expect(
      releaseProviderStartedWritingReservation("reservation-1", "user-1"),
    ).resolves.toBe(false);

    expect(JSON.stringify(logger.mock.calls)).not.toContain(sentinel);
  });
});

describe("legacy FAILED Writing reservation reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports two remaining grades when both legacy rows are FAILED", async () => {
    mocks.queryRaw.mockResolvedValue([{ occupied: 0 }]);

    await expect(getWritingQuotaStatus("user-1")).resolves.toEqual({
      used: 0,
      remaining: 2,
      total: 2,
    });

    const sql = (mocks.queryRaw.mock.calls[0][0] as TemplateStringsArray).join(
      "?",
    );
    expect(sql).toContain(`"status" IN ('PENDING', 'COMPLETED')`);
    expect(sql).not.toContain(`"status" IN ('PENDING', 'COMPLETED', 'FAILED')`);
  });

  it("reports one remaining grade for one COMPLETED and one FAILED row", async () => {
    mocks.queryRaw.mockResolvedValue([{ occupied: 1 }]);

    await expect(getWritingQuotaStatus("user-1")).resolves.toEqual({
      used: 1,
      remaining: 1,
      total: 2,
    });
  });

  it("atomically recycles a conflicting FAILED slot for the Production-style INVALID_RESPONSE case", async () => {
    mocks.queryRaw.mockResolvedValue([{ id: "legacy-failed-reservation" }]);

    await expect(reserveWritingQuota("user-1")).resolves.toEqual({
      allowed: true,
      reservationId: "legacy-failed-reservation",
    });

    const sql = (mocks.queryRaw.mock.calls[0][0] as TemplateStringsArray).join(
      "?",
    );
    expect(sql).toContain(
      `ON CONFLICT ("userId", "quota_date", "slot_number") DO UPDATE`,
    );
    expect(sql).toContain(
      `WHERE "WritingQuotaReservation"."status" = 'FAILED'`,
    );
    expect(sql).toContain(`"status" = 'PENDING'`);
    expect(sql).toContain(`"provider_started_at" = NULL`);
    expect(sql).toContain(`"completed_at" = NULL`);
    expect(sql).toContain(`"failure_code" = NULL`);
    expect(sql).toContain(`"expires_at" = EXCLUDED."expires_at"`);
  });

  it("cannot recycle a conflicting PENDING or COMPLETED slot", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    await expect(reserveWritingQuota("user-1")).resolves.toEqual({
      allowed: false,
      reason: "quota-exceeded",
      remaining: 0,
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);

    for (const call of mocks.queryRaw.mock.calls) {
      const sql = (call[0] as TemplateStringsArray).join("?");
      expect(sql).toContain(
        `WHERE "WritingQuotaReservation"."status" = 'FAILED'`,
      );
      expect(sql).not.toMatch(
        /WHERE "WritingQuotaReservation"\."status" = '(?:PENDING|COMPLETED)'/,
      );
    }
  });
});
