import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: database.transaction } }));

import { createContest, validateLegacyContestSchedule } from "@/lib/contests";

const now = new Date("2026-07-14T00:00:00.000Z");

describe("legacy contest schedule policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["DRAFT", "ARCHIVED", "ENDED"] as const)("preserves editable %s records without active-schedule enforcement", (status) => {
    expect(validateLegacyContestSchedule({
      status,
      durationMinutes: 0,
      startsAt: new Date("2026-07-13T02:00:00.000Z"),
      endsAt: new Date("2026-07-13T01:00:00.000Z"),
    }, now)).toEqual({ ok: true });
  });

  it("accepts a future SCHEDULED contest", () => {
    expect(validateLegacyContestSchedule({
      status: "SCHEDULED",
      durationMinutes: 60,
      startsAt: new Date("2026-07-15T00:00:00.000Z"),
      endsAt: new Date("2026-07-15T01:00:00.000Z"),
    }, now)).toEqual({ ok: true });
  });

  it("accepts a currently LIVE contest", () => {
    expect(validateLegacyContestSchedule({
      status: "LIVE",
      durationMinutes: 60,
      startsAt: new Date("2026-07-13T23:30:00.000Z"),
      endsAt: new Date("2026-07-14T00:30:00.000Z"),
    }, now)).toEqual({ ok: true });
  });

  it.each([
    ["invalid duration", { status: "LIVE" as const, durationMinutes: 0 }],
    ["reversed times", { status: "LIVE" as const, startsAt: new Date("2026-07-14T01:00:00.000Z"), endsAt: new Date("2026-07-14T00:30:00.000Z") }],
    ["ended active content", { status: "LIVE" as const, endsAt: new Date("2026-07-13T23:59:00.000Z") }],
    ["scheduled content without a future start", { status: "SCHEDULED" as const, startsAt: now }],
  ])("returns a typed validation result for %s", (_label, input) => {
    const result = validateLegacyContestSchedule(input, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain("không tồn tại");
  });

  it("rejects malformed active schedule before opening a mutation transaction", async () => {
    const result = await createContest({
      title: "Contest",
      contestType: "PRACTICE_CONTEST",
      status: "SCHEDULED",
      visibility: "PUBLIC",
      startsAt: now,
      problems: [{ problemId: "problem-a", section: "Reading", orderIndex: 0 }],
    }, "admin-a");
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: "validation" }));
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
