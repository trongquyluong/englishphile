import { describe, expect, it } from "vitest";
import { normalizeCsvText, normalizeJsonText } from "@/lib/import/normalize-file";
import { enforceImportPublicationContract } from "@/lib/import/publication-validation";
import type { ImportPlan, NormalizedImportPayload } from "@/lib/import/types";

const validOptions = [
  { id: " a ", text: "The students" },
  { id: "b", text: "was" },
  { id: " C ", text: "ready" },
  { id: "d", text: 4 },
];

function jsonPayload(question: Record<string, unknown>) {
  return JSON.stringify({
    sourceCollection: {
      name: "Error Identification fixture",
      sourceType: "JSON",
    },
    problems: [{
      title: "Contract fixture",
      slug: "contract-fixture",
      skillType: "ERROR_IDENTIFICATION",
      questionType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      statement: "Chọn phần sai và sửa lại.",
      questions: [{
        type: "ERROR_IDENTIFICATION",
        skillType: "ERROR_IDENTIFICATION",
        difficulty: "C1",
        prompt: "The students was ready today.",
        ...question,
      }],
    }],
  });
}

const csvHeader = [
  "sourceName", "problemTitle", "problemSlug", "skillType",
  "questionType", "difficulty", "topicTags", "statement",
  "instructions", "prompt", "passage", "optionsJson", "answerJson",
  "explanation", "rootWord", "keyword", "targetSentence", "metadataJson",
];

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function csvPayload(options: unknown, answer: unknown) {
  const row = [
    "CSV source", "CSV contract", "csv-contract", "ERROR_IDENTIFICATION",
    "ERROR_IDENTIFICATION", "C1", "Grammar", "Chọn phần sai.",
    "Chọn A-D.", "The students was ready.", "",
    csvCell(JSON.stringify(options)),
    csvCell(JSON.stringify(answer)),
    "Agreement.", "", "", "", "",
  ];
  return `${csvHeader.join(",")}\n${row.join(",")}`;
}

function importPlan(
  payload: NormalizedImportPayload,
  issues: ImportPlan["issues"],
): ImportPlan {
  const errors = issues.filter((candidate) => candidate.level === "error").length;
  const warnings = issues.filter((candidate) => candidate.level === "warning").length;
  return {
    ok: errors === 0,
    importType: payload.importType,
    payload,
    issues,
    preview: [],
    summary: {
      sourceCollectionsToCreate: 1,
      sourceCollectionsReused: 0,
      topicsToCreate: 0,
      topicsReused: 0,
      problemsToCreate: payload.problems.length,
      questionsToCreate: payload.problems.reduce(
        (total, problem) => total + problem.questions.length,
        0,
      ),
      duplicateProblemsSkipped: 0,
      duplicateQuestionsSkipped: 0,
      exactDuplicateQuestionsSkipped: 0,
      highSimilarityQuestionsSkipped: 0,
      possibleDuplicateQuestionsFlagged: 0,
      problemsImported: 0,
      questionsImported: 0,
      errors,
      warnings,
    },
  };
}

describe("Error Identification JSON/CSV normalization and import policy", () => {
  it("normalizes canonical option IDs, numeric display text, and errorPart alias", () => {
    const normalized = normalizeJsonText(jsonPayload({
      options: validOptions,
      answer: { errorPart: " b ", correction: " were " },
    }));

    expect(normalized.issues).toEqual([]);
    expect(normalized.payload?.problems[0]?.questions[0]).toEqual(
      expect.objectContaining({
        options: [
          { id: "A", text: "The students" },
          { id: "B", text: "was" },
          { id: "C", text: "ready" },
          { id: "D", text: "4" },
        ],
        answer: { correctPart: "B", correction: "were" },
      }),
    );
  });

  it("retains missing legacy options for NEEDS_REVIEW with actionable warnings", () => {
    const normalized = normalizeJsonText(jsonPayload({
      options: null,
      answer: { errorPart: "A", correction: "were" },
    }));

    expect(normalized.payload?.problems[0]?.questions).toHaveLength(1);
    expect(normalized.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "warning",
        path: "problems.0.questions.0.options",
        code: "ERROR_IDENTIFICATION_OPTIONS_REQUIRED",
      }),
    ]));
    expect(normalized.issues).toHaveLength(1);
    expect(normalized.issues.some((candidate) => candidate.level === "error"))
      .toBe(false);
  });

  it.each([
    [
      "duplicate canonical IDs",
      [validOptions[0], { id: " A ", text: "duplicate" }, validOptions[2], validOptions[3]],
      "ERROR_IDENTIFICATION_DUPLICATE_OPTION_ID",
    ],
    [
      "non A-D ID",
      [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "other" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_ID",
    ],
    [
      "invalid display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: null }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_TEXT",
    ],
  ])("surfaces %s at the exact question location", (_name, options, code) => {
    const normalized = normalizeJsonText(jsonPayload({
      options,
      answer: { correctPart: "A", correction: "replacement" },
    }));

    expect(normalized.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "warning",
        path: expect.stringMatching(/^problems\.0\.questions\.0\.options/),
        code,
      }),
    ]));
  });

  it("keeps missing correction as a fatal import error", () => {
    const normalized = normalizeJsonText(jsonPayload({
      options: validOptions,
      answer: { correctPart: "A" },
    }));

    expect(normalized.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        path: "problems.0.questions.0.answer.correction",
        code: "ERROR_IDENTIFICATION_CORRECTION_REQUIRED",
      }),
    ]));
  });

  it("applies the same contract to CSV optionsJson and answerJson", () => {
    const normalized = normalizeCsvText(csvPayload(
      validOptions,
      { errorPart: "b", correction: "were" },
    ));

    expect(normalized.issues).toEqual([]);
    expect(normalized.payload.problems[0]?.questions[0]).toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ id: "A" }),
          expect.objectContaining({ id: "D", text: "4" }),
        ]),
        answer: { correctPart: "B", correction: "were" },
      }),
    );
  });

  it.each([
    ["null options", null, "ERROR_IDENTIFICATION_OPTIONS_REQUIRED", "rows.2.question.options"],
    [
      "wrong option count",
      validOptions.slice(0, 3),
      "ERROR_IDENTIFICATION_OPTION_COUNT_NOT_FOUR",
      "rows.2.question.options",
    ],
    [
      "duplicate canonical ID",
      [validOptions[0], { id: " a ", text: "duplicate" }, validOptions[2], validOptions[3]],
      "ERROR_IDENTIFICATION_DUPLICATE_OPTION_ID",
      "rows.2.question.options",
    ],
    [
      "non A-D ID",
      [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "other" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_ID",
      "rows.2.question.options.3.id",
    ],
    [
      "blank display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: " " }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_TEXT",
      "rows.2.question.options.3.text",
    ],
  ])("keeps CSV %s as an actionable NEEDS_REVIEW warning", (_name, options, code, path) => {
    const normalized = normalizeCsvText(csvPayload(
      options,
      { correctPart: "A", correction: "fixed" },
    ));

    expect(normalized.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "warning", code, path }),
    ]));
    expect(normalized.issues.some((candidate) => candidate.level === "error"))
      .toBe(false);
    expect(normalized.payload.problems[0]?.questions).toHaveLength(1);
    if (options === null) {
      expect(normalized.payload.problems[0]?.questions[0]?.options).toBeNull();
    }
  });

  it("keeps a syntactically present invalid CSV correctPart as a warning", () => {
    const normalized = normalizeCsvText(csvPayload(
      validOptions,
      { correctPart: "OK", correction: "fixed" },
    ));

    expect(normalized.payload.problems[0]?.questions).toHaveLength(1);
    expect(normalized.issues).toEqual([
      expect.objectContaining({
        level: "warning",
        code: "ERROR_IDENTIFICATION_CORRECT_PART_INVALID",
        path: "rows.2.question.answer.correctPart",
      }),
    ]);
  });

  it.each([
    ["missing correctPart", { correction: "fixed" }, "ERROR_IDENTIFICATION_CORRECT_PART_REQUIRED", "rows.2.question.answer.correctPart"],
    ["blank correctPart", { correctPart: " ", correction: "fixed" }, "ERROR_IDENTIFICATION_CORRECT_PART_REQUIRED", "rows.2.question.answer.correctPart"],
    ["blank correction", { correctPart: "A", correction: " " }, "ERROR_IDENTIFICATION_CORRECTION_REQUIRED", "rows.2.question.answer.correction"],
    ["over-bound correction", { correctPart: "A", correction: "x".repeat(1001) }, "ERROR_IDENTIFICATION_CORRECTION_TOO_LONG", "rows.2.question.answer.correction"],
  ])("rejects CSV %s as a fatal import error", (_name, answer, code, path) => {
    const normalized = normalizeCsvText(csvPayload(validOptions, answer));

    expect(normalized.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "error", code, path }),
    ]));
    expect(normalized.payload.problems).toEqual([]);
  });

  it("promotes draft warnings to publication errors only for immediate PUBLISHED import", () => {
    const normalized = normalizeJsonText(jsonPayload({
      options: null,
      answer: { correctPart: "A", correction: "were" },
    }));
    const plan = importPlan(normalized.payload!, normalized.issues);

    const needsReview = enforceImportPublicationContract(plan, "NEEDS_REVIEW");
    const published = enforceImportPublicationContract(plan, "PUBLISHED");

    expect(needsReview.ok).toBe(true);
    expect(needsReview.summary.errors).toBe(0);
    expect(published.ok).toBe(false);
    expect(published.summary.errors).toBeGreaterThan(0);
    expect(published.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        path: "problems.contract-fixture.questions.0.options",
      }),
    ]));
  });

  it("never drops fatal Error Identification import errors at publication time", () => {
    const normalized = normalizeJsonText(jsonPayload({
      options: validOptions,
      answer: { correctPart: "A" },
    }));
    const plan = importPlan(normalized.payload!, normalized.issues);
    const published = enforceImportPublicationContract(plan, "PUBLISHED");

    expect(published.ok).toBe(false);
    expect(published.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code: "ERROR_IDENTIFICATION_CORRECTION_REQUIRED",
      }),
    ]));
  });
});
