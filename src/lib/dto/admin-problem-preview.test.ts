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

  it("uses the safe Trios tuple for rendering while retaining raw admin repair data", () => {
    const sharedWord = "ADMIN_ONLY_SHARED_WORD";
    const metadata = {
      sentences: [
        "First _____ sentence.",
        "Second _____ sentence.",
        "Third _____ sentence.",
      ],
      sharedWord,
      editorNote: "Admin repair note",
    };
    const result = toAdminProblemPreviewDTO({
      id: "trios-problem",
      title: "Trios preview",
      slug: "trios-preview",
      skillType: "TRIOS",
      questionType: "TRIOS_GAPPED_SENTENCES",
      difficulty: "C1",
      contentStatus: "NEEDS_REVIEW",
      statement: "Điền một từ chung.",
      instructions: null,
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: null,
      problemTopics: [],
      questions: [{
        id: "trios-question",
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        difficulty: "C1",
        prompt: "Điền một từ.",
        passage: "Compatibility mirror.",
        options: null,
        answer: { accepted: [sharedWord] },
        explanation: "Admin explanation.",
        rootWord: null,
        keyword: null,
        targetSentence: null,
        lineNumber: null,
        metadata,
        orderIndex: 0,
      }],
    });

    expect(result.questions[0]?.triosSentences).toEqual(metadata.sentences);
    expect(result.questions[0]?.metadata).toEqual(metadata);
    expect(result.questions[0]?.answer).toEqual({ accepted: [sharedWord] });
    expect(JSON.stringify(result)).toContain(sharedWord);
  });

  it("uses safe Pronunciation spans while retaining admin-only repair data", () => {
    const sentinel = "ADMIN_PRONUNCIATION_REPAIR_ONLY";
    const rawOptions = [
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 }, note: sentinel },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
    ];
    const result = toAdminProblemPreviewDTO({
      id: "pronunciation-problem",
      title: "Pronunciation preview",
      slug: "pronunciation-preview",
      skillType: "PRONUNCIATION",
      questionType: "PRONUNCIATION_ODD_ONE_OUT",
      difficulty: "C1",
      contentStatus: "NEEDS_REVIEW",
      statement: "Chọn từ khác.",
      instructions: null,
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: null,
      problemTopics: [],
      questions: [{
        id: "pronunciation-question",
        type: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        difficulty: "C1",
        prompt: "Chọn một từ.",
        passage: null,
        options: rawOptions,
        answer: { correctOptionId: "C", sentinel },
        explanation: sentinel,
        rootWord: null,
        keyword: null,
        targetSentence: null,
        lineNumber: null,
        metadata: { focus: sentinel },
        orderIndex: 0,
      }],
    });

    expect(result.questions[0]?.options).toEqual([
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
    ]);
    expect(result.questions[0]?.rawOptions).toEqual(rawOptions);
    expect(result.questions[0]?.answer).toEqual({
      correctOptionId: "C",
      sentinel,
    });
    expect(result.questions[0]?.metadata).toEqual({ focus: sentinel });
    expect(JSON.stringify(result)).toContain(sentinel);
  });

  it("keeps malformed Pronunciation options for admin repair but emits no partial renderer choices", () => {
    const rawOptions = [
      { id: "A", text: "seat" },
      { id: "B", text: "leaf" },
      { id: "C", text: "bread" },
      { id: "D", text: "team" },
    ];
    const result = toAdminProblemPreviewDTO({
      id: "malformed-pronunciation-problem",
      title: "Malformed Pronunciation preview",
      slug: "malformed-pronunciation-preview",
      skillType: "PRONUNCIATION",
      questionType: "PRONUNCIATION_ODD_ONE_OUT",
      difficulty: "C1",
      contentStatus: "NEEDS_REVIEW",
      statement: "Chọn từ khác.",
      instructions: null,
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: null,
      problemTopics: [],
      questions: [{
        id: "malformed-pronunciation-question",
        type: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        difficulty: "C1",
        prompt: "Chọn một từ.",
        passage: null,
        options: rawOptions,
        answer: { correctOptionId: "C" },
        explanation: null,
        rootWord: null,
        keyword: null,
        targetSentence: null,
        lineNumber: null,
        metadata: { focus: "repair-only" },
        orderIndex: 0,
      }],
    });

    expect(result.questions[0]?.options).toEqual([]);
    expect(result.questions[0]?.rawOptions).toEqual(rawOptions);
    expect(result.questions[0]?.metadata).toEqual({ focus: "repair-only" });
  });

  it("keeps malformed Trios metadata for admin repair but emits no partial render tuple", () => {
    const metadata = {
      sentences: ["First _____.", "Second without a gap.", "Third _____."],
      sharedWord: "repair-only",
    };
    const result = toAdminProblemPreviewDTO({
      id: "malformed-trios-problem",
      title: "Malformed Trios preview",
      slug: "malformed-trios-preview",
      skillType: "TRIOS",
      questionType: "TRIOS_GAPPED_SENTENCES",
      difficulty: "C1",
      contentStatus: "NEEDS_REVIEW",
      statement: "Điền một từ chung.",
      instructions: null,
      estimatedMinutes: 5,
      acceptanceRate: null,
      sourceCollection: null,
      problemTopics: [],
      questions: [{
        id: "malformed-trios-question",
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        difficulty: "C1",
        prompt: "Điền một từ.",
        passage: null,
        options: null,
        answer: { accepted: ["repair-only"] },
        explanation: null,
        rootWord: null,
        keyword: null,
        targetSentence: null,
        lineNumber: null,
        metadata,
        orderIndex: 0,
      }],
    });

    expect(result.questions[0]?.triosSentences).toBeNull();
    expect(result.questions[0]?.metadata).toEqual(metadata);
  });
});
