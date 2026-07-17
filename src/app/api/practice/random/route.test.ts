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
    submission: { create: mocks.createSubmission },
    userProblemStatus: {
      findUnique: mocks.findProblemStatus,
      upsert: mocks.upsertProblemStatus,
    },
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
  });
});
