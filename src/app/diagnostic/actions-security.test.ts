import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  parseAnswers: vi.fn(),
  scoreAttempt: vi.fn(),
  createAttempt: vi.fn(),
  latestAttempt: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: mocks.checkRateLimit,
  RATE_LIMITS: {
    DIAGNOSTIC_START: (userId: string) => ({ key: `start:${userId}` }),
    DIAGNOSTIC_SUBMIT: (userId: string) => ({ key: `submit:${userId}` }),
  },
}));
vi.mock("@/lib/security/submission-input", () => ({
  parseDiagnosticAnswerEntries: mocks.parseAnswers,
}));
vi.mock("@/lib/diagnostic", () => ({
  DIAGNOSTIC_UNAVAILABLE_MESSAGE: "Không thể truy cập bài diagnostic này.",
  createDiagnosticAttempt: mocks.createAttempt,
  getLatestDiagnosticAttempt: mocks.latestAttempt,
  scoreDiagnosticAttempt: mocks.scoreAttempt,
}));

import { submitDiagnosticAction } from "@/app/diagnostic/actions";

class RedirectSignal extends Error {}

describe("diagnostic Server Action Phase 1D-A direct-invocation runtime regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => { throw new RedirectSignal("redirect"); });
    mocks.requireUser.mockResolvedValue({ id: "learner-1", role: "STUDENT" });
    mocks.checkRateLimit.mockResolvedValue({ status: "allowed" });
    mocks.parseAnswers.mockReturnValue({ q1: "A" });
  });

  it("rejects anonymous direct invocation before scoring", async () => {
    mocks.requireUser.mockRejectedValue(new Error("authentication required"));
    const form = new FormData();
    form.set("attemptId", "attempt-1");

    await expect(submitDiagnosticAction(form)).rejects.toThrow("authentication required");
    expect(mocks.scoreAttempt).not.toHaveBeenCalled();
  });

  it("retains local authentication and converts internal failures to one generic local redirect", async () => {
    mocks.scoreAttempt.mockRejectedValue(new Error("Prisma foreign attempt H10_CANONICAL_SENTINEL"));
    const form = new FormData();
    form.set("attemptId", "foreign-or-missing-id");

    await expect(submitDiagnosticAction(form)).rejects.toBeInstanceOf(RedirectSignal);

    expect(mocks.requireUser).toHaveBeenCalledTimes(1);
    expect(mocks.scoreAttempt).toHaveBeenCalledWith("foreign-or-missing-id", "learner-1", { q1: "A" });
    const target = String(mocks.redirect.mock.calls[0]?.[0]);
    expect(target).toMatch(/^\/diagnostic\?error=/);
    expect(decodeURIComponent(target)).toContain("Không thể truy cập bài diagnostic này.");
    expect(target).not.toContain("foreign-or-missing-id");
    expect(target).not.toContain("Prisma");
    expect(target).not.toContain("H10_CANONICAL_SENTINEL");
  });

  it("redirects successful finalization only to the approved local result path", async () => {
    mocks.scoreAttempt.mockResolvedValue(undefined);
    const form = new FormData();
    form.set("attemptId", "attempt-own");

    await expect(submitDiagnosticAction(form)).rejects.toBeInstanceOf(RedirectSignal);

    expect(mocks.redirect).toHaveBeenCalledWith("/diagnostic/result?attempt=attempt-own");
  });
});
