import { describe, expect, it } from "vitest";
import type { DiagnosticAttemptStatus } from "@prisma/client";
import {
  normalizeLearnerOptions,
  toLearnerProblemDTO,
  toLearnerQuestionDTO,
  type LearnerProblemSource,
  type LearnerQuestionSource,
} from "@/lib/dto/learner-question";
import {
  sanitizeDiagnosticAttemptMetadata,
  toLearnerDiagnosticResultDTO,
} from "@/lib/dto/diagnostic";
import {
  LEARNER_FEEDBACK,
  toQuestionResult,
  toRandomPracticeResultDTO,
  toSubmissionResultDTO,
} from "@/lib/dto/submission";

const ANSWER_SENTINEL = "H10_CANONICAL_7q9x";
const EXPLANATION_SENTINEL = "H10_EXPLANATION_4v2m";

function serialized(value: unknown) {
  return JSON.stringify(value);
}

function diagnosticResultSource(status: DiagnosticAttemptStatus, completedAt: Date | null) {
  const timestamp = new Date("2026-01-01T00:00:00Z");
  return {
    id: "attempt-completion-gate",
    status,
    startedAt: timestamp,
    completedAt,
    score: 1,
    total: 1,
    estimatedLevel: "C1" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    skillBreakdownJson: [],
    topicBreakdownJson: [],
    recommendationJson: {},
  };
}

describe("Phase 1D-A learner-safe DTO runtime regressions", () => {
  it("recursively allowlists question presentation and normalized option fields", () => {
    const source = {
      id: "question-1",
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      prompt: "Choose one.",
      passage: null,
      options: [
        {
          id: "A",
          text: "Visible choice",
          correct: true,
          correctAnswer: ANSWER_SENTINEL,
          metadata: { answer: ANSWER_SENTINEL },
        },
      ],
      answer: { correctOptionId: "A", acceptedAnswers: [ANSWER_SENTINEL] },
      correctAnswer: ANSWER_SENTINEL,
      explanation: EXPLANATION_SENTINEL,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: {
        audioUrl: "/audio/safe.mp3",
        sectionType: "part-1",
        transcript: ANSWER_SENTINEL,
        modelAnswer: ANSWER_SENTINEL,
        nested: { correction: ANSWER_SENTINEL },
      },
      orderIndex: 0,
      problem: { title: "Published problem" },
    } as LearnerQuestionSource & Record<string, unknown>;

    const dto = toLearnerQuestionDTO(source);

    expect(dto.options).toEqual([{ id: "A", text: "Visible choice" }]);
    expect(dto.audioUrl).toBe("/audio/safe.mp3");
    expect(dto.sectionType).toBe("part-1");
    expect(serialized(dto)).not.toContain(ANSWER_SENTINEL);
    expect(serialized(dto)).not.toContain(EXPLANATION_SENTINEL);
    expect(serialized(dto)).not.toContain("correctOptionId");
    expect(serialized(dto)).not.toContain("transcript");
  });

  it("uses a positive problem allowlist instead of spreading source records", () => {
    const question = {
      id: "question-1",
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      prompt: "Prompt",
      passage: null,
      options: [{ id: "A", text: "Choice", answer: ANSWER_SENTINEL }],
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: { secret: ANSWER_SENTINEL },
      orderIndex: 0,
    } satisfies LearnerQuestionSource;
    const source = {
      id: "problem-1",
      title: "Problem",
      slug: "problem",
      skillType: "MULTIPLE_CHOICE",
      questionType: "MCQ",
      difficulty: "C1",
      contentStatus: "PUBLISHED",
      statement: "Statement",
      instructions: null,
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: { name: "Collection" },
      problemTopics: [{ topic: { name: "Grammar", slug: "grammar" } }],
      questions: [question],
      answerKey: ANSWER_SENTINEL,
    } as LearnerProblemSource & Record<string, unknown>;

    const dto = toLearnerProblemDTO(source);

    expect(dto.questions[0]?.options).toEqual([{ id: "A", text: "Choice" }]);
    expect(serialized(dto)).not.toContain(ANSWER_SENTINEL);
    expect(dto).not.toHaveProperty("answerKey");
  });

  it("normalizes only option id and display text", () => {
    expect(normalizeLearnerOptions([
      { id: 1, text: 2, explanation: EXPLANATION_SENTINEL },
      { label: "B", text: ANSWER_SENTINEL },
    ])).toEqual([{ id: "1", text: "2" }]);
  });

  it("returns fixed correct, incorrect, and review-pending feedback", () => {
    expect(toQuestionResult("q1", true).feedback).toBe(LEARNER_FEEDBACK.correct);
    expect(toQuestionResult("q2", false).feedback).toBe(LEARNER_FEEDBACK.incorrect);
    expect(toQuestionResult("q3", null).feedback).toBe(LEARNER_FEEDBACK.needsReview);
  });

  it("recursively sanitizes submission and random-practice result sources", () => {
    const unsafeAnswers = [{
      questionId: "q1",
      isCorrect: false,
      correctAnswer: ANSWER_SENTINEL,
      feedback: EXPLANATION_SENTINEL,
      nested: { acceptedAnswers: [ANSWER_SENTINEL] },
    }];
    const submission = toSubmissionResultDTO({
      submissionId: "submission-1",
      status: "WRONG_ANSWER",
      score: 0,
      total: 1,
      answers: unsafeAnswers,
    });
    const random = toRandomPracticeResultDTO({
      status: "WRONG_ANSWER",
      score: 0,
      total: 1,
      answers: unsafeAnswers,
    });

    expect(serialized({ submission, random })).not.toContain(ANSWER_SENTINEL);
    expect(serialized({ submission, random })).not.toContain(EXPLANATION_SENTINEL);
    expect(submission.answers[0]?.feedback).toBe(LEARNER_FEEDBACK.incorrect);
  });

  it("ignores sensitive historical diagnostic recommendation fields recursively", () => {
    const metadata = sanitizeDiagnosticAttemptMetadata({
      questionIds: ["q1"],
      sections: [],
      coverageWarnings: [],
      results: [{
        questionId: "q1",
        problemId: "p1",
        skillType: "MULTIPLE_CHOICE",
        difficulty: "C1",
        isCorrect: false,
        correctAnswer: ANSWER_SENTINEL,
        feedback: EXPLANATION_SENTINEL,
        answer: { acceptedAnswers: [ANSWER_SENTINEL] },
      }],
      scoring: {
        weightedAccuracy: 0,
        rawCorrect: 0,
        rawAttempted: 1,
        confidence: "LOW",
        confidenceLabel: "Thấp",
        confidenceReason: "Sparse data",
        strengths: [],
        weakAreas: [],
        levelExplanation: "Aggregate-only explanation",
        modelAnswer: ANSWER_SENTINEL,
      },
    });

    expect(metadata.results).toEqual([{
      questionId: "q1",
      problemId: "p1",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      isCorrect: false,
    }]);
    expect(serialized(metadata)).not.toContain(ANSWER_SENTINEL);
    expect(serialized(metadata)).not.toContain(EXPLANATION_SENTINEL);
  });

  it("maps only aggregate finalized diagnostic result fields", () => {
    const result = toLearnerDiagnosticResultDTO({
      id: "attempt-1",
      status: "COMPLETED",
      startedAt: new Date("2026-01-01T00:00:00Z"),
      completedAt: new Date("2026-01-01T00:10:00Z"),
      score: 1,
      total: 1,
      estimatedLevel: "C1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:10:00Z"),
      skillBreakdownJson: [{
        skillType: "MULTIPLE_CHOICE",
        label: "Multiple Choice",
        correct: 1,
        attempted: 1,
        weightedCorrect: 1,
        weightedTotal: 1,
        accuracy: 1,
        statusLabel: "Tốt",
        correctAnswer: ANSWER_SENTINEL,
      }],
      topicBreakdownJson: [],
      recommendationJson: {
        correctAnswer: ANSWER_SENTINEL,
        results: [{ correctAnswer: ANSWER_SENTINEL }],
        scoring: {
          weightedAccuracy: 1,
          rawCorrect: 1,
          rawAttempted: 1,
          confidence: "LOW",
          confidenceLabel: "Thấp",
          confidenceReason: "Sparse data",
          strengths: [],
          weakAreas: [],
          levelExplanation: "Aggregate-only explanation",
        },
      },
    });

    expect(result?.status).toBe("COMPLETED");
    expect(result?.skillBreakdown).toHaveLength(1);
    expect(serialized(result)).not.toContain(ANSWER_SENTINEL);
    expect(result).not.toHaveProperty("recommendationJson");
  });

  it.each(["COMPLETED", "NEEDS_REVIEW"] as const)(
    "accepts %s only when completedAt is set",
    (status) => {
      const result = toLearnerDiagnosticResultDTO(
        diagnosticResultSource(status, new Date("2026-01-01T00:10:00Z")),
      );
      expect(result?.status).toBe(status);
      expect(result?.completedAt).not.toBeNull();
    },
  );

  it.each([
    ["COMPLETED", null],
    ["NEEDS_REVIEW", null],
    ["IN_PROGRESS", new Date("2026-01-01T00:10:00Z")],
    ["ABANDONED", new Date("2026-01-01T00:10:00Z")],
  ] satisfies Array<[DiagnosticAttemptStatus, Date | null]>)(
    "rejects %s with an invalid completion state",
    (status, completedAt) => {
      expect(toLearnerDiagnosticResultDTO(
        diagnosticResultSource(status, completedAt),
      )).toBeNull();
    },
  );
});
