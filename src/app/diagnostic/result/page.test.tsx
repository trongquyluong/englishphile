import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getLearnerDiagnosticResult: vi.fn(),
  getLatestLearnerDiagnosticResult: vi.fn(),
  getActiveLearningRecommendations: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/diagnostic", () => ({
  getLearnerDiagnosticResult: mocks.getLearnerDiagnosticResult,
  getLatestLearnerDiagnosticResult: mocks.getLatestLearnerDiagnosticResult,
  getActiveLearningRecommendations: mocks.getActiveLearningRecommendations,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

class RedirectSignal extends Error {
  constructor(public readonly target: string) {
    super(`Redirect to ${target}`);
    this.name = "RedirectSignal";
  }
}

import DiagnosticResultPage from "@/app/diagnostic/result/page";

const adminCurrentUser = {
  id: "admin-current",
  role: "ADMIN",
  email: "admin@example.test",
};

const ownerShapedCurrentUser = {
  id: "owner-current",
  role: "STUDENT",
  email: "owner@example.test",
};

const ordinaryStudent = {
  id: "student-current",
  role: "STUDENT",
  email: "student@example.test",
};

const substitutedSearchParams = {
  attempt: "attempt-requested",
  userId: "victim-user",
  ownerId: "victim-user",
};

describe("diagnostic result production-page runtime boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((target: string) => {
      throw new RedirectSignal(target);
    });
    mocks.getLearnerDiagnosticResult.mockResolvedValue(null);
    mocks.getLatestLearnerDiagnosticResult.mockResolvedValue(null);
    mocks.getActiveLearningRecommendations.mockResolvedValue([]);
  });

  it.each([
    ["stored ADMIN", adminCurrentUser],
    ["owner-shaped current STUDENT", ownerShapedCurrentUser],
  ])(
    "%s receives no cross-user result bypass and follows the generic unavailable redirect",
    async (_label, currentUser) => {
      mocks.requireUser.mockResolvedValue(currentUser);

      await expect(DiagnosticResultPage({
        searchParams: Promise.resolve(substitutedSearchParams),
      })).rejects.toMatchObject({
        name: "RedirectSignal",
        target: "/diagnostic",
      });

      expect(mocks.getLearnerDiagnosticResult).toHaveBeenCalledTimes(1);
      expect(mocks.getLearnerDiagnosticResult).toHaveBeenCalledWith(
        "attempt-requested",
        currentUser.id,
      );
      expect(mocks.getLearnerDiagnosticResult).not.toHaveBeenCalledWith(
        expect.anything(),
        "victim-user",
      );
      expect(mocks.getLatestLearnerDiagnosticResult).not.toHaveBeenCalled();
      expect(mocks.redirect).toHaveBeenCalledWith("/diagnostic");
    },
  );

  it("uses the current session user ID for latest-result lookup when attempt is absent", async () => {
    mocks.requireUser.mockResolvedValue(adminCurrentUser);

    await expect(DiagnosticResultPage({
      searchParams: Promise.resolve({ userId: "victim-user", ownerId: "victim-user" }),
    })).rejects.toBeInstanceOf(RedirectSignal);

    expect(mocks.getLatestLearnerDiagnosticResult).toHaveBeenCalledTimes(1);
    expect(mocks.getLatestLearnerDiagnosticResult).toHaveBeenCalledWith("admin-current");
    expect(mocks.getLearnerDiagnosticResult).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/diagnostic");
  });

  it("applies the same own-user-ID scope to an ordinary STUDENT", async () => {
    mocks.requireUser.mockResolvedValue(ordinaryStudent);

    await expect(DiagnosticResultPage({
      searchParams: Promise.resolve(substitutedSearchParams),
    })).rejects.toBeInstanceOf(RedirectSignal);

    expect(mocks.getLearnerDiagnosticResult).toHaveBeenCalledWith(
      "attempt-requested",
      "student-current",
    );
    expect(mocks.getLearnerDiagnosticResult).not.toHaveBeenCalledWith(
      expect.anything(),
      "victim-user",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/diagnostic");
  });
});
