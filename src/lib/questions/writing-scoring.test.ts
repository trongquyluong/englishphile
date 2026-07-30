import { describe, expect, it } from "vitest";
import {
  checkQuestionAnswer,
  getSubmissionStatus,
} from "@/lib/answer-checking";

describe("Writing non-auto-scoring regression", () => {
  it("always returns null correctness for Writing without turning the rubric into an answer key", () => {
    const rubricSentinel = "AUTHORED_RUBRIC_IS_NOT_AN_ANSWER";
    const result = checkQuestionAnswer({
      type: "WRITING_PROMPT",
      answer: {
        manualReview: true,
        rubric: [rubricSentinel],
      },
      explanation: "Admin-authored explanation.",
    }, {
      essay: "A complete learner response.",
    });

    expect(result.isCorrect).toBeNull();
    expect(result.feedback).toContain("cần chấm tay");
    expect(result.feedback).not.toContain(rubricSentinel);
    expect(result.feedback).not.toMatch(/\b\d+(?:[.,]\d+)?\s*\/\s*\d+\b/);
    expect(getSubmissionStatus([result])).toBe("NEEDS_REVIEW");
  });

  it("leaves exact and non-exact Sentence Transformation behavior unchanged", () => {
    const question = {
      type: "SENTENCE_TRANSFORMATION" as const,
      answer: { acceptedAnswers: ["No sooner had she arrived than it rained."] },
      explanation: "Use no sooner ... than.",
    };

    expect(checkQuestionAnswer(
      question,
      "No sooner had she arrived than it rained.",
    ).isCorrect).toBe(true);
    expect(checkQuestionAnswer(
      question,
      "Hardly had she arrived when it began to rain.",
    ).isCorrect).toBeNull();
  });
});
