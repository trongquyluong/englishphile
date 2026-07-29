import { describe, expect, it } from "vitest";
import {
  auditContentPacks,
  SHORT_EXPLANATION_THRESHOLD,
  type ContentPackAuditInput,
} from "@/lib/content-audit";

function question(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "MCQ",
    skillType: "MULTIPLE_CHOICE",
    difficulty: "CHUYEN",
    prompt: "Choose the best answer for this substantive test prompt.",
    options: [
      { id: "A", text: "One" },
      { id: "B", text: "Two" },
      { id: "C", text: "Three" },
      { id: "D", text: "Four" },
    ],
    answer: { correctOptionId: "A" },
    explanation: "A sufficiently detailed explanation for the learner to review.",
    ...overrides,
  };
}

function problem(
  questions: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: "Test problem",
    slug: "test-problem",
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "CHUYEN",
    statement: "Complete the questions.",
    instructions: "Choose one option.",
    questions,
    ...overrides,
  };
}

function pack(
  problems: Record<string, unknown>[],
  options: {
    manifest?: unknown;
    directory?: string;
    fileName?: string;
    payload?: unknown;
  } = {},
): ContentPackAuditInput {
  const fileName = options.fileName ?? "01-test.json";
  return {
    directory: options.directory ?? "test-pack",
    manifest:
      options.manifest ??
      ({
        packName: "Test pack",
        files: [
          {
            fileName,
            problemCount: problems.length,
            questionCount: problems.reduce(
              (total, item) =>
                total +
                (Array.isArray(item.questions) ? item.questions.length : 0),
              0,
            ),
          },
        ],
        totals: {
          fileCount: 1,
          problemCount: problems.length,
          questionCount: problems.reduce(
            (total, item) =>
              total +
              (Array.isArray(item.questions) ? item.questions.length : 0),
            0,
          ),
        },
      } satisfies Record<string, unknown>),
    files: [
      {
        fileName,
        payload: options.payload ?? { problems },
      },
    ],
  };
}

describe("content-pack repository audit", () => {
  it("counts inventory and both current manifest count shapes", () => {
    const modern = pack([problem([question(), question()])]);
    const legacy = pack([problem([question()], { slug: "legacy-problem" })], {
      directory: "legacy-pack",
      fileName: "01-legacy.json",
      manifest: {
        packName: "Legacy pack",
        totalIndividualFiles: 1,
        totalProblems: 1,
        totalQuestions: 1,
        files: [
          {
            file: "01-legacy.json",
            problems: 1,
            questions: 1,
          },
        ],
      },
    });

    const report = auditContentPacks([modern, legacy]);

    expect(report.inventory).toEqual({
      packs: 2,
      splitFiles: 2,
      problems: 2,
      questions: 3,
      optionQuestions: 3,
    });
    expect(report.bySkill.MULTIPLE_CHOICE).toEqual({
      problems: 2,
      questions: 3,
    });
    expect(report.byQuestionType.MCQ).toBe(3);
    expect(report.byDifficulty.CHUYEN).toEqual({
      problems: 2,
      questions: 3,
    });
    expect(report.manifestMismatches).toEqual([]);
  });

  it("extracts answer positions from both answer and option aliases", () => {
    const report = auditContentPacks([
      pack([
        problem([
          question({
            options: [
              { label: "A", text: "One" },
              { label: "B", text: "Two" },
            ],
            answer: { correctOption: "B" },
          }),
          question({
            options: [
              { id: "first", text: "One" },
              { id: "second", text: "Two" },
            ],
            answer: { correctOptionId: "first" },
          }),
        ]),
      ]),
    ]);

    expect(report.answerPositions).toEqual({ A: 1, B: 1 });
    expect(report.findings.invalidCorrectOptions).toEqual([]);
  });

  it("treats explanations below 45 characters as a heuristic", () => {
    const report = auditContentPacks([
      pack([
        problem([
          question({ explanation: "x".repeat(SHORT_EXPLANATION_THRESHOLD - 1) }),
          question({ explanation: "x".repeat(SHORT_EXPLANATION_THRESHOLD) }),
          question({ explanation: " " }),
        ]),
      ]),
    ]);

    expect(report.findings.shortExplanations).toHaveLength(1);
    expect(report.findings.missingExplanations).toHaveLength(1);
    expect(report.hasInventoryErrors).toBe(false);
  });

  it("reports question/problem skill and difficulty mismatches", () => {
    const report = auditContentPacks([
      pack([
        problem([
          question({ skillType: "READING", difficulty: "C1" }),
        ]),
      ]),
    ]);

    expect(report.findings.skillMismatches).toHaveLength(1);
    expect(report.findings.difficultyMismatches).toHaveLength(1);
  });

  it("reports missing and non-member correct options", () => {
    const report = auditContentPacks([
      pack([
        problem([
          question({ answer: {} }),
          question({ answer: { correctOptionId: "Z" } }),
        ]),
      ]),
    ]);

    expect(report.findings.invalidCorrectOptions).toHaveLength(2);
    expect(report.answerPositions).toEqual({});
  });

  it("groups substantive exact duplicate prompts", () => {
    const duplicate =
      "This substantive prompt is deliberately repeated across two problems.";
    const report = auditContentPacks([
      pack([
        problem([question({ prompt: duplicate })]),
        problem([question({ prompt: `  ${duplicate.toUpperCase()}  ` })], {
          slug: "second-problem",
        }),
      ]),
    ]);

    expect(report.findings.duplicatePromptGroups).toHaveLength(1);
    expect(report.findings.duplicatePromptGroups[0].occurrences).toBe(2);
  });

  it("excludes generic Trios and Pronunciation boilerplate", () => {
    const pronunciationPrompt =
      "Choose the word whose underlined part is pronounced differently.";
    const triosPrompt =
      "Find one word which can be used appropriately in all three sentences.";
    const report = auditContentPacks([
      pack([
        problem(
          [
            question({
              type: "PRONUNCIATION_ODD_ONE_OUT",
              skillType: "PRONUNCIATION",
              prompt: pronunciationPrompt,
            }),
            question({
              type: "PRONUNCIATION_ODD_ONE_OUT",
              skillType: "PRONUNCIATION",
              prompt: pronunciationPrompt,
            }),
          ],
          { skillType: "PRONUNCIATION" },
        ),
        problem(
          [
            question({
              type: "TRIOS_GAPPED_SENTENCES",
              skillType: "TRIOS",
              prompt: triosPrompt,
              metadata: { sentences: ["One.", "Two.", "Three."] },
            }),
            question({
              type: "TRIOS_GAPPED_SENTENCES",
              skillType: "TRIOS",
              prompt: triosPrompt,
              metadata: { sentences: ["Four.", "Five.", "Six."] },
            }),
          ],
          { skillType: "TRIOS", slug: "trios-problem" },
        ),
      ]),
    ]);

    expect(report.findings.duplicatePromptGroups).toEqual([]);
  });

  it("reports malformed payloads and manifest count mismatches", () => {
    const malformed = pack([], {
      payload: { problems: "not-an-array" },
      manifest: {
        packName: "Broken pack",
        files: [
          {
            file: "01-test.json",
            problems: 2,
            questions: 8,
          },
        ],
        totalIndividualFiles: 2,
        totalProblems: 2,
        totalQuestions: 8,
      },
    });

    const report = auditContentPacks([malformed]);

    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "payload.problems" }),
      ]),
    );
    expect(report.manifestMismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "files", expected: 2, actual: 1 }),
        expect.objectContaining({ field: "problems", expected: 2, actual: 0 }),
        expect.objectContaining({ field: "questions", expected: 8, actual: 0 }),
      ]),
    );
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("rejects unsafe and unsupported manifest entries", () => {
    const report = auditContentPacks([
      {
        directory: "unsafe-pack",
        manifest: {
          files: [
            { file: "../escape.json" },
            { fileName: "00-all-in-one-pack.json" },
            { fileName: "notes.csv" },
          ],
        },
        files: [],
      },
    ]);

    expect(report.inventory.splitFiles).toBe(0);
    expect(report.malformedInputs).toHaveLength(3);
    expect(report.hasInventoryErrors).toBe(true);
  });
});
