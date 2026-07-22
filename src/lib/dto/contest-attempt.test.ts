import { describe, expect, it } from "vitest";
import { CONTEST_ATTEMPT_LIMITS, toLearnerContestResult, toStoredContestAttemptResult } from "@/lib/dto/contest-attempt";

const forbiddenKeys = new Set(["correctAnswer", "acceptedAnswers", "modelAnswer", "explanation", "feedback", "options", "metadata", "answers", "answersBySection"]);
function expectNoForbiddenFields(value: unknown) {
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      expect(forbiddenKeys.has(key)).toBe(false);
      visit(child);
    }
  };
  visit(value);
}

const source = {
  score: 1,
  total: 1,
  answers: { q1: "UNFILTERED_MAP_SENTINEL" },
  problems: [{
    contestProblemId: "cp1",
    problemId: "p1",
    title: "Title",
    section: "Section",
    metadata: { answer: "METADATA_SENTINEL" },
    results: [{ questionId: "q1", type: "MCQ", prompt: "Presented prompt", rootWord: null, studentAnswer: "learner", isCorrect: true, correctAnswer: "CANONICAL_SENTINEL", feedback: "EXPLANATION_SENTINEL", options: ["OPTION_SENTINEL"] }],
  }],
  sectionResults: [],
  sectionBreakdown: [{ section: "Section", score: 1, total: 1, needsReview: 0 }],
};

describe("contest attempt positive storage/read mapper", () => {
  it("creates the versioned learner-safe stored shape", () => {
    const stored = toStoredContestAttemptResult(source);
    expect(stored.version).toBe(1);
    expect(stored.problems[0].results[0]).toEqual({ questionId: "q1", type: "MCQ", prompt: "Presented prompt", rootWord: null, studentAnswer: "learner", isCorrect: true });
    const serialized = JSON.stringify(stored);
    for (const sentinel of ["UNFILTERED_MAP_SENTINEL", "METADATA_SENTINEL", "CANONICAL_SENTINEL", "EXPLANATION_SENTINEL", "OPTION_SENTINEL"]) expect(serialized).not.toContain(sentinel);
    expectNoForbiddenFields(stored);
  });

  it("accepts the contest answer shapes for MCQ, error identification, and Writing", () => {
    const shaped = toStoredContestAttemptResult({
      score: 1,
      total: 2,
      problems: [{
        contestProblemId: "cp1",
        problemId: "p1",
        title: "Title",
        section: "Section",
        results: [
          { questionId: "mcq", type: "MCQ", studentAnswer: "A", isCorrect: true },
          { questionId: "error", type: "ERROR_IDENTIFICATION", studentAnswer: { part: "part", correction: "correction" }, isCorrect: false },
          { questionId: "writing", type: "WRITING_PROMPT", studentAnswer: { thesis: "t", mainIdea1: "a", mainIdea2: "b", vocabulary: "v", essay: "essay" }, isCorrect: null },
        ],
      }],
      sectionResults: [],
      sectionBreakdown: [],
    });
    expect(shaped.problems[0].results.map((result) => result.studentAnswer)).toEqual([
      "A",
      { part: "part", correction: "correction" },
      { thesis: "t", mainIdea1: "a", mainIdea2: "b", vocabulary: "v", essay: "essay" },
    ]);
  });

  it("reads a legacy row through the same positive mapper", () => {
    const legacy = toLearnerContestResult(source);
    expect(legacy?.version).toBe(1);
    expect(JSON.stringify(legacy)).not.toContain("CANONICAL_SENTINEL");
  });

  it("fails safely for malformed or unknown versions", () => {
    expect(toLearnerContestResult({ version: 2, score: 1, total: 1 })).toBeNull();
    expect(toLearnerContestResult({ score: 1, total: 1, problems: [{}] })).toBeNull();
    expect(toLearnerContestResult("bad")).toBeNull();
  });

  it("fails closed for excessive retained counts, strings, and unsupported learner JSON", () => {
    expect(toLearnerContestResult({
      ...source,
      problems: Array.from({ length: CONTEST_ATTEMPT_LIMITS.maxProblems + 1 }, () => source.problems[0]),
    })).toBeNull();
    expect(toLearnerContestResult({
      ...source,
      problems: [{ ...source.problems[0], title: "t".repeat(CONTEST_ATTEMPT_LIMITS.maxTitleBytes + 1) }],
    })).toBeNull();
    expect(toLearnerContestResult({
      ...source,
      problems: [{ ...source.problems[0], results: [{ ...source.problems[0].results[0], studentAnswer: { arbitrary: "value" } }] }],
    })).toBeNull();
    expect(toLearnerContestResult({
      ...source,
      problems: [{ ...source.problems[0], results: [{ ...source.problems[0].results[0], studentAnswer: "a".repeat(CONTEST_ATTEMPT_LIMITS.maxLearnerAnswerBytes + 1) }] }],
    })).toBeNull();
  });

  it("ignores oversized, deep, and cyclic discarded fields without traversing them", () => {
    let discarded: Record<string, unknown> = { value: "x".repeat(CONTEST_ATTEMPT_LIMITS.maxStoredBytes + 1) };
    for (let index = 0; index < 100; index += 1) discarded = { nested: discarded };
    discarded.cycle = discarded;
    let discardedGetterCalled = false;
    const input = Object.defineProperty({
      ...source,
      feedback: discarded,
      options: discarded,
      metadata: discarded,
      answers: discarded,
      problems: [{ ...source.problems[0], results: [{ ...source.problems[0].results[0], correctAnswer: discarded, feedback: discarded }] }],
    }, "correctAnswer", {
      enumerable: true,
      get() { discardedGetterCalled = true; return discarded; },
    });
    const stored = toStoredContestAttemptResult(input);
    expect(discardedGetterCalled).toBe(false);
    expect(stored.problems[0].results[0].studentAnswer).toBe("learner");
    expectNoForbiddenFields(stored);
  });

  it("bounds the final serialized result and never throws on cycles in retained fields", () => {
    const oversized = {
      ...source,
      problems: [{
        ...source.problems[0],
        results: Array.from({ length: 120 }, (_, index) => ({
          ...source.problems[0].results[0],
          questionId: `q${index}`,
          prompt: "p".repeat(CONTEST_ATTEMPT_LIMITS.maxPromptBytes),
        })),
      }],
    };
    expect(toLearnerContestResult(oversized)).toBeNull();
    const retainedCycle: unknown[] = [];
    retainedCycle.push(retainedCycle);
    const cyclic = { ...source, problems: retainedCycle };
    expect(() => toLearnerContestResult(cyclic)).not.toThrow();
    expect(toLearnerContestResult(cyclic)).toBeNull();
  });

  it("accepts the maximum logical result count without double-counting projections", () => {
    const maximum = toStoredContestAttemptResult({
      score: CONTEST_ATTEMPT_LIMITS.maxResults,
      total: CONTEST_ATTEMPT_LIMITS.maxResults,
      problems: Array.from({ length: CONTEST_ATTEMPT_LIMITS.maxProblems }, (_, index) => ({
        contestProblemId: `cp${index}`,
        problemId: `p${index}`,
        title: "",
        section: "",
        results: [{ questionId: `q${index}`, type: "MCQ", studentAnswer: "A", isCorrect: true }],
      })),
      sectionResults: [],
      sectionBreakdown: [],
    });
    expect(maximum.problems).toHaveLength(CONTEST_ATTEMPT_LIMITS.maxResults);
  });
});
