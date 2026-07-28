import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gradeEssay: vi.fn(),
  getWritingGlobalDailyLimit: vi.fn(),
  isWritingGraderEnabled: vi.fn(),
  getCurrentUser: vi.fn(),
  validateRequestOrigin: vi.fn(),
  checkConfiguredRateLimit: vi.fn(),
  reserveWritingQuota: vi.fn(),
  markProviderStarted: vi.fn(),
  failWritingReservation: vi.fn(),
  cancelWritingReservation: vi.fn(),
  persistCompletedWritingSubmission: vi.fn(),
}));

vi.mock("@/lib/ai/writing-grader", () => {
  class WritingGraderError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    gradeEssay: mocks.gradeEssay,
    getWritingGlobalDailyLimit: mocks.getWritingGlobalDailyLimit,
    isWritingGraderEnabled: mocks.isWritingGraderEnabled,
    WritingGraderError,
  };
});

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/security/request-origin", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  getOriginErrorMessage: () => "Nguồn yêu cầu không hợp lệ.",
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: mocks.checkConfiguredRateLimit,
  RATE_LIMITS: {
    WRITING_GRADE: (userId: string) => ({ action: "writing-grade", subject: userId }),
    WRITING_GRADE_GLOBAL: { action: "writing-grade-global", subject: "global" },
    WRITING_GRADE_DAILY_GLOBAL: (quotaKey: string, limit: number) => ({
      action: "writing-grade-daily-global",
      subject: quotaKey,
      limit,
    }),
  },
}));

vi.mock("@/lib/security/writing-quota", () => ({
  reserveWritingQuota: mocks.reserveWritingQuota,
  markProviderStarted: mocks.markProviderStarted,
  failWritingReservation: mocks.failWritingReservation,
  cancelWritingReservation: mocks.cancelWritingReservation,
  persistCompletedWritingSubmission: mocks.persistCompletedWritingSubmission,
}));

import { POST } from "@/app/api/writing/grade/route";

const gradeResult = {
  totalScore: 20,
  maxScore: 30,
  criteria: {
    content: { score: 6, maxScore: 9, comment: "Ổn." },
    organization: { score: 6, maxScore: 9, comment: "Ổn." },
    language: { score: 6, maxScore: 9, comment: "Ổn." },
    mechanics: { score: 2, maxScore: 3, comment: "Ổn." },
  },
  overallComment: "Cần phát triển thêm dẫn chứng.",
  strengths: [],
  priorityIssues: [],
  detailedFeedback: [],
  nextPracticeTasks: [],
  warnings: [],
};

function request() {
  return new Request("http://localhost/api/writing/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      promptSlug: "machines-at-home",
      targetWordCount: "250-300",
      essayText: "Machines can save time for families and reduce repetitive household work. ".repeat(
        14,
      ),
    }),
  });
}

describe("Writing grade route daily quota boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateRequestOrigin.mockResolvedValue({ valid: true });
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mocks.isWritingGraderEnabled.mockReturnValue(true);
    mocks.getWritingGlobalDailyLimit.mockReturnValue(100);
    mocks.checkConfiguredRateLimit.mockResolvedValue({
      status: "allowed",
      remaining: 1,
      retryAfterSeconds: 0,
    });
    mocks.reserveWritingQuota.mockResolvedValue({
      allowed: true,
      reservationId: "reservation-1",
      remaining: 1,
    });
    mocks.markProviderStarted.mockResolvedValue(true);
    mocks.gradeEssay.mockResolvedValue(gradeResult);
    mocks.persistCompletedWritingSubmission.mockResolvedValue({ id: "submission-1" });
  });

  it("checks the global UTC-day allowance after reserving and before starting the provider", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.checkConfiguredRateLimit).toHaveBeenCalledTimes(3);
    expect(mocks.checkConfiguredRateLimit.mock.calls[2][0]).toMatchObject({
      action: "writing-grade-daily-global",
      limit: 100,
    });
    expect(mocks.reserveWritingQuota.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.checkConfiguredRateLimit.mock.invocationCallOrder[2],
    );
    expect(mocks.checkConfiguredRateLimit.mock.invocationCallOrder[2]).toBeLessThan(
      mocks.markProviderStarted.mock.invocationCallOrder[0],
    );
    expect(mocks.markProviderStarted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.gradeEssay.mock.invocationCallOrder[0],
    );
    expect(await response.json()).toEqual({ result: gradeResult, remaining: 1 });
  });

  it("releases an unstarted user reservation when the site-wide free allowance is exhausted", async () => {
    mocks.checkConfiguredRateLimit
      .mockResolvedValueOnce({ status: "allowed" })
      .mockResolvedValueOnce({ status: "allowed" })
      .mockResolvedValueOnce({
        status: "rate-limited",
        remaining: 0,
        retryAfterSeconds: 86_400,
      });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Hệ thống đã dùng hết lượt chấm AI miễn phí hôm nay. Hãy quay lại vào ngày mai.",
    });
    expect(mocks.cancelWritingReservation).toHaveBeenCalledWith(
      "reservation-1",
      "user-1",
    );
    expect(mocks.markProviderStarted).not.toHaveBeenCalled();
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });

  it("fails closed and releases the reservation when the global allowance store fails", async () => {
    mocks.checkConfiguredRateLimit
      .mockResolvedValueOnce({ status: "allowed" })
      .mockResolvedValueOnce({ status: "allowed" })
      .mockResolvedValueOnce({
        status: "infrastructure-error",
        retryAfterSeconds: 30,
      });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(mocks.cancelWritingReservation).toHaveBeenCalledWith(
      "reservation-1",
      "user-1",
    );
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });

  it("reports the two-attempt learner policy without reaching the global allowance", async () => {
    mocks.reserveWritingQuota.mockResolvedValue({
      allowed: false,
      reason: "quota-exceeded",
      remaining: 0,
    });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Bạn đã dùng hết 2 lượt chấm Writing hôm nay. Hãy quay lại vào ngày mai.",
    });
    expect(mocks.checkConfiguredRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });
});
