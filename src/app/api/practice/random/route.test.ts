import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  validateRequestOrigin: vi.fn(),
  checkConfiguredRateLimit: vi.fn(),
  findQuestions: vi.fn(),
  createSubmission: vi.fn(),
  findProblemStatus: vi.fn(),
  upsertProblemStatus: vi.fn(),
  checkQuestionAnswer: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/security/request-origin", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  getOriginErrorMessage: () => "Nguồn yêu cầu không hợp lệ.",
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: mocks.checkConfiguredRateLimit,
  RATE_LIMITS: { RANDOM_PRACTICE: (userId: string) => ({ key: `random:${userId}` }) },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    question: { findMany: mocks.findQuestions },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/answer-checking", () => ({
  checkQuestionAnswer: mocks.checkQuestionAnswer,
  getSubmissionStatus: () => "WRONG_ANSWER",
  getProblemStatusFromSubmission: () => "ATTEMPTED",
}));

import { POST } from "@/app/api/practice/random/route";

describe("random-practice route Phase 1D-A runtime regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue({ valid: true });
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mocks.checkConfiguredRateLimit.mockResolvedValue({ status: "allowed" });
    mocks.findQuestions.mockResolvedValue([{
      id: "arbitrary-published-question",
      problemId: "problem-1",
      orderIndex: 0,
      contentStatus: "PUBLISHED",
    }]);
    mocks.checkQuestionAnswer.mockReturnValue({
      isCorrect: false,
      feedback: "H10_RANDOM_EXPLANATION_SENTINEL",
      correctAnswer: "H10_RANDOM_CANONICAL_SENTINEL",
    });
    mocks.createSubmission.mockResolvedValue({ id: "submission-1" });
    mocks.findProblemStatus.mockResolvedValue(null);
    mocks.upsertProblemStatus.mockResolvedValue({ id: "progress-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      submission: { create: mocks.createSubmission },
      userProblemStatus: { findUnique: mocks.findProblemStatus, upsert: mocks.upsertProblemStatus },
    }));
  });

  it("persists arbitrary published question ids but returns only safe result fields", async () => {
    const response = await POST(new Request("http://localhost/api/practice/random", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionIds: ["arbitrary-published-question"],
        answers: { "arbitrary-published-question": "guess" },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: "WRONG_ANSWER",
      score: 0,
      total: 1,
      answers: [{
        questionId: "arbitrary-published-question",
        isCorrect: false,
        feedback: "Chưa chính xác. Hãy xem lại kiến thức liên quan.",
      }],
    });
    expect(JSON.stringify(payload)).not.toContain("H10_RANDOM_CANONICAL_SENTINEL");
    expect(JSON.stringify(payload)).not.toContain("H10_RANDOM_EXPLANATION_SENTINEL");
    expect(mocks.createSubmission).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mode: "RANDOM_PRACTICE", userId: "user-1" }),
    }));
    expect(mocks.upsertProblemStatus).toHaveBeenCalled();
    const persisted = mocks.createSubmission.mock.calls[0][0].data;
    expect(persisted.answers).toEqual({ version: 1 });
    expect(persisted.submissionAnswers.create).toEqual([expect.objectContaining({ questionId: "arbitrary-published-question", studentAnswer: "guess" })]);
    expect(JSON.stringify(persisted)).not.toContain("H10_RANDOM_CANONICAL_SENTINEL");
    expect(JSON.stringify(persisted)).not.toContain("H10_RANDOM_EXPLANATION_SENTINEL");
  });

  it("rejects a mixed fetched/foreign set with zero writes", async () => {
    const response = await POST(new Request("http://localhost/api/practice/random", {
      method: "POST",
      body: JSON.stringify({ questionIds: ["arbitrary-published-question", "foreign"], answers: { "arbitrary-published-question": "ok", foreign: "no" } }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createSubmission).not.toHaveBeenCalled();
  });

  it("partitions answers into their actual problem submissions", async () => {
    mocks.findQuestions.mockResolvedValue([
      { id: "q1", problemId: "p1", orderIndex: 0, contentStatus: "PUBLISHED" },
      { id: "q2", problemId: "p2", orderIndex: 0, contentStatus: "PUBLISHED" },
    ]);
    const response = await POST(new Request("http://localhost/api/practice/random", {
      method: "POST",
      body: JSON.stringify({ questionIds: ["q1", "q2"], answers: { q1: "a1", q2: "a2" } }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.findQuestions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["q1", "q2"] },
        contentStatus: "PUBLISHED",
        problem: { contentStatus: "PUBLISHED" },
      }),
    }));
    expect(mocks.createSubmission).toHaveBeenCalledTimes(2);
    expect(mocks.createSubmission.mock.calls[0][0].data.submissionAnswers.create).toHaveLength(1);
    expect(mocks.createSubmission.mock.calls[1][0].data.submissionAnswers.create).toHaveLength(1);
    expect(mocks.createSubmission.mock.calls[0][0].data.answers).toEqual({ version: 1 });
  });

  it("simulates rollback of all problem groups when a later progress write fails", async () => {
    mocks.findQuestions.mockResolvedValue([
      { id: "q1", problemId: "p1", orderIndex: 0, contentStatus: "PUBLISHED" },
      { id: "q2", problemId: "p2", orderIndex: 0, contentStatus: "PUBLISHED" },
    ]);
    const pending: string[] = [];
    const committed: string[] = [];
    mocks.createSubmission.mockImplementation(async ({ data }) => {
      pending.push(`submission:${data.problemId}`);
      return { id: `submission:${data.problemId}` };
    });
    mocks.upsertProblemStatus
      .mockImplementationOnce(async () => { pending.push("progress:p1"); return { id: "progress:p1" }; })
      .mockImplementationOnce(async () => { throw new Error("later progress failure"); });
    mocks.transaction.mockImplementationOnce(async (callback) => {
      try {
        const result = await callback({
          submission: { create: mocks.createSubmission },
          userProblemStatus: { findUnique: mocks.findProblemStatus, upsert: mocks.upsertProblemStatus },
        });
        committed.push(...pending);
        return result;
      } catch (error) {
        pending.length = 0;
        throw error;
      }
    });

    await expect(POST(new Request("http://localhost/api/practice/random", {
      method: "POST",
      body: JSON.stringify({ questionIds: ["q1", "q2"], answers: { q1: "a1", q2: "a2" } }),
    }))).rejects.toThrow("later progress failure");
    expect(mocks.createSubmission).toHaveBeenCalledTimes(2);
    expect(committed).toEqual([]);
  });
});
