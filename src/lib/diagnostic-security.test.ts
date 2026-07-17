import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  diagnosticAttemptFindFirst: vi.fn(),
  diagnosticAttemptUpdateMany: vi.fn(),
  questionFindMany: vi.fn(),
  skillProfileUpsert: vi.fn(),
  topicProfileUpsert: vi.fn(),
  recommendationUpdateMany: vi.fn(),
  recommendationCreate: vi.fn(),
  statusFindMany: vi.fn(),
  problemFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    diagnosticAttempt: { findFirst: mocks.diagnosticAttemptFindFirst },
    question: { findMany: mocks.questionFindMany },
  },
}));

import {
  DIAGNOSTIC_UNAVAILABLE_MESSAGE,
  getDiagnosticQuestionsForAttempt,
  getLatestFinishedDiagnosticAttempt,
  getLearnerDiagnosticResult,
  scoreDiagnosticAttempt,
} from "@/lib/diagnostic";

const ANSWER_SENTINEL = "H10_DIAGNOSTIC_CANONICAL_3j8n";
const EXPLANATION_SENTINEL = "H10_DIAGNOSTIC_EXPLANATION_6r5w";
const now = new Date("2026-07-17T01:00:00Z");

const transactionClient = {
  diagnosticAttempt: { updateMany: mocks.diagnosticAttemptUpdateMany },
  userSkillProfile: { upsert: mocks.skillProfileUpsert },
  userTopicProfile: { upsert: mocks.topicProfileUpsert },
  learningRecommendation: {
    updateMany: mocks.recommendationUpdateMany,
    create: mocks.recommendationCreate,
  },
  userProblemStatus: { findMany: mocks.statusFindMany },
  problem: { findFirst: mocks.problemFindFirst },
};

function attemptSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-own-completed",
    status: "COMPLETED",
    startedAt: now,
    completedAt: now,
    score: 1,
    total: 1,
    estimatedLevel: "C1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resultAttempt(overrides: Record<string, unknown> = {}) {
  return {
    ...attemptSummary(),
    userId: "learner-1",
    skillBreakdownJson: [],
    topicBreakdownJson: [],
    recommendationJson: {
      correctAnswer: ANSWER_SENTINEL,
      feedback: EXPLANATION_SENTINEL,
      scoring: {
        weightedAccuracy: 1,
        rawCorrect: 1,
        rawAttempted: 1,
        confidence: "LOW",
        confidenceLabel: "Thấp",
        confidenceReason: "Sparse data",
        strengths: [],
        weakAreas: [],
        levelExplanation: "Aggregate-only explanation",
      },
    },
    ...overrides,
  };
}

describe("diagnostic presentation and result Phase 1D-A runtime regressions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns learner-safe presentation DTOs even when mocks over-return legacy fields", async () => {
    mocks.diagnosticAttemptFindFirst.mockResolvedValue({
      ...attemptSummary({ id: "attempt-1", status: "IN_PROGRESS", completedAt: null, score: null, total: null }),
      recommendationJson: {
        questionIds: ["q1"],
        results: [{ correctAnswer: ANSWER_SENTINEL, feedback: EXPLANATION_SENTINEL }],
      },
    });
    mocks.questionFindMany.mockResolvedValue([{
      id: "q1",
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      prompt: "Prompt",
      passage: null,
      options: [{ id: "A", text: "Choice", correctAnswer: ANSWER_SENTINEL }],
      answer: { correctOptionId: "A", sentinel: ANSWER_SENTINEL },
      explanation: EXPLANATION_SENTINEL,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: { transcript: ANSWER_SENTINEL },
      orderIndex: 0,
      problem: { title: "Problem" },
    }]);

    const data = await getDiagnosticQuestionsForAttempt("attempt-1", "learner-1");

    expect(data?.questions[0]?.options).toEqual([{ id: "A", text: "Choice" }]);
    expect(data?.questions[0]?.problemTitle).toBe("Problem");
    expect(JSON.stringify(data)).not.toContain(ANSWER_SENTINEL);
    expect(JSON.stringify(data)).not.toContain(EXPLANATION_SENTINEL);
    expect(mocks.diagnosticAttemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "attempt-1", userId: "learner-1" },
    }));
  });

  it("accepts an owned finalized result and ignores sensitive historical JSON", async () => {
    mocks.diagnosticAttemptFindFirst.mockResolvedValue(resultAttempt());

    const result = await getLearnerDiagnosticResult("attempt-own-completed", "learner-1");

    expect(result?.id).toBe("attempt-own-completed");
    expect(result?.status).toBe("COMPLETED");
    expect(JSON.stringify(result)).not.toContain(ANSWER_SENTINEL);
    expect(JSON.stringify(result)).not.toContain(EXPLANATION_SENTINEL);
    expect(result).not.toHaveProperty("recommendationJson");
    expect(mocks.diagnosticAttemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "attempt-own-completed",
        userId: "learner-1",
        status: { in: ["COMPLETED", "NEEDS_REVIEW"] },
        completedAt: { not: null },
      }),
    }));
  });

  it("treats latest finished as both finalized and completion-stamped", async () => {
    mocks.diagnosticAttemptFindFirst.mockResolvedValue(attemptSummary());

    const result = await getLatestFinishedDiagnosticAttempt("learner-1");

    expect(result?.id).toBe("attempt-own-completed");
    expect(mocks.diagnosticAttemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "learner-1",
        status: { in: ["COMPLETED", "NEEDS_REVIEW"] },
        completedAt: { not: null },
      },
    }));
  });

  it.each([
    ["missing", "missing", "learner-1"],
    ["foreign", "attempt-foreign", "learner-1"],
    ["incomplete", "attempt-in-progress", "learner-1"],
    ["abandoned", "attempt-abandoned", "learner-1"],
    ["stale/disallowed", "attempt-stale", "learner-1"],
    ["arbitrary principal ID A", "attempt-foreign", "principal-a"],
    ["arbitrary principal ID B", "attempt-foreign", "principal-b"],
  ])("returns the same unavailable result for %s lookup", async (_case, attemptId, userId) => {
    const records = [
      resultAttempt({ id: "attempt-foreign", userId: "learner-2" }),
      resultAttempt({ id: "attempt-in-progress", status: "IN_PROGRESS", completedAt: null }),
      resultAttempt({ id: "attempt-abandoned", status: "ABANDONED", completedAt: now }),
      resultAttempt({ id: "attempt-stale", completedAt: null }),
    ];
    mocks.diagnosticAttemptFindFirst.mockImplementation(async ({ where }: {
      where: {
        id?: string;
        userId: string;
        status: { in: string[] };
        completedAt: { not: null };
      };
    }) => records.find((record) =>
      record.id === where.id &&
      record.userId === where.userId &&
      where.status.in.includes(String(record.status)) &&
      record.completedAt !== null,
    ) ?? null);

    await expect(getLearnerDiagnosticResult(attemptId, userId)).resolves.toBeNull();
  });
});

describe("diagnostic scoring Phase 1D-A runtime regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient));
    mocks.diagnosticAttemptFindFirst.mockResolvedValue({
      id: "attempt-1",
      status: "IN_PROGRESS",
      recommendationJson: {
        questionIds: ["q1"],
        sections: [],
        coverageWarnings: [],
        results: [{ correctAnswer: ANSWER_SENTINEL, feedback: EXPLANATION_SENTINEL }],
      },
    });
    mocks.questionFindMany.mockResolvedValue([{
      id: "q1",
      problemId: "p1",
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      answer: { correctOptionId: "A", display: ANSWER_SENTINEL },
      explanation: EXPLANATION_SENTINEL,
      problem: { diagnosticWeight: 1, problemTopics: [] },
    }]);
    mocks.diagnosticAttemptUpdateMany.mockResolvedValue({ count: 1 });
    mocks.skillProfileUpsert.mockResolvedValue({});
    mocks.topicProfileUpsert.mockResolvedValue({});
    mocks.recommendationUpdateMany.mockResolvedValue({ count: 0 });
    mocks.recommendationCreate.mockResolvedValue({});
    mocks.statusFindMany.mockResolvedValue([]);
    mocks.problemFindFirst.mockResolvedValue(null);
  });

  it("scores canonically on the server, returns void, and persists no answer material", async () => {
    const result = await scoreDiagnosticAttempt("attempt-1", "learner-1", { q1: "A" });

    expect(result).toBeUndefined();
    const update = mocks.diagnosticAttemptUpdateMany.mock.calls[0]?.[0];
    expect(update.where).toEqual({ id: "attempt-1", userId: "learner-1", status: "IN_PROGRESS" });
    expect(update.data.status).toBe("COMPLETED");
    expect(update.data.score).toBe(1.1);
    expect(update.data.total).toBe(1.1);
    expect(update.data.recommendationJson.results).toEqual([{
      questionId: "q1",
      problemId: "p1",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      isCorrect: true,
    }]);
    expect(JSON.stringify(update.data.recommendationJson)).not.toContain(ANSWER_SENTINEL);
    expect(JSON.stringify(update.data.recommendationJson)).not.toContain(EXPLANATION_SENTINEL);
    expect(update.data.recommendationJson).not.toHaveProperty("feedback");
  });

  it("blocks finalized replay through the conditional IN_PROGRESS claim", async () => {
    mocks.diagnosticAttemptUpdateMany.mockResolvedValue({ count: 0 });

    await expect(scoreDiagnosticAttempt("attempt-1", "learner-1", { q1: "A" }))
      .rejects.toThrow(DIAGNOSTIC_UNAVAILABLE_MESSAGE);
    expect(mocks.skillProfileUpsert).not.toHaveBeenCalled();
  });

  it("uses a generic unavailable error for missing, foreign, or non-current attempts", async () => {
    mocks.diagnosticAttemptFindFirst.mockResolvedValue(null);

    await expect(scoreDiagnosticAttempt("opaque-id", "learner-1", { q1: "A" }))
      .rejects.toThrow(DIAGNOSTIC_UNAVAILABLE_MESSAGE);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
