import fs from "node:fs";
import path from "node:path";
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

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function objectBlock(content: string, marker: string) {
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Không tìm thấy block ${marker}.`);
  const start = content.indexOf("{", markerIndex);
  if (start < 0) throw new Error(`Block ${marker} không có object.`);

  let depth = 0;
  for (let index = start; index < content.length; index += 1) {
    if (content[index] === "{") depth += 1;
    if (content[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return content.slice(start, index + 1);
  }

  throw new Error(`Block ${marker} chưa đóng.`);
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
  it("uses the positive question select in the primary learner problem route", () => {
    const content = source("src/app/problems/[slug]/page.tsx");
    const questionsBlock = objectBlock(content, "questions:");

    expect(content).toMatch(
      /import\s*\{[^}]*\blearnerQuestionPresentationSelect\b[^}]*\btoLearnerProblemDTO\b[^}]*\}\s*from\s*"@\/lib\/dto\/learner-question"/,
    );
    expect(questionsBlock).toContain(
      'where: canManageContent ? undefined : { contentStatus: "PUBLISHED" }',
    );
    expect(questionsBlock).toContain('orderBy: { orderIndex: "asc" }');
    expect(questionsBlock).toContain(
      "select: learnerQuestionPresentationSelect",
    );
    expect(questionsBlock).not.toMatch(/\binclude\s*:/);
    expect(questionsBlock).not.toMatch(/\b(?:answer|explanation)\s*:/);
    expect(content).toContain(
      "const clientProblem = toLearnerProblemDTO(problem);",
    );
  });

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

  it("projects only canonical Error Identification parts and never answer material", () => {
    const source = {
      id: "error-question",
      type: "ERROR_IDENTIFICATION",
      skillType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      prompt: "Find the error.",
      passage: null,
      options: [
        { id: " a ", text: "The students", answer: ANSWER_SENTINEL },
        { id: "b", text: "was" },
        { id: "C", text: "ready" },
        { id: "d", text: 4 },
      ],
      answer: {
        correctPart: "B",
        correction: ANSWER_SENTINEL,
        acceptedAnswers: [ANSWER_SENTINEL],
      },
      explanation: EXPLANATION_SENTINEL,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: { correction: ANSWER_SENTINEL },
      orderIndex: 0,
    } as LearnerQuestionSource & Record<string, unknown>;

    const dto = toLearnerQuestionDTO(source);

    expect(dto.options).toEqual([
      { id: "A", text: "The students" },
      { id: "B", text: "was" },
      { id: "C", text: "ready" },
      { id: "D", text: "4" },
    ]);
    expect(serialized(dto)).not.toContain(ANSWER_SENTINEL);
    expect(serialized(dto)).not.toContain(EXPLANATION_SENTINEL);
    expect(dto).not.toHaveProperty("answer");
  });

  it("orders valid Error Identification parts A-D regardless of persisted source order", () => {
    const dto = toLearnerQuestionDTO({
      id: "ordered-error-question",
      type: "ERROR_IDENTIFICATION",
      skillType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      prompt: "Find the error.",
      passage: null,
      options: [
        { id: "D", text: "four" },
        { id: "b", text: 2 },
        { id: " A ", text: "one" },
        { id: "C", text: "three" },
      ],
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: null,
      orderIndex: 0,
    });

    expect(dto.options).toEqual([
      { id: "A", text: "one" },
      { id: "B", text: "2" },
      { id: "C", text: "three" },
      { id: "D", text: "four" },
    ]);
  });

  it("projects only complete ordered Pronunciation options with validated spans", () => {
    const source = {
      id: "pronunciation-question",
      type: "PRONUNCIATION_ODD_ONE_OUT",
      skillType: "PRONUNCIATION",
      difficulty: "C1",
      prompt: "Chọn một từ.",
      passage: null,
      options: [
        { id: "D", text: "team", targetSpan: { start: 1, end: 3 }, answer: ANSWER_SENTINEL },
        { id: "b", text: "leaf", targetSpan: { start: 1, end: 3 } },
        { id: " A ", text: "seat", targetSpan: { start: 1, end: 3 } },
        { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      ],
      answer: {
        correctOptionId: "C",
        accepted: [ANSWER_SENTINEL],
        display: ANSWER_SENTINEL,
      },
      explanation: EXPLANATION_SENTINEL,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: {
        focus: ANSWER_SENTINEL,
        nested: { correctOptionId: ANSWER_SENTINEL },
      },
      orderIndex: 0,
    } as LearnerQuestionSource & Record<string, unknown>;
    const optionsSnapshot = structuredClone(source.options);

    const dto = toLearnerQuestionDTO(source);

    expect(dto.options).toEqual([
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
    ]);
    expect(source.options).toEqual(optionsSnapshot);
    expect(serialized(dto)).not.toContain(ANSWER_SENTINEL);
    expect(serialized(dto)).not.toContain(EXPLANATION_SENTINEL);
    expect(serialized(dto)).not.toContain("correctOptionId");
    expect(serialized(dto)).not.toContain("focus");
    expect(dto).not.toHaveProperty("answer");
    expect(dto).not.toHaveProperty("metadata");
    expect(dto).not.toHaveProperty("explanation");
  });

  it.each([
    ["missing spans", [
      { id: "A", text: "seat" },
      { id: "B", text: "leaf" },
      { id: "C", text: "bread" },
      { id: "D", text: "team" },
    ]],
    ["malformed range", [
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 1 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
    ]],
    ["incomplete A-D", [
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
    ]],
  ])("emits no partial Pronunciation choices for %s", (_name, options) => {
    const dto = toLearnerQuestionDTO({
      id: "malformed-pronunciation",
      type: "PRONUNCIATION_ODD_ONE_OUT",
      skillType: "PRONUNCIATION",
      difficulty: "C1",
      prompt: "Chọn một từ.",
      passage: null,
      options,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: { focus: "must-not-render" },
      orderIndex: 0,
    });

    expect(dto.options).toEqual([]);
    expect(serialized(dto)).not.toContain("must-not-render");
  });

  it("projects only the safe ordered Trios tuple without metadata or answer leakage", () => {
    const sharedWordSentinel = "H10_TRIOS_SHARED_WORD_9z3q";
    const source = {
      id: "trios-question",
      type: "TRIOS_GAPPED_SENTENCES",
      skillType: "TRIOS",
      difficulty: "C1",
      prompt: "Điền một từ chung.",
      passage: "Compatibility mirror.",
      options: null,
      answer: {
        accepted: [sharedWordSentinel],
        display: sharedWordSentinel,
      },
      explanation: EXPLANATION_SENTINEL,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: {
        sentences: [
          "First _____ sentence.",
          "Second _____ sentence.",
          "Third _____ sentence.",
        ],
        sharedWord: sharedWordSentinel,
        nested: { acceptedAnswers: [sharedWordSentinel] },
      },
      orderIndex: 0,
    } as LearnerQuestionSource & Record<string, unknown>;
    const metadataSnapshot = structuredClone(source.metadata);

    const dto = toLearnerQuestionDTO(source);

    expect(dto.triosSentences).toEqual([
      "First _____ sentence.",
      "Second _____ sentence.",
      "Third _____ sentence.",
    ]);
    expect(source.metadata).toEqual(metadataSnapshot);
    expect(serialized(dto)).not.toContain(sharedWordSentinel);
    expect(serialized(dto)).not.toContain(EXPLANATION_SENTINEL);
    expect(serialized(dto)).not.toContain("sharedWord");
    expect(serialized(dto)).not.toContain("acceptedAnswers");
    expect(dto).not.toHaveProperty("metadata");
    expect(dto).not.toHaveProperty("answer");
    expect(dto).not.toHaveProperty("explanation");
  });

  it.each([
    ["missing metadata", null],
    ["partial sentences", {
      sentences: ["First _____.", "Second _____."],
    }],
    ["invalid gap count", {
      sentences: ["First _____.", "Second _____ and _____.", "Third _____."],
    }],
  ])("returns null rather than partial Trios data for %s", (_name, metadata) => {
    const dto = toLearnerQuestionDTO({
      id: "malformed-trios",
      type: "TRIOS_GAPPED_SENTENCES",
      skillType: "TRIOS",
      difficulty: "C1",
      prompt: "Điền một từ chung.",
      passage: "1. Passage must not be parsed.\n2. It has three lines.\n3. Still not canonical.",
      options: null,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata,
      orderIndex: 0,
    });

    expect(dto.triosSentences).toBeNull();
  });

  it("sets triosSentences to null for every other question type", () => {
    const dto = toLearnerQuestionDTO({
      id: "ordinary-question",
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "C1",
      prompt: "Choose.",
      passage: null,
      options: [{ id: "A", text: "Visible" }],
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: {
        sentences: [
          "First _____.",
          "Second _____.",
          "Third _____.",
        ],
      },
      orderIndex: 0,
    });

    expect(dto.triosSentences).toBeNull();
  });

  it.each([
    ["legacy null options", null],
    ["fewer than four", [{ id: "A", text: "one" }]],
    ["duplicate IDs", [
      { id: "A", text: "one" },
      { id: " a ", text: "duplicate" },
      { id: "C", text: "three" },
      { id: "D", text: "four" },
    ]],
    ["invalid display text", [
      { id: "A", text: "one" },
      { id: "B", text: "two" },
      { id: "C", text: "three" },
      { id: "D", text: null },
    ]],
  ])("fails closed for Error Identification %s", (_name, options) => {
    const dto = toLearnerQuestionDTO({
      id: "malformed-error-question",
      type: "ERROR_IDENTIFICATION",
      skillType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      prompt: "Find the error.",
      passage: null,
      options,
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: null,
      orderIndex: 0,
    });

    expect(dto.options).toEqual([]);
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
