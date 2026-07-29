import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getContentQaReport } from "@/lib/content-packs/qa";

const validOptions = [
  { id: "A", text: "The students" },
  { id: "B", text: "was" },
  { id: "C", text: "ready" },
  { id: "D", text: "today" },
];

function storedProblem(
  options: unknown,
  answer: unknown = { correctPart: "B", correction: "were" },
) {
  return {
    id: "problem-error",
    title: "Error Identification QA fixture",
    slug: "error-identification-qa-fixture",
    contentStatus: "NEEDS_REVIEW",
    statement: "Chọn phần sai và sửa lại.",
    instructions: "Chọn một phần A-D.",
    estimatedMinutes: 5,
    questionType: "ERROR_IDENTIFICATION",
    sourceCollection: { id: "source", name: "Synthetic source" },
    problemTopics: [{ topic: { id: "topic", name: "Grammar", slug: "grammar" } }],
    questions: [{
      id: "question-error",
      problemId: "problem-error",
      type: "ERROR_IDENTIFICATION",
      skillType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      prompt: "The students was ready today.",
      passage: null,
      options,
      answer,
      explanation: "Students là chủ ngữ số nhiều.",
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: null,
      contentStatus: "NEEDS_REVIEW",
      reviewedAt: null,
      reviewedById: null,
      orderIndex: 2,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }],
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function database(problem: unknown) {
  return {
    problem: {
      findMany: vi.fn().mockResolvedValue([problem]),
    },
  };
}

describe("persisted Error Identification QA", () => {
  it("marks a complete A-D contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(validOptions)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR"))
      .toEqual([]);
  });

  it.each([
    ["legacy null options", null, "ERROR_IDENTIFICATION_OPTIONS_REQUIRED", "questions.2.options"],
    [
      "fewer than four options",
      validOptions.slice(0, 3),
      "ERROR_IDENTIFICATION_OPTION_COUNT_NOT_FOUR",
      "questions.2.options",
    ],
    [
      "more than four options",
      [...validOptions, { id: "A", text: "extra" }],
      "ERROR_IDENTIFICATION_OPTION_COUNT_NOT_FOUR",
      "questions.2.options",
    ],
    [
      "duplicate IDs",
      [validOptions[0], { id: " a ", text: "duplicate" }, validOptions[2], validOptions[3]],
      "ERROR_IDENTIFICATION_DUPLICATE_OPTION_ID",
      "questions.2.options",
    ],
    [
      "missing ID",
      [validOptions[0], validOptions[1], validOptions[2], { text: "today" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_ID",
      "questions.2.options.3.id",
    ],
    [
      "non A-D ID",
      [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "today" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_ID",
      "questions.2.options.3.id",
    ],
    [
      "missing display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: "" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_TEXT",
      "questions.2.options.3.text",
    ],
    [
      "malformed display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: {} }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_TEXT",
      "questions.2.options.3.text",
    ],
  ])("blocks %s with an actionable persisted location", async (_name, options, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(options)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        problemId: "problem-error",
        entityId: "question-error",
        path,
      }),
    ]));
  });

  it.each([
    [
      "missing correctPart",
      { correction: "were" },
      "ERROR_IDENTIFICATION_CORRECT_PART_REQUIRED",
      "questions.2.answer.correctPart",
    ],
    [
      "blank correctPart",
      { correctPart: " ", correction: "were" },
      "ERROR_IDENTIFICATION_CORRECT_PART_REQUIRED",
      "questions.2.answer.correctPart",
    ],
    [
      "non-member correctPart",
      { correctPart: "OK", correction: "were" },
      "ERROR_IDENTIFICATION_CORRECT_PART_INVALID",
      "questions.2.answer.correctPart",
    ],
    [
      "missing correction",
      { correctPart: "B" },
      "ERROR_IDENTIFICATION_CORRECTION_REQUIRED",
      "questions.2.answer.correction",
    ],
    [
      "blank correction",
      { correctPart: "B", correction: " " },
      "ERROR_IDENTIFICATION_CORRECTION_REQUIRED",
      "questions.2.answer.correction",
    ],
    [
      "too many correction variants",
      {
        correctPart: "B",
        correction: Array.from({ length: 9 }, (_, index) => `v${index}`).join("/"),
      },
      "ERROR_IDENTIFICATION_TOO_MANY_CORRECTION_VARIANTS",
      "questions.2.answer.correction",
    ],
    [
      "overlong correction variant",
      { correctPart: "B", correction: "x".repeat(241) },
      "ERROR_IDENTIFICATION_CORRECTION_VARIANT_TOO_LONG",
      "questions.2.answer.correction",
    ],
    [
      "overlong total correction",
      {
        correctPart: "B",
        correction: [
          "a".repeat(200),
          "b".repeat(200),
          "c".repeat(200),
          "d".repeat(200),
          "e".repeat(197),
        ].join("/"),
      },
      "ERROR_IDENTIFICATION_CORRECTION_TOO_LONG",
      "questions.2.answer.correction",
    ],
    [
      "empty slash segment",
      { correctPart: "B", correction: "were//had been" },
      "ERROR_IDENTIFICATION_CORRECTION_EMPTY_VARIANT",
      "questions.2.answer.correction",
    ],
  ])("blocks %s independently of valid options", async (_name, answer, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(validOptions, answer)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        path,
      }),
    ]));
  });

  it("blocks a correctPart that is absent from malformed persisted options", async () => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(
        [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "today" }],
        { correctPart: "D", correction: "were" },
      )) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code: "ERROR_IDENTIFICATION_CORRECT_PART_NOT_IN_OPTIONS",
        path: "questions.2.answer.correctPart",
      }),
    ]));
  });
});

const validTriosSentences = [
  "The committee reached a _____ after two hours.",
  "Her silence led me to the wrong _____.",
  "The evidence points to one _____.",
];

function storedTriosProblem(
  metadata: unknown,
  answer: unknown = { acceptedAnswers: ["conclusion"] },
) {
  const base = storedProblem(null);
  return {
    ...base,
    id: "problem-trios",
    title: "Trios QA fixture",
    slug: "trios-qa-fixture",
    statement: "Điền một từ chung.",
    instructions: "Dùng đúng một từ.",
    questionType: "TRIOS_GAPPED_SENTENCES",
    questions: [{
      ...base.questions[0],
      id: "question-trios",
      problemId: "problem-trios",
      type: "TRIOS_GAPPED_SENTENCES",
      skillType: "TRIOS",
      prompt: "Điền một từ duy nhất.",
      options: null,
      answer,
      metadata,
      orderIndex: 4,
    }],
  };
}

describe("persisted Trios QA", () => {
  it("marks the complete canonical contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedTriosProblem({
        sentences: validTriosSentences,
        sharedWord: "not-authoritative",
      })) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR"))
      .toEqual([]);
  });

  it.each([
    ["missing metadata", null, "TRIOS_METADATA_REQUIRED", "questions.4.metadata"],
    ["missing sentences", {}, "TRIOS_SENTENCES_REQUIRED", "questions.4.metadata.sentences"],
    ["wrong count", { sentences: validTriosSentences.slice(0, 2) }, "TRIOS_SENTENCE_COUNT_NOT_THREE", "questions.4.metadata.sentences"],
    ["malformed entry", { sentences: [validTriosSentences[0], 2, validTriosSentences[2]] }, "TRIOS_SENTENCE_NOT_STRING", "questions.4.metadata.sentences.1"],
    ["wrong gap count", { sentences: [validTriosSentences[0], "Two _____ gaps _____.", validTriosSentences[2]] }, "TRIOS_GAP_MARKER_INVALID", "questions.4.metadata.sentences.1"],
  ])("blocks %s with an exact persisted path", async (_name, metadata, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedTriosProblem(metadata)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        problemId: "problem-trios",
        entityId: "question-trios",
        path,
      }),
    ]));
  });

  it.each([
    ["missing answer", {}, "TRIOS_ACCEPTED_REQUIRED", "questions.4.answer.acceptedAnswers"],
    ["blank answer", { accepted: [" "] }, "TRIOS_ACCEPTED_EMPTY", "questions.4.answer.accepted.0"],
    ["multiple answers", { acceptedAnswers: ["one", "two"] }, "TRIOS_ACCEPTED_COUNT_NOT_ONE", "questions.4.answer.acceptedAnswers"],
    ["multiword answer", { accepted: ["in conclusion"] }, "TRIOS_ACCEPTED_MULTIWORD", "questions.4.answer.accepted.0"],
    ["malformed answer", ["conclusion"], "TRIOS_ANSWER_REQUIRED", "questions.4.answer"],
  ])("blocks %s independently of valid sentences", async (_name, answer, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedTriosProblem({ sentences: validTriosSentences }, answer)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "ERROR", code, path }),
    ]));
  });
});
