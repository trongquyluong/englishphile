import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  problemGroupBy: vi.fn(),
  questionFindMany: vi.fn(),
  contestAttemptFindFirst: vi.fn(),
  contestAttemptCreate: vi.fn(),
  diagnosticAttemptFindFirst: vi.fn(),
  diagnosticAttemptCreate: vi.fn(),
  writingReservationUpdateMany: vi.fn(),
  writingSubmissionCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    problem: { groupBy: mocks.problemGroupBy },
    question: { findMany: mocks.questionFindMany },
  },
}));

import { createContestAttempt } from "@/lib/contests";
import { createDiagnosticAttempt } from "@/lib/diagnostic";
import { persistCompletedWritingSubmission } from "@/lib/security/writing-quota";

const transactionClient = {
  $queryRaw: mocks.queryRaw,
  contestAccessGrant: { findUnique: vi.fn() },
  contestAttempt: {
    findFirst: mocks.contestAttemptFindFirst,
    create: mocks.contestAttemptCreate,
  },
  diagnosticAttempt: {
    findFirst: mocks.diagnosticAttemptFindFirst,
    create: mocks.diagnosticAttemptCreate,
  },
  writingQuotaReservation: { updateMany: mocks.writingReservationUpdateMany },
  writingSubmission: { create: mocks.writingSubmissionCreate },
};

describe("Phase 1C-A core persistence runtime regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
  });

  it("still creates a contest attempt through the production transaction", async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([{ locked: "1" }])
      .mockResolvedValueOnce([
        {
          id: "contest-1",
          contestType: "PRACTICE_CONTEST",
          status: "LIVE",
          startsAt: null,
          endsAt: null,
          visibility: "PUBLIC",
          accessCodeUpdatedAt: null,
        },
      ])
      .mockResolvedValueOnce([{ id: "contest-problem-1" }])
      .mockResolvedValueOnce([]);
    mocks.contestAttemptFindFirst.mockResolvedValue(null);
    mocks.contestAttemptCreate.mockResolvedValue({ id: "contest-attempt-1" });

    const result = await createContestAttempt({ id: "contest-1" }, "user-1");

    expect(result).toEqual({ ok: true, attempt: { id: "contest-attempt-1" } });
    expect(mocks.contestAttemptCreate).toHaveBeenCalledWith({
      data: { contestId: "contest-1", userId: "user-1", status: "IN_PROGRESS" },
    });
  });

  it("still creates a diagnostic attempt through the production transaction", async () => {
    mocks.problemGroupBy.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([{ locked: "1" }]);
    mocks.diagnosticAttemptFindFirst.mockResolvedValue(null);
    const createdAt = new Date("2026-07-17T00:00:00Z");
    mocks.diagnosticAttemptCreate.mockResolvedValue({
      id: "diagnostic-attempt-1",
      status: "IN_PROGRESS",
      startedAt: createdAt,
      completedAt: null,
      score: null,
      total: null,
      estimatedLevel: null,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await createDiagnosticAttempt("user-1");

    expect(result).toEqual(expect.objectContaining({ id: "diagnostic-attempt-1", status: "IN_PROGRESS" }));
    expect(mocks.diagnosticAttemptCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        status: "IN_PROGRESS",
        recommendationJson: expect.objectContaining({ questionIds: [] }),
      }),
      select: expect.objectContaining({ id: true, status: true }),
    }));
  });

  it("still finalizes a Writing reservation and persists the submission atomically", async () => {
    mocks.writingReservationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.writingSubmissionCreate.mockResolvedValue({ id: "writing-submission-1" });
    const submission = {
      promptSlug: "prompt",
      promptText: "Prompt",
      essayType: "argumentative",
      targetWordCount: "250",
      essayText: "Essay",
      resultJson: { score: 7 },
    };

    const result = await persistCompletedWritingSubmission(
      "reservation-1",
      "user-1",
      submission,
    );

    expect(result).toEqual({ id: "writing-submission-1" });
    expect(mocks.writingReservationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "reservation-1", userId: "user-1" }),
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(mocks.writingSubmissionCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", ...submission },
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
