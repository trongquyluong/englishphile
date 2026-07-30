import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCsvText, normalizeJsonText } from "@/lib/import/normalize-file";
import { enforceImportPublicationContract } from "@/lib/import/publication-validation";
import type { ImportPlan, NormalizedImportPayload } from "@/lib/import/types";

const validOptions = [
  { label: " d ", text: "team", targetSpan: { start: 1, end: 3 } },
  { label: "b", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { label: " A ", text: "seat", targetSpan: { start: 1, end: 3 } },
  { label: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
];
const validAnswer = { correctOption: " c ", display: "not-authoritative" };

function jsonPayload(options: unknown, answer: unknown) {
  return JSON.stringify({
    sourceCollection: {
      name: "Pronunciation JSON fixture",
      sourceType: "JSON",
    },
    problems: [{
      title: "Pronunciation contract fixture",
      slug: "pronunciation-contract-fixture",
      skillType: "PRONUNCIATION",
      questionType: "PRONUNCIATION_ODD_ONE_OUT",
      difficulty: "C1",
      statement: "Chọn từ có phần gạch chân phát âm khác.",
      questions: [{
        type: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        difficulty: "C1",
        prompt: "Chọn một từ.",
        options,
        answer,
        metadata: { focus: "not-a-target-authority" },
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
    "Pronunciation CSV fixture",
    "Pronunciation CSV contract",
    "pronunciation-csv-contract",
    "PRONUNCIATION",
    "PRONUNCIATION_ODD_ONE_OUT",
    "C1",
    "Pronunciation",
    "Chọn từ có phần gạch chân phát âm khác.",
    "Chọn một đáp án.",
    "Chọn một từ.",
    "",
    csvCell(JSON.stringify(options)),
    csvCell(JSON.stringify(answer)),
    "Giải thích tương phản phát âm.",
    "",
    "",
    "",
    csvCell(JSON.stringify({ focus: "not-a-target-authority" })),
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

function normalizedPair(options: unknown, answer: unknown) {
  return {
    json: normalizeJsonText(jsonPayload(options, answer)),
    csv: normalizeCsvText(csvPayload(options, answer)),
  };
}

describe("Pronunciation JSON/CSV real-normalizer parity", () => {
  it("preserves spans and normalizes supported option/answer aliases", () => {
    const { json, csv } = normalizedPair(validOptions, validAnswer);

    expect(json.issues).toEqual([]);
    expect(csv.issues).toEqual([]);
    for (const normalized of [json.payload!, csv.payload]) {
      const question = normalized.problems[0]?.questions[0];
      expect(question?.options).toEqual([
        { label: " d ", id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
        { label: "b", id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
        { label: " A ", id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
        { label: "C", id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      ]);
      expect(question?.answer).toEqual({
        correctOption: " c ",
        correctOptionId: "C",
        display: "not-authoritative",
      });
    }
  });

  it.each([
    ["options required", null, "PRONUNCIATION_OPTIONS_REQUIRED", "options"],
    ["option count", validOptions.slice(1), "PRONUNCIATION_OPTION_COUNT_NOT_FOUR", "options"],
    ["invalid ID", [{ ...validOptions[0], label: 1 }, ...validOptions.slice(1)], "PRONUNCIATION_INVALID_OPTION_ID", "options.0.id"],
    ["duplicate ID", [{ ...validOptions[0], label: "A" }, ...validOptions.slice(1)], "PRONUNCIATION_DUPLICATE_OPTION_ID", "options"],
    ["blank text", [{ ...validOptions[0], text: " " }, ...validOptions.slice(1)], "PRONUNCIATION_INVALID_OPTION_TEXT", "options.0.text"],
    ["object text", [{ ...validOptions[0], text: { unsafe: true } }, ...validOptions.slice(1)], "PRONUNCIATION_INVALID_OPTION_TEXT", "options.0.text"],
    ["missing span", [{ label: "D", text: "team" }, ...validOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_REQUIRED", "options.0.targetSpan"],
    ["non-object span", [{ ...validOptions[0], targetSpan: "1-3" }, ...validOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_INVALID_OBJECT", "options.0.targetSpan"],
    ["missing start", [{ ...validOptions[0], targetSpan: { end: 3 } }, ...validOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_START_REQUIRED", "options.0.targetSpan.start"],
    ["malformed end", [{ ...validOptions[0], targetSpan: { start: 1, end: "3" } }, ...validOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_END_INVALID", "options.0.targetSpan.end"],
    ["invalid range", [{ ...validOptions[0], targetSpan: { start: 3, end: 3 } }, ...validOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_RANGE_INVALID", "options.0.targetSpan"],
    ["no letter", [{ ...validOptions[0], text: "a-b", targetSpan: { start: 1, end: 2 } }, ...validOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_WITHOUT_LETTER", "options.0.targetSpan"],
  ])("retains %s as an exact-location NEEDS_REVIEW warning", (_name, options, code, suffix) => {
    const { json, csv } = normalizedPair(options, validAnswer);

    expect(json.payload?.problems[0]?.questions).toHaveLength(1);
    expect(csv.payload.problems[0]?.questions).toHaveLength(1);
    expect(json.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "warning",
        code,
        path: `problems.0.questions.0.${suffix}`,
      }),
    ]));
    expect(csv.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "warning",
        code,
        path: `rows.2.question.${suffix}`,
      }),
    ]));
    expect(json.issues.some((candidate) => candidate.level === "error")).toBe(false);
    expect(csv.issues.some((candidate) => candidate.level === "error")).toBe(false);
  });

  it.each([
    ["missing answer", null, "PRONUNCIATION_ANSWER_REQUIRED", "answer"],
    ["missing configured answer", {}, "PRONUNCIATION_CORRECT_OPTION_REQUIRED", "answer.correctOptionId"],
    ["blank configured answer", { correctOption: " " }, "PRONUNCIATION_CORRECT_OPTION_REQUIRED", "answer.correctOptionId"],
    ["malformed configured answer", { correctOptionId: 1 }, "PRONUNCIATION_CORRECT_OPTION_REQUIRED", "answer.correctOptionId"],
    ["non-member configured answer", { correctOption: "E" }, "PRONUNCIATION_CORRECT_OPTION_INVALID", "answer.correctOptionId"],
  ])("rejects %s as an exact-location fatal error", (_name, answer, code, suffix) => {
    const { json, csv } = normalizedPair(validOptions, answer);

    expect(json.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code,
        path: `problems.0.questions.0.${suffix}`,
      }),
    ]));
    expect(csv.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code,
        path: `rows.2.question.${suffix}`,
      }),
    ]));
    expect(json.payload?.problems).toEqual([]);
    expect(csv.payload.problems).toEqual([]);
  });

  it("keeps answer membership fatal when a canonical member is absent", () => {
    const options = validOptions.map((candidate) => ({ ...candidate }));
    options[0] = { ...options[0], label: "C" };
    const { json, csv } = normalizedPair(options, {
      correctOptionId: "D",
    });

    for (const issues of [json.issues, csv.issues]) {
      expect(issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          code: "PRONUNCIATION_CORRECT_OPTION_NOT_IN_OPTIONS",
        }),
      ]));
    }
  });

  it("promotes contract warnings exactly once at immediate publication", () => {
    const options = validOptions.map(({ label, text }) => ({ label, text }));
    const normalized = normalizeJsonText(jsonPayload(options, validAnswer));
    const plan = importPlan(normalized.payload!, normalized.issues);

    const draft = enforceImportPublicationContract(plan, "NEEDS_REVIEW");
    const published = enforceImportPublicationContract(plan, "PUBLISHED");

    expect(draft.ok).toBe(true);
    expect(draft.summary.warnings).toBe(4);
    expect(published.ok).toBe(false);
    expect(published.summary.warnings).toBe(0);
    expect(published.summary.errors).toBe(4);
    expect(published.issues).toHaveLength(4);
    expect(published.issues.every(
      (candidate) =>
        candidate.level === "error" &&
        candidate.code === "PRONUNCIATION_TARGET_SPAN_REQUIRED",
    )).toBe(true);
  });

  it("retains all 30 current questions with exactly 120 target warnings", () => {
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "content-packs/pilot-pack-001/01-pronunciation-pack-001.json",
      ),
      "utf8",
    );
    const normalized = normalizeJsonText(file);
    const questions = normalized.payload?.problems.reduce(
      (total, problem) => total + problem.questions.length,
      0,
    );
    const targetWarnings = normalized.issues.filter(
      (candidate) =>
        candidate.level === "warning" &&
        candidate.code === "PRONUNCIATION_TARGET_SPAN_REQUIRED",
    );

    expect(normalized.issues.some((candidate) => candidate.level === "error"))
      .toBe(false);
    expect(questions).toBe(30);
    expect(targetWarnings).toHaveLength(120);
    expect(targetWarnings.every((candidate) =>
      /^problems\.\d+\.questions\.\d+\.options\.[0-3]\.targetSpan$/.test(
        candidate.path,
      ),
    )).toBe(true);
  });
});
