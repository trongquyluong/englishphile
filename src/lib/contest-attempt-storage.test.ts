import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), check: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { contestAttempt: { findFirst: mocks.findFirst, updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow } } }));
vi.mock("@/lib/answer-checking", () => ({ checkQuestionAnswer: mocks.check }));

import { submitContestAttempt, type ContestWithProblems } from "@/lib/contests";
import { CONTEST_ATTEMPT_LIMITS } from "@/lib/dto/contest-attempt";

const contest = {
  id: "contest-1",
  durationMinutes: null,
  endsAt: null,
  problems: [{ id: "cp1", problemId: "p1", section: "Use of English", problem: { title: "Problem", questions: [{ id: "q1", type: "MCQ", prompt: "Presented prompt", rootWord: null, answer: { correctOptionId: "A", sentinel: "CANONICAL_SENTINEL" }, explanation: "EXPLANATION_SENTINEL" }] } }],
  sections: [],
} as unknown as ContestWithProblems;

describe("contest finalization storage boundary with mocked repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({ id: "attempt-1", status: "IN_PROGRESS", startedAt: new Date() });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "attempt-1", status: "SUBMITTED" });
    mocks.check.mockReturnValue({ isCorrect: true, correctAnswer: "CANONICAL_SENTINEL", feedback: "EXPLANATION_SENTINEL" });
  });

  it("finalizes an owned attempt with the versioned allowlisted JSON", async () => {
    await submitContestAttempt(contest, "attempt-1", "user-1", { p1: { q1: "learner" } });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "attempt-1", contestId: "contest-1", userId: "user-1" } });
    const stored = mocks.updateMany.mock.calls[0][0].data.answersJson;
    expect(stored.version).toBe(1);
    expect(stored.problems[0].results[0]).toEqual(expect.objectContaining({ questionId: "q1", studentAnswer: "learner", isCorrect: true }));
    expect(JSON.stringify(stored)).not.toContain("CANONICAL_SENTINEL");
    expect(JSON.stringify(stored)).not.toContain("EXPLANATION_SENTINEL");
  });

  it("preserves ownership and conditional replay guards", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    await expect(submitContestAttempt(contest, "attempt-1", "other-user", {}, {})).rejects.toThrow();
    expect(mocks.updateMany).not.toHaveBeenCalled();

    mocks.findFirst.mockResolvedValueOnce({ id: "attempt-1", status: "IN_PROGRESS", startedAt: new Date() });
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(submitContestAttempt(contest, "attempt-1", "user-1", { p1: { q1: "learner" } })).rejects.toThrow();
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("rejects an excessive server-derived presentation snapshot before persistence", async () => {
    const oversizedContest = {
      ...contest,
      problems: [{
        ...contest.problems[0],
        problem: {
          ...contest.problems[0].problem,
          questions: [{ ...contest.problems[0].problem.questions[0], prompt: "p".repeat(CONTEST_ATTEMPT_LIMITS.maxPromptBytes + 1) }],
        },
      }],
    } as ContestWithProblems;
    await expect(submitContestAttempt(oversizedContest, "attempt-1", "user-1", { p1: { q1: "learner" } })).rejects.toThrow("Contest result could not be safely stored.");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not let oversized discarded checker material block finalization", async () => {
    mocks.check.mockReturnValueOnce({
      isCorrect: true,
      correctAnswer: { deeplyDiscarded: "c".repeat(CONTEST_ATTEMPT_LIMITS.maxStoredBytes + 1) },
      feedback: "f".repeat(CONTEST_ATTEMPT_LIMITS.maxStoredBytes + 1),
    });
    await expect(submitContestAttempt(contest, "attempt-1", "user-1", { p1: { q1: "learner" } })).resolves.toEqual({
      id: "attempt-1",
      status: "SUBMITTED",
    });
    const stored = mocks.updateMany.mock.calls[0][0].data.answersJson;
    expect(stored.problems[0].results[0]).toEqual(expect.objectContaining({ studentAnswer: "learner", isCorrect: true }));
    expect(JSON.stringify(stored)).not.toContain("deeplyDiscarded");
  });
});
