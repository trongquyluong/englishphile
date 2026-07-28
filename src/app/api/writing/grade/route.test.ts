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
  releaseProviderStartedWritingReservation: vi.fn(),
  cancelWritingReservation: vi.fn(),
  getWritingQuotaStatus: vi.fn(),
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
  releaseProviderStartedWritingReservation:
    mocks.releaseProviderStartedWritingReservation,
  cancelWritingReservation: mocks.cancelWritingReservation,
  getWritingQuotaStatus: mocks.getWritingQuotaStatus,
  persistCompletedWritingSubmission: mocks.persistCompletedWritingSubmission,
}));

import { POST } from "@/app/api/writing/grade/route";
import {
  WritingGraderError,
  type WritingGraderErrorCode,
} from "@/lib/ai/writing-grader";

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
const persistedReviewTimestamp = Date.parse("2026-07-28T12:00:00.000Z");

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
    mocks.releaseProviderStartedWritingReservation.mockResolvedValue(true);
    mocks.getWritingQuotaStatus.mockResolvedValue({
      used: 1,
      remaining: 1,
      total: 2,
    });
    mocks.gradeEssay.mockResolvedValue(gradeResult);
    mocks.persistCompletedWritingSubmission.mockResolvedValue({
      id: "submission-1",
      createdAt: new Date(persistedReviewTimestamp),
    });
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
    expect(await response.json()).toEqual({
      result: gradeResult,
      reviewTimestamp: persistedReviewTimestamp,
      remaining: 1,
    });
    expect(mocks.persistCompletedWritingSubmission).toHaveBeenCalledTimes(1);
    expect(
      mocks.releaseProviderStartedWritingReservation,
    ).not.toHaveBeenCalled();
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
      error: "Hệ thống đã dùng hết lượt chấm bài hôm nay. Hãy quay lại vào ngày mai.",
      remaining: 1,
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
      remaining: 0,
    });
    expect(mocks.checkConfiguredRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });

  it("returns authoritative remaining data on a pre-provider recoverable error", async () => {
    mocks.checkConfiguredRateLimit.mockResolvedValueOnce({
      status: "rate-limited",
      remaining: 0,
      retryAfterSeconds: 60,
    });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ remaining: 1 });
    expect(mocks.getWritingQuotaStatus).toHaveBeenCalledWith("user-1");
    expect(mocks.reserveWritingQuota).not.toHaveBeenCalled();
    expect(mocks.gradeEssay).not.toHaveBeenCalled();
  });

  it.each<[WritingGraderErrorCode, number]>([
    ["NOT_CONFIGURED", 503],
    ["PROVIDER_RATE_LIMITED", 429],
    ["CONTENT_BLOCKED", 422],
    ["INVALID_RESPONSE", 502],
    ["NETWORK_ERROR", 504],
    ["PROVIDER_ERROR", 502],
  ])("returns product-safe copy for grader error %s", async (code, expectedStatus) => {
    mocks.gradeEssay.mockRejectedValue(
      new WritingGraderError(code, "INTERNAL-PROVIDER-SENTINEL"),
    );

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(expectedStatus);
    expect(body.error).toEqual(expect.any(String));
    expect(body.remaining).toBe(1);
    expect(body.error).not.toMatch(/\bAI\b|Cloudflare|provider|server/i);
    expect(JSON.stringify(body)).not.toContain("INTERNAL-PROVIDER-SENTINEL");
    expect(
      mocks.releaseProviderStartedWritingReservation,
    ).toHaveBeenCalledWith("reservation-1", "user-1");
    expect(mocks.persistCompletedWritingSubmission).not.toHaveBeenCalled();
    expect(
      mocks.checkConfiguredRateLimit.mock.calls.filter(
        ([config]) => config.action === "writing-grade-daily-global",
      ),
    ).toHaveLength(1);
  });

  it("keeps failure quota conservative when exact reservation release is not confirmed", async () => {
    mocks.gradeEssay.mockRejectedValue(
      new WritingGraderError("INVALID_RESPONSE", "internal"),
    );
    mocks.releaseProviderStartedWritingReservation.mockResolvedValue(false);
    mocks.getWritingQuotaStatus.mockResolvedValue({
      used: 2,
      remaining: 0,
      total: 2,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ remaining: 0 });
    expect(
      mocks.releaseProviderStartedWritingReservation,
    ).toHaveBeenCalledWith("reservation-1", "user-1");
  });

  it("releases the learner reservation after a persistence failure without refunding the global attempt", async () => {
    const sentinel = "PERSISTENCE-SENSITIVE-SENTINEL";
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.persistCompletedWritingSubmission.mockRejectedValue(
      new Error(sentinel),
    );
    mocks.getWritingQuotaStatus.mockResolvedValue({
      used: 0,
      remaining: 2,
      total: 2,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.remaining).toBe(2);
    expect(body.error).not.toContain(sentinel);
    expect(
      mocks.releaseProviderStartedWritingReservation,
    ).toHaveBeenCalledWith("reservation-1", "user-1");
    expect(
      mocks.checkConfiguredRateLimit.mock.calls.filter(
        ([config]) => config.action === "writing-grade-daily-global",
      ),
    ).toHaveLength(1);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(sentinel);
  });

  it("cannot persist more than two successful daily grades across concurrent requests", async () => {
    let nextReservation = 0;
    mocks.reserveWritingQuota.mockImplementation(async () => {
      nextReservation += 1;
      return nextReservation <= 2
        ? {
            allowed: true,
            reservationId: `reservation-${nextReservation}`,
            remaining: 2 - nextReservation,
          }
        : {
            allowed: false,
            reason: "quota-exceeded",
            remaining: 0,
          };
    });
    mocks.getWritingQuotaStatus.mockResolvedValue({
      used: 2,
      remaining: 0,
      total: 2,
    });

    const responses = await Promise.all(
      Array.from({ length: 8 }, () => POST(request())),
    );

    expect(responses.filter((response) => response.status === 200)).toHaveLength(2);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(6);
    expect(mocks.persistCompletedWritingSubmission).toHaveBeenCalledTimes(2);
    expect(
      mocks.persistCompletedWritingSubmission.mock.calls.map(([reservationId]) => reservationId),
    ).toEqual(["reservation-1", "reservation-2"]);
  });
});
