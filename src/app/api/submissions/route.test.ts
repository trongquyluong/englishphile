import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isContentAdminUser: vi.fn(),
  validateRequestOrigin: vi.fn(),
  checkConfiguredRateLimit: vi.fn(),
  findQuestions: vi.fn(),
  createSubmission: vi.fn(),
  findProblemStatus: vi.fn(),
  upsertProblemStatus: vi.fn(),
  completeRecommendations: vi.fn(),
  checkQuestionAnswer: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  isContentAdminUser: mocks.isContentAdminUser,
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
    submission: { create: mocks.createSubmission },
    userProblemStatus: {
      findUnique: mocks.findProblemStatus,
      upsert: mocks.upsertProblemStatus,
    },
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

describe("independent-practice submission route runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue({ valid: true });
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "student@example.test",
      role: "STUDENT",
    });
    mocks.isContentAdminUser.mockReturnValue(false);
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
    expect(mocks.completeRecommendations).toHaveBeenCalledWith("user-1", "problem-1");
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
