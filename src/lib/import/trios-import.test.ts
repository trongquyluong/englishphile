import { describe, expect, it } from "vitest";
import { normalizeCsvText, normalizeJsonText } from "@/lib/import/normalize-file";
import { enforceImportPublicationContract } from "@/lib/import/publication-validation";
import type { ImportPlan, NormalizedImportPayload } from "@/lib/import/types";

const validSentences = [
  "The committee reached a _____ after two hours.",
  "Her silence led me to the wrong _____.",
  "The evidence points to one _____.",
];
const validMetadata = { sentences: validSentences };
const validAnswer = { accepted: ["conclusion"], display: "conclusion" };

function jsonPayload(metadata: unknown, answer: unknown) {
  return JSON.stringify({
    sourceCollection: {
      name: "Trios JSON fixture",
      sourceType: "JSON",
    },
    problems: [{
      title: "Trios contract fixture",
      slug: "trios-contract-fixture",
      skillType: "TRIOS",
      questionType: "TRIOS_GAPPED_SENTENCES",
      difficulty: "C1",
      statement: "Điền một từ chung.",
      questions: [{
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        difficulty: "C1",
        prompt: "Điền một từ duy nhất phù hợp với cả ba câu.",
        passage: "Compatibility mirror only.",
        metadata,
        answer,
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

function csvPayload(metadata: unknown, answer: unknown) {
  const row = [
    "Trios CSV fixture",
    "Trios CSV contract",
    "trios-csv-contract",
    "TRIOS",
    "TRIOS_GAPPED_SENTENCES",
    "C1",
    "Trios",
    "Điền một từ chung.",
    "Dùng đúng một từ.",
    "Điền một từ duy nhất phù hợp với cả ba câu.",
    "Compatibility mirror only.",
    "",
    csvCell(JSON.stringify(answer)),
    "Shared collocation.",
    "",
    "",
    "",
    csvCell(JSON.stringify(metadata)),
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

describe("Trios JSON/CSV normalization parity", () => {
  it("accepts canonical metadata and one accepted shared word in both formats", () => {
    const json = normalizeJsonText(jsonPayload(validMetadata, validAnswer));
    const csv = normalizeCsvText(csvPayload(validMetadata, validAnswer));

    expect(json.issues).toEqual([]);
    expect(csv.issues).toEqual([]);
    expect(json.payload?.problems[0]?.questions[0]).toEqual(
      expect.objectContaining({
        metadata: validMetadata,
        answer: {
          accepted: ["conclusion"],
          acceptedAnswers: ["conclusion"],
          display: "conclusion",
        },
      }),
    );
    expect(csv.payload.problems[0]?.questions[0]).toEqual(
      expect.objectContaining({
        metadata: validMetadata,
        answer: {
          accepted: ["conclusion"],
          acceptedAnswers: ["conclusion"],
          display: "conclusion",
        },
      }),
    );
  });

  it.each([
    ["missing metadata", null, "TRIOS_METADATA_REQUIRED", "metadata"],
    ["missing sentences", {}, "TRIOS_SENTENCES_REQUIRED", "metadata.sentences"],
    ["non-array sentences", { sentences: "three" }, "TRIOS_SENTENCES_NOT_ARRAY", "metadata.sentences"],
    ["two sentences", { sentences: validSentences.slice(0, 2) }, "TRIOS_SENTENCE_COUNT_NOT_THREE", "metadata.sentences"],
    ["four sentences", { sentences: [...validSentences, "Fourth _____."] }, "TRIOS_SENTENCE_COUNT_NOT_THREE", "metadata.sentences"],
    ["empty sentence", { sentences: [validSentences[0], "", validSentences[2]] }, "TRIOS_SENTENCE_EMPTY", "metadata.sentences.1"],
    ["non-string sentence", { sentences: [validSentences[0], 2, validSentences[2]] }, "TRIOS_SENTENCE_NOT_STRING", "metadata.sentences.1"],
    ["missing gap", { sentences: [validSentences[0], "No gap.", validSentences[2]] }, "TRIOS_GAP_MARKER_REQUIRED", "metadata.sentences.1"],
    ["two gaps", { sentences: [validSentences[0], "First _____ and second _____.", validSentences[2]] }, "TRIOS_GAP_MARKER_INVALID", "metadata.sentences.1"],
  ])("retains %s as an exact-location NEEDS_REVIEW warning", (_name, metadata, code, suffix) => {
    const json = normalizeJsonText(jsonPayload(metadata, validAnswer));
    const csv = normalizeCsvText(csvPayload(metadata, validAnswer));

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
    ["missing accepted answer", {}, "TRIOS_ACCEPTED_REQUIRED", "answer.acceptedAnswers"],
    ["blank accepted answer", { accepted: [" "] }, "TRIOS_ACCEPTED_EMPTY", "answer.accepted.0"],
    ["multiple accepted answers", { accepted: ["one", "two"] }, "TRIOS_ACCEPTED_COUNT_NOT_ONE", "answer.accepted"],
    ["multiword accepted answer", { acceptedAnswers: ["in conclusion"] }, "TRIOS_ACCEPTED_MULTIWORD", "answer.acceptedAnswers.0"],
    ["malformed answer shape", ["conclusion"], "TRIOS_ANSWER_REQUIRED", "answer"],
    ["malformed accepted shape", { accepted: { word: "conclusion" } }, "TRIOS_ACCEPTED_SHAPE_INVALID", "answer.accepted"],
  ])("rejects %s as an exact-location fatal error", (_name, answer, code, suffix) => {
    const json = normalizeJsonText(jsonPayload(validMetadata, answer));
    const csv = normalizeCsvText(csvPayload(validMetadata, answer));

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

  it("promotes sentence warnings to errors only at immediate publication", () => {
    const normalized = normalizeJsonText(jsonPayload(null, validAnswer));
    const plan = importPlan(normalized.payload!, normalized.issues);

    const draft = enforceImportPublicationContract(plan, "NEEDS_REVIEW");
    const published = enforceImportPublicationContract(plan, "PUBLISHED");

    expect(draft.ok).toBe(true);
    expect(draft.issues).toEqual([
      expect.objectContaining({ level: "warning", code: "TRIOS_METADATA_REQUIRED" }),
    ]);
    expect(published.ok).toBe(false);
    expect(published.summary.warnings).toBe(0);
    expect(published.issues).toEqual([
      expect.objectContaining({
        level: "error",
        code: "TRIOS_METADATA_REQUIRED",
        path: "problems.trios-contract-fixture.questions.0.metadata",
      }),
    ]);
  });

  it("does not drop fatal answer issues while enforcing publication", () => {
    const normalized = normalizeJsonText(jsonPayload(validMetadata, { accepted: [] }));
    const payload: NormalizedImportPayload = {
      importType: "JSON",
      problems: [],
    };
    const plan = importPlan(payload, normalized.issues);
    const published = enforceImportPublicationContract(plan, "PUBLISHED");

    expect(published.ok).toBe(false);
    expect(published.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code: "TRIOS_ACCEPTED_COUNT_NOT_ONE",
      }),
    ]));
  });
});
