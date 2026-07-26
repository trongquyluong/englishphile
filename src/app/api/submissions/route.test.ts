import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  validateRequestOrigin: vi.fn(),
  checkConfiguredRateLimit: vi.fn(),
  findQuestions: vi.fn(),
  createSubmission: vi.fn(),
  findProblemStatus: vi.fn(),
  upsertProblemStatus: vi.fn(),
  completeRecommendations: vi.fn(),
  checkQuestionAnswer: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/security/request-origin", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  getOriginErrorMessage: () => "Nguồn yêu cầu không hợp lệ.",
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: mocks.checkConfiguredRateLimit,
  RATE_LIMITS: { SUBMISSION: (userId: string) => ({ key: `submission:${userId}` }) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    question: { findMany: mocks.findQuestions },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/recommendations", () => ({
  markRecommendationsCompletedForProblem: mocks.completeRecommendations,
}));

vi.mock("@/lib/answer-checking", () => ({
  checkQuestionAnswer: mocks.checkQuestionAnswer,
  getSubmissionStatus: () => "ACCEPTED",
  getProblemStatusFromSubmission: () => "SOLVED",
}));

import { POST } from "@/app/api/submissions/route";
import { PRACTICE_INPUT_LIMITS } from "@/lib/security/submission-input";

describe("independent-practice submission route runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue({ valid: true });
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "student@example.test",
      role: "STUDENT",
    });
    mocks.checkConfiguredRateLimit.mockResolvedValue({ status: "allowed" });
    mocks.findQuestions.mockResolvedValue([
      { id: "question-1", orderIndex: 0, contentStatus: "PUBLISHED" },
    ]);
    mocks.checkQuestionAnswer.mockReturnValue({
      isCorrect: true,
      feedback: "H10_EXPLANATION_SENTINEL",
      correctAnswer: "H10_CANONICAL_SENTINEL",
    });
    mocks.createSubmission.mockResolvedValue({ id: "submission-1" });
    mocks.findProblemStatus.mockResolvedValue(null);
    mocks.upsertProblemStatus.mockResolvedValue({ id: "progress-1" });
    mocks.completeRecommendations.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback({
      submission: { create: mocks.createSubmission },
      userProblemStatus: { findUnique: mocks.findProblemStatus, upsert: mocks.upsertProblemStatus },
      learningRecommendation: { updateMany: vi.fn() },
    }));
  });

  it("persists a normal single-problem submission and learner progress", async () => {
    const response = await POST(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          problemId: "problem-1",
          answers: { "question-1": "answer" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findQuestions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        problemId: "problem-1",
        contentStatus: "PUBLISHED",
        problem: { contentStatus: "PUBLISHED" },
      }),
    }));
    expect(mocks.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          problemId: "problem-1",
          mode: "SINGLE_PROBLEM",
          submissionAnswers: expect.objectContaining({ create: expect.any(Array) }),
        }),
      }),
    );
    expect(mocks.upsertProblemStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "SOLVED", attempts: 1 }),
      }),
    );
    expect(mocks.completeRecommendations).toHaveBeenCalledWith("user-1", "problem-1", expect.any(Object));
    const persisted = mocks.createSubmission.mock.calls[0][0].data;
    expect(persisted.answers).toEqual({ version: 1 });
    expect(persisted.submissionAnswers.create[0]).toEqual(expect.objectContaining({ questionId: "question-1", studentAnswer: "answer", feedback: "Chính xác." }));
    expect(JSON.stringify(persisted)).not.toContain("H10_CANONICAL_SENTINEL");
    expect(JSON.stringify(persisted)).not.toContain("H10_EXPLANATION_SENTINEL");
    const payload = await response.json();
    expect(payload).toEqual({
      submissionId: "submission-1",
      status: "ACCEPTED",
      score: 1,
      total: 1,
      answers: [{ questionId: "question-1", isCorrect: true, feedback: "Chính xác." }],
    });
    expect(JSON.stringify(payload)).not.toContain("H10_CANONICAL_SENTINEL");
    expect(JSON.stringify(payload)).not.toContain("H10_EXPLANATION_SENTINEL");
  });

  it("rejects foreign answer IDs before opening a write transaction", async () => {
    const response = await POST(new Request("http://localhost/api/submissions", {
      method: "POST",
      body: JSON.stringify({ problemId: "problem-1", answers: { "question-1": "ok", foreign: "no" } }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("foreign");
  });

  it("stops an oversized streamed body with zero repository writes", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(PRACTICE_INPUT_LIMITS.maxBodyBytes));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/submissions", {
      method: "POST",
      headers: { "content-length": "1" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mocks.findQuestions).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createSubmission).not.toHaveBeenCalled();
  });

  it("surfaces a transaction failure without a separately committed submission", async () => {
    const pending: string[] = [];
    const committed: string[] = [];
    mocks.createSubmission.mockImplementationOnce(async () => {
      pending.push("submission-1");
      return { id: "submission-1" };
    });
    mocks.upsertProblemStatus.mockImplementationOnce(async () => {
      pending.push("progress-1");
      return { id: "progress-1" };
    });
    mocks.completeRecommendations.mockImplementationOnce(async () => {
      pending.push("recommendation-1");
      throw new Error("later recommendation failure");
    });
    mocks.transaction.mockImplementationOnce(async (callback) => {
      try {
        const result = await callback({
          submission: { create: mocks.createSubmission },
          userProblemStatus: { findUnique: mocks.findProblemStatus, upsert: mocks.upsertProblemStatus },
          learningRecommendation: { updateMany: vi.fn() },
        });
        committed.push(...pending);
        return result;
      } catch (error) {
        pending.length = 0;
        throw error;
      }
    });
    await expect(POST(new Request("http://localhost/api/submissions", {
      method: "POST",
      body: JSON.stringify({ problemId: "problem-1", answers: { "question-1": "answer" } }),
    }))).rejects.toThrow("later recommendation failure");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.upsertProblemStatus).toHaveBeenCalledTimes(1);
    expect(mocks.completeRecommendations).toHaveBeenCalledTimes(1);
    expect(committed).toEqual([]);
  });

  it("does not reveal answer sentinels for an arbitrary published problem id", async () => {
    mocks.checkQuestionAnswer.mockReturnValue({
      isCorrect: false,
      feedback: "H10_EXPLANATION_SENTINEL",
      correctAnswer: "H10_CANONICAL_SENTINEL",
    });

    const response = await POST(new Request("http://localhost/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        problemId: "arbitrary-published-problem",
        answers: { "question-1": "guess" },
      }),
    }));
    const payload = await response.json();

    expect(payload.answers).toEqual([{
      questionId: "question-1",
      isCorrect: false,
      feedback: "Chưa chính xác. Hãy xem lại kiến thức liên quan.",
    }]);
    expect(JSON.stringify(payload)).not.toContain("H10_CANONICAL_SENTINEL");
    expect(JSON.stringify(payload)).not.toContain("H10_EXPLANATION_SENTINEL");
  });
});
