import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toAdminProblemPreviewDTO } from "@/lib/dto/admin-problem-preview";

describe("Phase 1D-A admin preview runtime regression", () => {
  it("keeps complete answer-key fields in the explicitly admin-only mapper", () => {
    const answerSentinel = "H10_ADMIN_CANONICAL_8c1p";
    const result = toAdminProblemPreviewDTO({
      id: "p1",
      title: "Admin preview",
      slug: "admin-preview",
      skillType: "MULTIPLE_CHOICE",
      questionType: "MCQ",
      difficulty: "C1",
      contentStatus: "PUBLISHED",
      statement: "Statement",
      instructions: null,
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: null,
      problemTopics: [],
      questions: [{
        id: "q1",
        type: "MCQ",
        skillType: "MULTIPLE_CHOICE",
        difficulty: "C1",
        prompt: "Prompt",
        passage: null,
        options: [{ id: "A", text: "Choice", correct: true }],
        answer: { correctOptionId: "A", sentinel: answerSentinel },
        explanation: answerSentinel,
        rootWord: null,
        keyword: null,
        targetSentence: null,
        lineNumber: null,
        metadata: { editorNote: answerSentinel },
        orderIndex: 0,
      }],
    });

    expect(JSON.stringify(result)).toContain(answerSentinel);
    expect(result.questions[0]?.answer).toEqual({ correctOptionId: "A", sentinel: answerSentinel });
    expect(result.questions[0]?.rawOptions).toEqual([{ id: "A", text: "Choice", correct: true }]);
  });

  it("provides canonical Error Identification render data while retaining admin-only answer data", () => {
    const result = toAdminProblemPreviewDTO({
      id: "error-problem",
      title: "Error Identification preview",
      slug: "error-identification-preview",
      skillType: "ERROR_IDENTIFICATION",
      questionType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      contentStatus: "NEEDS_REVIEW",
      statement: "Chọn phần sai.",
      instructions: "Chọn A-D và sửa lại.",
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: null,
      problemTopics: [],
      questions: [{
        id: "error-question",
        type: "ERROR_IDENTIFICATION",
        skillType: "ERROR_IDENTIFICATION",
        difficulty: "C1",
        prompt: "The students was ready.",
        passage: null,
        options: [
          { id: "d", text: "today" },
          { id: "b", text: "was" },
          { id: " a ", text: "The students" },
          { id: "C", text: "ready" },
        ],
        answer: { correctPart: "B", correction: "were" },
        explanation: "Students là số nhiều.",
        rootWord: null,
        keyword: null,
        targetSentence: null,
        lineNumber: null,
        metadata: null,
        orderIndex: 0,
      }],
    });

    expect(result.questions[0]?.options.map((option) => option.id))
      .toEqual(["A", "B", "C", "D"]);
    expect(result.questions[0]?.answer).toEqual({
      correctPart: "B",
      correction: "were",
    });
    expect(result.questions[0]?.rawOptions).toEqual([
      { id: "d", text: "today" },
      { id: "b", text: "was" },
      { id: " a ", text: "The students" },
      { id: "C", text: "ready" },
    ]);
  });
});
