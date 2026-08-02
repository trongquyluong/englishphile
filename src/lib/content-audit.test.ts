import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditContentPacks,
  SHORT_EXPLANATION_THRESHOLD,
  type ContentPackAuditInput,
} from "@/lib/content-audit";
import { selectImportFiles } from "@/lib/content-packs/file-selection";
import {
  normalizeCsvText,
  normalizeJsonText,
} from "@/lib/import/normalize-file";
import { loadRepositoryContentPacks } from "../../scripts/audit-content-packs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

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
  const rawPayload =
    options.payload ?? {
      sourceCollection: {
        name: "Synthetic audit source",
        sourceType: "JSON",
      },
      problems,
    };
  const normalized = normalizeJsonText(JSON.stringify(rawPayload));
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
        payload: normalized.payload ?? undefined,
        normalizationIssues: normalized.issues,
      },
    ],
  };
}

function csvRow(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    sourceName: "Synthetic CSV source",
    problemTitle: "CSV problem",
    problemSlug: "csv-problem",
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "B2",
    topicTags: "grammar",
    statement: "Complete the question.",
    instructions: "Choose one option.",
    prompt: "Choose the best answer for this valid CSV question.",
    passage: "",
    optionsJson: JSON.stringify([
      { id: "A", text: "One" },
      { id: "B", text: "Two" },
    ]),
    answerJson: JSON.stringify({ correctOptionId: "A" }),
    explanation: "A sufficiently detailed explanation for review.",
    rootWord: "",
    keyword: "",
    targetSentence: "",
    metadataJson: "",
    ...overrides,
  };
  const headers = Object.keys(values);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return `${headers.join(",")}\n${headers.map((header) => escape(values[header])).join(",")}`;
}

function normalizedAuditFile(
  fileName: string,
  slug: string,
  prompt: string,
  normalizationIssues: ContentPackAuditInput["files"][number]["normalizationIssues"] = [],
) {
  const normalized = normalizeJsonText(JSON.stringify({
    sourceCollection: { name: "Deterministic audit source", sourceType: "JSON" },
    problems: [
      problem(
        [question({ prompt, explanation: "Short." })],
        { title: slug, slug },
      ),
    ],
  }));
  return {
    fileName,
    payload: normalized.payload ?? undefined,
    normalizationIssues: [...normalized.issues, ...normalizationIssues],
  };
}

function optionRendererPack(
  options: unknown,
  answer: unknown = { correctOptionId: "A" },
  questionType = "MCQ",
): ContentPackAuditInput {
  const skillType =
    questionType === "ERROR_IDENTIFICATION"
      ? "ERROR_IDENTIFICATION"
      : "MULTIPLE_CHOICE";
  return {
    directory: "renderer-option-fixture",
    files: [
      {
        fileName: "01-renderer-options.json",
        payload: {
          importType: "JSON",
          problems: [
            problem(
              [
                question({
                  type: questionType,
                  skillType,
                  options,
                  answer,
                }),
              ],
              { skillType, questionType },
            ),
          ],
        },
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

  it("preserves the trimmed explanation boundary through the shared heuristic", () => {
    const shortExplanation = `  ${"x".repeat(44)}  `;
    const boundaryExplanation = `  ${"x".repeat(45)}  `;
    const input = pack([
      problem([
        question({ explanation: shortExplanation }),
        question({ explanation: boundaryExplanation }),
      ]),
    ]);
    const before = JSON.stringify(input);
    const report = auditContentPacks([input]);

    expect(report.findings.shortExplanations).toHaveLength(1);
    expect(report.findings.shortExplanations[0]?.questionIndex).toBe(0);
    expect(JSON.stringify(input)).toBe(before);
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

  it("reports non-member and duplicate option identifiers", () => {
    const report = auditContentPacks([
      pack([
        problem([
          question({ answer: { correctOptionId: "Z" } }),
          question({
            options: [
              { id: "A", text: "One" },
              { id: "A", text: "Two" },
            ],
          }),
        ]),
      ]),
    ]);

    expect(report.findings.invalidCorrectOptions).toHaveLength(2);
    expect(report.answerPositions).toEqual({});
  });

  const validOptions = [
    { id: "A", text: "One" },
    { id: "B", text: "Two" },
  ];
  const validErrorOptions = [
    { id: "A", text: "One" },
    { id: "B", text: "Two" },
    { id: "C", text: "Three" },
    { id: "D", text: "Four" },
  ];

  it.each([
    ["zero options", [], { correctOptionId: "A" }, true],
    ["one option", [validOptions[0]], { correctOptionId: "A" }, true],
    ["two valid options", validOptions, { correctOptionId: "A" }, false],
    ["missing ID", [{ text: "One" }, validOptions[1]], { correctOptionId: "B" }, true],
    ["blank ID", [{ id: " ", text: "One" }, validOptions[1]], { correctOptionId: "B" }, true],
    ["exact duplicate ID", [{ id: "A", text: "One" }, { id: "A", text: "Two" }], { correctOptionId: "A" }, true],
    ["case-equivalent duplicate IDs", [{ id: "A", text: "One" }, { id: "a", text: "Two" }], { correctOptionId: "A" }, true],
    ["whitespace-equivalent duplicate IDs", [{ id: " A ", text: "One" }, { id: "A", text: "Two" }], { correctOptionId: "A" }, true],
    ["numeric IDs", [{ id: 1, text: "One" }, { id: 2, text: "Two" }], { correctOptionId: "1" }, false],
    ["numeric/string-equivalent IDs", [{ id: 1, text: "One" }, { id: "1", text: "Two" }], { correctOptionId: 1 }, true],
    ["missing text", [{ id: "A" }, validOptions[1]], { correctOptionId: "A" }, true],
    ["blank text", [{ id: "A", text: " " }, validOptions[1]], { correctOptionId: "A" }, true],
    ["duplicate normalized text remains renderer-valid", [{ id: "A", text: "Same answer" }, { id: "B", text: "  SAME   ANSWER " }], { correctOptionId: "A" }, false],
    ["numeric text", [{ id: "A", text: 1 }, { id: "B", text: 2 }], { correctOptionId: "A" }, false],
    ["numeric/string-equivalent text remains renderer-valid", [{ id: "A", text: 1 }, { id: "B", text: "1" }], { correctOptionId: "A" }, false],
    ["null ID", [{ id: null, text: "One" }, validOptions[1]], { correctOptionId: "B" }, true],
    ["undefined ID", [{ id: undefined, text: "One" }, validOptions[1]], { correctOptionId: "B" }, true],
    ["null text", [{ id: "A", text: null }, validOptions[1]], { correctOptionId: "A" }, true],
    ["undefined text", [{ id: "A", text: undefined }, validOptions[1]], { correctOptionId: "A" }, true],
    ["malformed object ID", [{ id: {}, text: "One" }, validOptions[1]], { correctOptionId: "B" }, true],
    ["malformed array option", [[], validOptions[1]], { correctOptionId: "B" }, true],
    ["answer present exactly", validOptions, { correctOptionId: "A" }, false],
    ["answer present after case normalization", validOptions, { correctOptionId: "a" }, false],
    ["answer present after whitespace normalization", validOptions, { correctOptionId: " A " }, false],
    ["correctOption alias", validOptions, { correctOption: "a" }, false],
    ["blank canonical answer does not fall through to alias", validOptions, { correctOptionId: " ", correctOption: "A" }, true],
    ["answer absent", validOptions, { correctOptionId: "Z" }, true],
    ["mixed string/numeric DTO-compatible values", [{ id: "1", text: 1 }, { id: 2, text: "Two" }], { correctOptionId: 2 }, false],
  ])(
    "checks renderer option edge case: %s",
    (_name, options, answer, expectedFinding) => {
      const report = auditContentPacks([
        optionRendererPack(options, answer),
      ]);
      expect(
        report.findings.rendererIncompatibleOptions.length > 0,
      ).toBe(expectedFinding);
      expect(report.hasInventoryErrors).toBe(false);
    },
  );

  it.each([
    [
      "case-sensitive text",
      [{ id: "A", text: "US" }, { id: "B", text: "us" }],
      "us",
      ["US", "us"],
    ],
    [
      "exact duplicate text",
      [{ id: "A", text: "Same" }, { id: "B", text: "Same" }],
      "same",
      ["Same", "Same"],
    ],
    [
      "NFKC-equivalent text",
      [{ id: "A", text: "Ａ" }, { id: "B", text: "A" }],
      "a",
      ["Ａ", "A"],
    ],
    [
      "whitespace-equivalent text",
      [{ id: "A", text: "Same   answer" }, { id: "B", text: " same answer " }],
      "same answer",
      ["Same   answer", " same answer "],
    ],
    [
      "numeric/string-equivalent text",
      [{ id: "A", text: 1 }, { id: "B", text: "1" }],
      "1",
      ["1", "1"],
    ],
  ])(
    "classifies %s as editorial ambiguity only",
    (_name, options, normalizedTextKey, rawDisplayValues) => {
      const report = auditContentPacks([
        optionRendererPack(options, { correctOptionId: "A" }),
      ]);

      expect(report.findings.rendererIncompatibleOptions).toEqual([]);
      expect(report.findings.duplicateNormalizedOptionTexts).toEqual([
        expect.objectContaining({
          questionType: "MCQ",
          duplicateGroupCount: 1,
          groups: [
            {
              normalizedTextKey,
              occurrences: 2,
              rawDisplayValues,
              omittedValues: 0,
            },
          ],
          omittedGroups: 0,
        }),
      ]);
      expect(report.hasInventoryErrors).toBe(false);
    },
  );

  it("does not report editorial ambiguity for distinct display text", () => {
    const report = auditContentPacks([
      optionRendererPack(validOptions, { correctOptionId: "A" }),
    ]);

    expect(report.findings.rendererIncompatibleOptions).toEqual([]);
    expect(report.findings.duplicateNormalizedOptionTexts).toEqual([]);
  });

  it.each([
    ["missing text", [{ id: "A" }, validOptions[1]]],
    ["blank text", [{ id: "A", text: " " }, validOptions[1]]],
    ["null text", [{ id: "A", text: null }, validOptions[1]]],
    ["object text", [{ id: "A", text: {} }, validOptions[1]]],
    ["array text", [{ id: "A", text: [] }, validOptions[1]]],
  ])(
    "keeps %s in renderer findings instead of ambiguity findings",
    (_name, options) => {
      const report = auditContentPacks([
        optionRendererPack(options, { correctOptionId: "A" }),
      ]);

      expect(report.findings.rendererIncompatibleOptions).toEqual([
        expect.objectContaining({ issues: ["INVALID_OPTION_TEXT"] }),
      ]);
      expect(report.findings.duplicateNormalizedOptionTexts).toEqual([]);
    },
  );

  it("keeps scorer-equivalent duplicate IDs in renderer findings", () => {
    const report = auditContentPacks([
      optionRendererPack(
        [{ id: "A", text: "One" }, { id: "a", text: "Two" }],
        { correctOptionId: "A" },
      ),
    ]);

    expect(report.findings.rendererIncompatibleOptions).toEqual([
      expect.objectContaining({ issues: ["DUPLICATE_OPTION_ID"] }),
    ]);
    expect(report.findings.duplicateNormalizedOptionTexts).toEqual([]);
  });

  it("reports renderer defects and editorial ambiguity independently", () => {
    const report = auditContentPacks([
      optionRendererPack(
        [
          { id: "A", text: "Same" },
          { id: "B", text: " same " },
          { id: "C", text: null },
        ],
        { correctOptionId: "A" },
      ),
    ]);

    expect(report.findings.rendererIncompatibleOptions).toEqual([
      expect.objectContaining({ issues: ["INVALID_OPTION_TEXT"] }),
    ]);
    expect(report.findings.duplicateNormalizedOptionTexts).toEqual([
      expect.objectContaining({
        groups: [
          {
            normalizedTextKey: "same",
            occurrences: 2,
            rawDisplayValues: ["Same", " same "],
            omittedValues: 0,
          },
        ],
      }),
    ]);
  });

  it.each([
    ["correctPart", validErrorOptions, { correctPart: "A", correction: "is" }, false],
    ["errorPart alias", validErrorOptions, { errorPart: "a", correction: "is" }, false],
    ["blank correctPart does not fall through to alias", validErrorOptions, { correctPart: " ", errorPart: "A", correction: "is" }, true],
    ["numeric IDs are not canonical A-D", [{ id: 1, text: 1 }, { id: 2, text: "Two" }], { correctPart: 1, correction: "is" }, true],
    ["whitespace/case correctPart", validErrorOptions, { correctPart: " a ", correction: "is" }, false],
    ["absent options", null, { correctPart: "A", correction: "is" }, true],
    ["null ID", [{ id: null, text: "One" }, ...validErrorOptions.slice(1)], { correctPart: "B", correction: "is" }, true],
    ["null text", [{ id: "A", text: null }, ...validErrorOptions.slice(1)], { correctPart: "A", correction: "is" }, true],
    ["malformed option object", [{}, ...validErrorOptions.slice(1)], { correctPart: "B", correction: "is" }, true],
  ])(
    "checks Error Identification option contract: %s",
    (_name, options, answer, expectedFinding) => {
      const report = auditContentPacks([
        optionRendererPack(options, answer, "ERROR_IDENTIFICATION"),
      ]);
      expect(
        report.findings.rendererIncompatibleOptions.length > 0,
      ).toBe(expectedFinding);
      expect(report.findings.duplicateNormalizedOptionTexts).toEqual([]);
    },
  );

  it("keeps one deterministic finding with independently useful issue codes", () => {
    const report = auditContentPacks([
      optionRendererPack(
        [
          { id: "A", text: "Same" },
          { id: "a", text: " same " },
        ],
        { correctOptionId: "Z" },
      ),
    ]);

    expect(report.findings.rendererIncompatibleOptions).toEqual([
      expect.objectContaining({
        issues: [
          "DUPLICATE_OPTION_ID",
          "ANSWER_NOT_IN_RENDERED_OPTIONS",
        ],
        optionIds: ["A", "a"],
        optionTexts: ["Same", " same "],
        selectedAnswer: "Z",
      }),
    ]);
    expect(report.findings.duplicateNormalizedOptionTexts).toEqual([
      expect.objectContaining({
        groups: [
          {
            normalizedTextKey: "same",
            occurrences: 2,
            rawDisplayValues: ["Same", " same "],
            omittedValues: 0,
          },
        ],
      }),
    ]);
  });

  it("orders both option finding arrays deterministically without mutating options", () => {
    const earlierOptions = Object.freeze([
      Object.freeze({ id: "A", text: "US" }),
      Object.freeze({ id: "a", text: "us" }),
    ]);
    const laterOptions = Object.freeze([
      Object.freeze({ id: "A", text: "Same" }),
      Object.freeze({ id: "a", text: " same " }),
    ]);
    const earlier = optionRendererPack(
      earlierOptions,
      { correctOptionId: "Z" },
    );
    earlier.directory = "a-pack";
    const later = optionRendererPack(
      laterOptions,
      { correctOptionId: "Z" },
    );
    later.directory = "z-pack";
    const before = JSON.stringify({ earlierOptions, laterOptions });

    const first = auditContentPacks([later, earlier]);
    const second = auditContentPacks([later, earlier]);

    expect(
      first.findings.rendererIncompatibleOptions.map(
        (finding) => finding.packDirectory,
      ),
    ).toEqual(["a-pack", "z-pack"]);
    expect(
      first.findings.duplicateNormalizedOptionTexts.map(
        (finding) => finding.packDirectory,
      ),
    ).toEqual(["a-pack", "z-pack"]);
    expect(JSON.stringify(first.findings.rendererIncompatibleOptions)).toBe(
      JSON.stringify(second.findings.rendererIncompatibleOptions),
    );
    expect(JSON.stringify(first.findings.duplicateNormalizedOptionTexts)).toBe(
      JSON.stringify(second.findings.duplicateNormalizedOptionTexts),
    );
    expect(JSON.stringify({ earlierOptions, laterOptions })).toBe(before);
  });

  it("bounds normalized ambiguity keys, raw values, and group arrays", () => {
    const options = Array.from({ length: 13 }, (_, groupIndex) => {
      const text = `${String.fromCharCode(65 + groupIndex)}${"x".repeat(160)}`;
      return Array.from(
        { length: groupIndex === 0 ? 9 : 2 },
        (_, occurrenceIndex) => ({
          id: `${groupIndex}-${occurrenceIndex}`,
          text: occurrenceIndex % 2 === 0 ? text : text.toLowerCase(),
        }),
      );
    }).flat();
    const report = auditContentPacks([
      optionRendererPack(options, { correctOptionId: "0-0" }),
    ]);
    const finding = report.findings.duplicateNormalizedOptionTexts[0];

    expect(finding).toEqual(
      expect.objectContaining({
        duplicateGroupCount: 13,
        omittedGroups: 1,
      }),
    );
    expect(finding?.groups).toHaveLength(12);
    expect(finding?.groups[0]).toEqual(
      expect.objectContaining({
        occurrences: 9,
        omittedValues: 1,
      }),
    );
    expect(finding?.groups[0]?.rawDisplayValues).toHaveLength(8);
    expect(
      finding?.groups.every(
        (group) =>
          group.normalizedTextKey.length <= 120 &&
          group.rawDisplayValues.every((value) => value.length <= 120),
      ),
    ).toBe(true);
  });

  it("keeps structural option findings consistent with DTO/scorer IDs", () => {
    const numeric = auditContentPacks([
      optionRendererPack(
        [{ id: 1, text: 10 }, { id: 2, text: 20 }],
        { correctOptionId: "1" },
      ),
    ]);
    const normalizedMembership = auditContentPacks([
      optionRendererPack(validOptions, { correctOptionId: "a" }),
    ]);
    const scorerEquivalentDuplicate = auditContentPacks([
      optionRendererPack(
        [{ id: "A", text: "One" }, { id: "a", text: "Two" }],
        { correctOptionId: "A" },
      ),
    ]);

    expect(numeric.findings.invalidCorrectOptions).toEqual([]);
    expect(numeric.answerPositions).toEqual({ A: 1 });
    expect(normalizedMembership.findings.invalidCorrectOptions).toEqual([]);
    expect(normalizedMembership.answerPositions).toEqual({ A: 1 });
    expect(
      scorerEquivalentDuplicate.findings.invalidCorrectOptions,
    ).toHaveLength(1);
    expect(scorerEquivalentDuplicate.answerPositions).toEqual({});
  });

  it("leaves missing Error Identification correction to import validation", () => {
    const normalized = normalizeJsonText(JSON.stringify({
      sourceCollection: {
        name: "Error Identification validation fixture",
        sourceType: "JSON",
      },
      problems: [
        problem(
          [
            question({
              type: "ERROR_IDENTIFICATION",
              skillType: "ERROR_IDENTIFICATION",
              options: validOptions,
              answer: { correctPart: "A" },
            }),
          ],
          {
            skillType: "ERROR_IDENTIFICATION",
            questionType: "ERROR_IDENTIFICATION",
          },
        ),
      ],
    }));

    expect(normalized.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "problems.0.questions.0.answer.correction",
          level: "error",
        }),
      ]),
    );
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
              answer: { acceptedAnswers: ["one"] },
              metadata: { sentences: ["One _____.", "Two _____.", "Three _____."] },
            }),
            question({
              type: "TRIOS_GAPPED_SENTENCES",
              skillType: "TRIOS",
              prompt: triosPrompt,
              answer: { acceptedAnswers: ["four"] },
              metadata: { sentences: ["Four _____.", "Five _____.", "Six _____."] },
            }),
          ],
          { skillType: "TRIOS", slug: "trios-problem" },
        ),
      ]),
    ]);

    expect(report.findings.duplicatePromptGroups).toEqual([]);
  });

  it("audits the canonical Trios sentence contract without parsing passage mirrors", () => {
    const canonical = [
      "First _____ sentence.",
      "Second _____ sentence.",
      "Third _____ sentence.",
    ];
    const triosQuestions = [
      question({
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        answer: { acceptedAnswers: ["shared"] },
        metadata: { sentences: canonical },
      }),
      question({
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        answer: { acceptedAnswers: ["shared"] },
        passage: "1. First _____.\n2. Second _____.\n3. Third _____.",
        metadata: null,
      }),
      question({
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        answer: { acceptedAnswers: ["shared"] },
        metadata: { sentences: [canonical[0], 2, canonical[2]] },
      }),
      question({
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        answer: { acceptedAnswers: ["shared"] },
        metadata: { sentences: [canonical[0], "No gap.", canonical[2]] },
      }),
      question({
        type: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        answer: { acceptedAnswers: ["shared"] },
        metadata: { sentences: [canonical[0], "Two _____ gaps _____.", canonical[2]] },
      }),
    ];
    const input = pack([
      problem(triosQuestions, {
        skillType: "TRIOS",
        questionType: "TRIOS_GAPPED_SENTENCES",
        slug: "trios-contract-audit",
      }),
    ]);
    const first = auditContentPacks([input]);
    const second = auditContentPacks([input]);

    expect(first.findings.triosWithoutThreeSentences).toHaveLength(4);
    expect(first.findings.triosWithoutThreeSentences.map(
      (location) => location.questionIndex,
    )).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first.findings.triosWithoutThreeSentences))
      .not.toContain("shared");
  });

  it("reports Pronunciation target compatibility with safe deterministic codes", () => {
    const validOptions = [
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
    ];
    const pronunciationQuestions = [
      question({
        type: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        options: validOptions,
        answer: { correctOptionId: "C" },
      }),
      question({
        type: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        options: validOptions.map(({ id, text }) => ({ id, text })),
        answer: { correctOptionId: "C" },
      }),
      question({
        type: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        options: validOptions,
        answer: { correctOptionId: "E", secret: "AUDIT_ANSWER_SENTINEL" },
      }),
    ];
    const rawProblem = problem(pronunciationQuestions, {
      skillType: "PRONUNCIATION",
      questionType: "PRONUNCIATION_ODD_ONE_OUT",
      slug: "pronunciation-contract-audit",
    });
    const input: ContentPackAuditInput = {
      directory: "pronunciation-audit",
      files: [{
        fileName: "01-pronunciation.json",
        payload: {
          sourceCollection: { name: "Raw fixture", sourceType: "JSON" },
          problems: [rawProblem],
        },
      }],
    };
    const first = auditContentPacks([input]);
    const second = auditContentPacks([input]);

    expect(first.findings.pronunciationWithoutValidTargetSpans).toEqual([
      expect.objectContaining({
        questionIndex: 1,
        issues: ["TARGET_SPAN_REQUIRED"],
      }),
      expect.objectContaining({
        questionIndex: 2,
        issues: ["CORRECT_OPTION_INVALID"],
      }),
    ]);
    expect(JSON.stringify(first.findings.pronunciationWithoutValidTargetSpans))
      .not.toContain("AUDIT_ANSWER_SENTINEL");
    expect(JSON.stringify(first.findings.pronunciationWithoutValidTargetSpans))
      .not.toContain("bread");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
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
        expect.objectContaining({ path: "problems" }),
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
            { fileName: "manifest.json" },
            { fileName: "notes.txt" },
          ],
        },
        files: [],
      },
    ]);

    expect(report.inventory.splitFiles).toBe(0);
    expect(report.malformedInputs).toHaveLength(3);
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("matches the current manifests to the complete importer-selected repository set", async () => {
    const inputs = await loadRepositoryContentPacks();
    const report = auditContentPacks(inputs);

    expect(report.inventory).toEqual({
      packs: 2,
      splitFiles: 17,
      problems: 101,
      questions: 495,
      optionQuestions: 230,
    });
    expect(report.answerPositions).toEqual({ A: 156, B: 44, C: 18, D: 12 });
    expect(report.findings.shortExplanations).toHaveLength(419);
    expect(report.findings.rendererIncompatibleOptions).toHaveLength(5);
    expect(report.findings.rendererIncompatibleOptions.map((finding) => ({
      packDirectory: finding.packDirectory,
      fileName: finding.fileName,
      problemIndex: finding.problemIndex,
      questionIndex: finding.questionIndex,
    }))).toEqual([
      { packDirectory: "content-pack-002", fileName: "07-error-identification-pack-002.json", problemIndex: 1, questionIndex: 1 },
      { packDirectory: "content-pack-002", fileName: "07-error-identification-pack-002.json", problemIndex: 1, questionIndex: 3 },
      { packDirectory: "content-pack-002", fileName: "07-error-identification-pack-002.json", problemIndex: 5, questionIndex: 1 },
      { packDirectory: "content-pack-002", fileName: "07-error-identification-pack-002.json", problemIndex: 5, questionIndex: 4 },
      { packDirectory: "pilot-pack-001", fileName: "07-error-identification-pack-001.json", problemIndex: 4, questionIndex: 4 },
    ]);
    expect(report.findings.duplicateNormalizedOptionTexts).toHaveLength(0);
    expect(report.findings.duplicatePromptGroups).toHaveLength(3);
    expect(report.findings.duplicatePromptGroups.map((group) =>
      group.locations.map((location) => ({
        packDirectory: location.packDirectory,
        fileName: location.fileName,
        problemIndex: location.problemIndex,
        questionIndex: location.questionIndex,
      })),
    )).toEqual([
      [
        {
          packDirectory: "content-pack-002",
          fileName: "06-grammar-focus-pack-002.json",
          problemIndex: 1,
          questionIndex: 0,
        },
        {
          packDirectory: "pilot-pack-001",
          fileName: "02-mcq-pack-001.json",
          problemIndex: 1,
          questionIndex: 1,
        },
      ],
      [
        {
          packDirectory: "content-pack-002",
          fileName: "07-error-identification-pack-002.json",
          problemIndex: 0,
          questionIndex: 3,
        },
        {
          packDirectory: "pilot-pack-001",
          fileName: "07-error-identification-pack-001.json",
          problemIndex: 0,
          questionIndex: 3,
        },
      ],
      [
        {
          packDirectory: "content-pack-002",
          fileName: "07-error-identification-pack-002.json",
          problemIndex: 3,
          questionIndex: 0,
        },
        {
          packDirectory: "pilot-pack-001",
          fileName: "07-error-identification-pack-001.json",
          problemIndex: 2,
          questionIndex: 0,
        },
      ],
    ]);
    expect(report.byQuestionType.TRIOS_GAPPED_SENTENCES).toBe(15);
    expect(report.findings.triosWithoutThreeSentences).toEqual([]);
    expect(report.findings.pronunciationWithoutValidTargetSpans)
      .toHaveLength(10);
    expect(report.findings.pronunciationWithoutValidTargetSpans.map(
      (finding) => [finding.problemIndex, finding.questionIndex],
    )).toEqual([
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 4],
      [2, 0],
      [2, 3],
      [3, 1],
      [3, 4],
      [4, 0],
      [5, 3],
    ]);
    expect(report.findings.pronunciationWithoutValidTargetSpans.every(
      (finding) =>
        finding.issues.length === 1 &&
        finding.issues[0] === "TARGET_SPAN_REQUIRED",
    )).toBe(true);
    expect(report.manifestMismatches).toEqual([]);
    expect(report.malformedInputs).toEqual([]);
    expect(report.normalizerWarnings).toHaveLength(46);
    expect(report.hasInventoryErrors).toBe(false);
  });

  it("cannot silently omit an extra importer-selected numbered JSON file", () => {
    const first = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "One", sourceType: "JSON" },
      problems: [problem([question()])],
    }));
    const second = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "Two", sourceType: "JSON" },
      problems: [problem([question()], { slug: "second" })],
    }));
    const report = auditContentPacks([
      {
        directory: "extra-file",
        manifest: {
          files: [{ fileName: "01-first.json", problemCount: 1, questionCount: 1 }],
        },
        files: [
          { fileName: "01-first.json", payload: first.payload, normalizationIssues: first.issues },
          { fileName: "02-extra.json", payload: second.payload, normalizationIssues: second.issues },
        ],
      },
    ]);

    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "02-extra.json",
          message: "Importer-selected file is not listed in the manifest.",
        }),
      ]),
    );
    expect(report.inventory.splitFiles).toBe(2);
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("fails when a manifest-listed file is missing from the selected set", () => {
    const report = auditContentPacks([
      {
        directory: "missing-file",
        manifest: {
          files: [{ fileName: "01-missing.json" }],
        },
        files: [],
      },
    ]);

    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "01-missing.json",
          message: "Manifest entry is missing from the importer-selected directory set.",
        }),
      ]),
    );
    expect(report.hasInventoryErrors).toBe(true);
  });

  it.each([
    ["case-only", "Example.json", "example.json"],
    ["surrounding whitespace", "example.json", " example.json"],
    ["NFC-equivalent Unicode", "\u00e9.json", "e\u0301.json"],
  ])("rejects %s selected-file collisions using importer filename identity", (_label, firstName, secondName) => {
    const files = [
      normalizedAuditFile(firstName, "first-collision", "First collision prompt with enough content."),
      normalizedAuditFile(secondName, "second-collision", "Second collision prompt with enough content."),
    ];
    const report = auditContentPacks([{ directory: "collision-pack", files }]);
    const collisionIssues = report.malformedInputs.filter(
      (issue) => issue.message === "Importer-selected filename collides after importer normalization.",
    );

    expect(collisionIssues).toHaveLength(2);
    expect(collisionIssues.map((issue) => issue.fileName)).toEqual(
      expect.arrayContaining([firstName, secondName]),
    );
    expect(report.inventory).toMatchObject({
      splitFiles: 2,
      problems: 0,
      questions: 0,
      optionQuestions: 0,
    });
    expect(report.hasInventoryErrors).toBe(true);
  });

  it.each([
    ["surrounding whitespace", " Example.json ", "example.json"],
    ["NFC-equivalent Unicode", "\u00e9.json", "e\u0301.json"],
  ])("matches %s manifest and selected filenames by importer identity", (_label, manifestName, selectedName) => {
    const file = normalizedAuditFile(
      selectedName,
      "normalized-match",
      "Normalized manifest match prompt with enough content.",
    );
    const report = auditContentPacks([
      {
        directory: "normalized-match-pack",
        manifest: {
          files: [
            {
              fileName: manifestName,
              problemCount: 1,
              questionCount: 1,
            },
          ],
          totals: {
            fileCount: 1,
            problemCount: 1,
            questionCount: 1,
          },
        },
        files: [file],
      },
    ]);

    expect(report.malformedInputs).toEqual([]);
    expect(report.manifestMismatches).toEqual([]);
    expect(report.inventory).toMatchObject({
      splitFiles: 1,
      problems: 1,
      questions: 1,
    });
    expect(report.hasInventoryErrors).toBe(false);
  });

  it("rejects normalized duplicate entries inside a manifest while preserving raw names", () => {
    const report = auditContentPacks([
      {
        directory: "duplicate-manifest-pack",
        manifest: {
          files: [
            { fileName: "Example.json" },
            { fileName: " example.json " },
          ],
        },
        files: [
          normalizedAuditFile(
            "example.json",
            "manifest-duplicate",
            "Manifest duplicate prompt with enough content.",
          ),
        ],
      },
    ]);

    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: " example.json ",
          path: "manifest.files.1",
          message: "Manifest contains a duplicate file entry.",
        }),
      ]),
    );
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("keeps manifest-optional, mirror, ordering, and non-importable selection identical to the importer", () => {
    const files = [
      { fileName: "notes.md", content: "ignored" },
      { fileName: "00-all-in-one-pack.json", content: "{}" },
      { fileName: "02-second.csv", content: "" },
      { fileName: "01-first.json", content: "{}" },
      { fileName: "cover.png", content: "ignored" },
    ];
    const selected = selectImportFiles(files);

    expect(selected.manifest).toBeNull();
    expect(selected.selected.map((file) => file.fileName)).toEqual([
      "02-second.csv",
      "01-first.json",
    ]);
    expect(selected.ignoredFiles).toEqual(["00-all-in-one-pack.json"]);
  });

  it("audits valid CSV through the importer normalization contract", () => {
    const normalized = normalizeCsvText(csvRow());
    const report = auditContentPacks([
      {
        directory: "csv-pack",
        files: [
          {
            fileName: "content.csv",
            payload: normalized.payload,
            normalizationIssues: normalized.issues,
          },
        ],
      },
    ]);

    expect(normalized.issues).toEqual([]);
    expect(report.inventory).toMatchObject({
      packs: 1,
      splitFiles: 1,
      problems: 1,
      questions: 1,
      optionQuestions: 1,
    });
    expect(report.hasInventoryErrors).toBe(false);
  });

  it("surfaces CSV normalizer errors at row and field locations", () => {
    const normalized = normalizeCsvText(csvRow({ sourceName: "", difficulty: "INVALID_LEVEL" }));
    const report = auditContentPacks([
      {
        directory: "invalid-csv",
        files: [
          {
            fileName: "invalid.csv",
            payload: normalized.payload,
            normalizationIssues: normalized.issues,
          },
        ],
      },
    ]);

    expect(normalized.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", path: "rows.2.sourceName" }),
      ]),
    );
    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileName: "invalid.csv", path: "rows.2.sourceName" }),
      ]),
    );
    expect(report.inventory.problems).toBe(0);
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("rejects an empty required JSON source field", () => {
    const normalized = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "", sourceType: "JSON" },
      problems: [problem([question()])],
    }));
    const report = auditContentPacks([
      {
        directory: "invalid-source",
        files: [
          {
            fileName: "invalid-source.json",
            payload: normalized.payload ?? undefined,
            normalizationIssues: normalized.issues,
          },
        ],
      },
    ]);

    expect(normalized.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", path: "sourceCollection.name" }),
      ]),
    );
    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "sourceCollection.name" })]),
    );
    expect(report.hasInventoryErrors).toBe(true);
  });

  it.each([
    ["empty required field", { title: "" }, "problems.0.title"],
    ["invalid skill", { skillType: "INVALID_SKILL" }, "problems.0.skillType"],
    ["invalid question type", { questionType: "INVALID_TYPE" }, "problems.0.questionType"],
    ["invalid difficulty", { difficulty: "INVALID_LEVEL" }, "problems.0.difficulty"],
  ])("fails importer-normalizer validation for %s", (_name, problemOverrides, expectedPath) => {
    const normalized = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "Invalid fixture", sourceType: "JSON" },
      problems: [problem([question()], problemOverrides)],
    }));
    const report = auditContentPacks([
      {
        directory: "invalid-json",
        files: [
          {
            fileName: "invalid.json",
            payload: normalized.payload ?? undefined,
            normalizationIssues: normalized.issues,
          },
        ],
      },
    ]);

    expect(normalized.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ level: "error", path: expectedPath })]),
    );
    expect(report.malformedInputs).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: expectedPath })]),
    );
    expect(report.inventory.problems).toBe(0);
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("fails a type-specific question payload exactly where the importer normalizer fails", () => {
    const normalized = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "Invalid MCQ", sourceType: "JSON" },
      problems: [
        problem([
          question({
            options: null,
            answer: {},
          }),
        ]),
      ],
    }));
    const report = auditContentPacks([
      {
        directory: "invalid-question",
        files: [
          {
            fileName: "invalid.json",
            payload: normalized.payload ?? undefined,
            normalizationIssues: normalized.issues,
          },
        ],
      },
    ]);

    expect(normalized.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "problems.0.questions.0.options",
        "problems.0.questions.0.answer",
        "problems.0.questions",
      ]),
    );
    expect(report.malformedInputs.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(normalized.issues.map((issue) => issue.path)),
    );
    expect(report.inventory.questions).toBe(0);
    expect(report.hasInventoryErrors).toBe(true);
  });

  it("preserves normalizer warnings without turning them into inventory errors", () => {
    const normalized = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "Warning fixture", sourceType: "JSON" },
      problems: [
        problem([
          question({
            type: "SENTENCE_TRANSFORMATION",
            skillType: "SENTENCE_TRANSFORMATION",
            answer: {},
          }),
        ], {
          skillType: "SENTENCE_TRANSFORMATION",
          questionType: "SENTENCE_TRANSFORMATION",
        }),
      ],
    }));
    const report = auditContentPacks([
      {
        directory: "warning-json",
        files: [
          {
            fileName: "warning.json",
            payload: normalized.payload ?? undefined,
            normalizationIssues: normalized.issues,
          },
        ],
      },
    ]);

    expect(normalized.issues).toEqual([
      expect.objectContaining({ level: "warning", path: "problems.0.questions.0.answer" }),
    ]);
    expect(report.normalizerWarnings).toHaveLength(1);
    expect(report.hasInventoryErrors).toBe(false);
  });

  it("uses bounded prompt excerpts in short-explanation and duplicate locations", () => {
    const longPrompt = `A repeated substantive prompt ${"x".repeat(180)}`;
    const report = auditContentPacks([
      pack([
        problem([question({ prompt: longPrompt, explanation: "Short." })]),
        problem([question({ prompt: longPrompt, explanation: "Short." })], {
          slug: "second-long-prompt",
        }),
      ]),
    ]);

    expect(report.findings.shortExplanations[0].promptExcerpt?.length).toBeLessThanOrEqual(120);
    expect(report.findings.duplicatePromptGroups[0].locations[0].promptExcerpt?.length).toBeLessThanOrEqual(120);
  });

  it("canonicalizes every report collection independently of pack and file input order", () => {
    const repeatedPromptOne =
      "Repeated deterministic prompt one with substantive content.";
    const repeatedPromptTwo =
      "Repeated deterministic prompt two with substantive content.";
    const primaryFiles = [
      normalizedAuditFile(
        "b.json",
        "problem-b",
        repeatedPromptTwo,
        [{ level: "warning", path: "problems.0.questions.0.answer", message: "Synthetic warning B." }],
      ),
      normalizedAuditFile("a.json", "problem-a", repeatedPromptTwo),
      normalizedAuditFile("d.json", "problem-d", repeatedPromptOne),
      normalizedAuditFile("c.json", "problem-c", repeatedPromptOne),
      {
        fileName: "z-error.json",
        payload: undefined,
        normalizationIssues: [
          { level: "error" as const, path: "problems.0.title", message: "Synthetic error Z." },
        ],
      },
    ];
    const primaryManifest = {
      packName: "Primary deterministic pack",
      files: primaryFiles.map((file) => ({
        fileName: file.fileName,
        problemCount: 2,
        questionCount: 2,
      })),
      totals: {
        fileCount: primaryFiles.length,
        problemCount: 20,
        questionCount: 20,
      },
    };
    const secondaryNormalized = normalizeJsonText(JSON.stringify({
      sourceCollection: { name: "Secondary deterministic source", sourceType: "JSON" },
      problems: [
        problem(
          [
            question({
              skillType: "READING",
              difficulty: "C1",
              answer: { correctOptionId: "Z" },
              explanation: null,
            }),
            question({
              type: "WORD_FORMATION",
              skillType: "MULTIPLE_CHOICE",
              prompt: "Create the correct form.",
              options: null,
              answer: { acceptedAnswers: ["form"] },
              explanation: "Short.",
              rootWord: null,
            }),
            question({
              type: "READING_MCQ",
              skillType: "MULTIPLE_CHOICE",
              prompt: "Read and choose the correct answer.",
              explanation: "Short.",
              passage: null,
            }),
            question({
              type: "TRIOS_GAPPED_SENTENCES",
              skillType: "MULTIPLE_CHOICE",
              prompt: "Supply one shared word for all three sentences.",
              options: null,
              answer: { acceptedAnswers: ["shared"] },
              explanation: "Short.",
              passage: null,
              metadata: null,
            }),
          ],
          {
            title: "Secondary findings",
            slug: "secondary-findings",
            difficulty: "B2",
            instructions: null,
          },
        ),
      ],
    }));
    expect(secondaryNormalized.issues).toEqual([
      expect.objectContaining({
        level: "warning",
        code: "TRIOS_METADATA_REQUIRED",
        path: "problems.0.questions.3.metadata",
      }),
    ]);
    const secondaryFile = {
      fileName: "secondary.json",
      payload: secondaryNormalized.payload ?? undefined,
      normalizationIssues: secondaryNormalized.issues,
    };
    const primaryInput: ContentPackAuditInput = {
      directory: "z-primary-pack",
      manifest: primaryManifest,
      files: primaryFiles,
    };
    const secondaryInput: ContentPackAuditInput = {
      directory: "a-secondary-pack",
      manifest: {
        packName: "Secondary deterministic pack",
        files: [
          {
            fileName: secondaryFile.fileName,
            problemCount: 2,
            questionCount: 8,
          },
        ],
        totals: {
          fileCount: 1,
          problemCount: 2,
          questionCount: 8,
        },
      },
      files: [secondaryFile],
    };

    const forwardInputs = [primaryInput, secondaryInput];
    const reversedInputs = [
      { ...secondaryInput, files: [...secondaryInput.files].reverse() },
      { ...primaryInput, files: [...primaryInput.files].reverse() },
    ];
    const forward = auditContentPacks(forwardInputs);
    const reversed = auditContentPacks(reversedInputs);
    const repeated = auditContentPacks(forwardInputs);

    expect(reversed.findings).toEqual(forward.findings);
    expect(reversed.packs).toEqual(forward.packs);
    expect(reversed.malformedInputs).toEqual(forward.malformedInputs);
    expect(reversed.normalizerWarnings).toEqual(forward.normalizerWarnings);
    expect(reversed.manifestMismatches).toEqual(forward.manifestMismatches);
    expect(forward.findings.duplicatePromptGroups).toHaveLength(2);
    expect(
      forward.findings.duplicatePromptGroups.map(
        (group) => group.locations[0].promptExcerpt,
      ),
    ).toEqual([repeatedPromptOne, repeatedPromptTwo]);
    expect(
      forward.findings.duplicatePromptGroups.every(
        (group) =>
          group.locations.map((location) => location.fileName).join(",") ===
          [...group.locations]
            .map((location) => location.fileName)
            .sort()
            .join(","),
      ),
    ).toBe(true);
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(forward));
  });

  it("loads synthetic directory fixtures using the same importer-selected set", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "englishphile-content-audit-"));
    temporaryDirectories.push(root);
    const packDirectory = path.join(root, "fixture-pack");
    await fs.mkdir(packDirectory);
    const payload = JSON.stringify({
      sourceCollection: { name: "Fixture", sourceType: "JSON" },
      problems: [problem([question()])],
    });
    await fs.writeFile(path.join(packDirectory, "01-fixture.json"), payload, "utf8");
    await fs.writeFile(path.join(packDirectory, "notes.txt"), "not importable", "utf8");

    const inputs = await loadRepositoryContentPacks(root);
    const report = auditContentPacks(inputs);

    expect(inputs[0].files.map((file) => file.fileName)).toEqual(["01-fixture.json"]);
    expect(report.inventory).toMatchObject({ packs: 1, splitFiles: 1, problems: 1, questions: 1 });
    expect(report.hasInventoryErrors).toBe(false);
  });

  it("reports Listening contract violations independently", () => {
    const report = auditContentPacks([
      pack([
        problem([
          question({
            type: "LISTENING_MCQ",
            skillType: "LISTENING",
            options: [
              { id: "A", text: "One" },
              { id: "B", text: "Two" },
              { id: "C", text: "Three" },
            ],
            answer: { correctOptionId: "C" },
            metadata: null,
          }),
        ]),
      ]),
    ]);

    expect(report.findings.listeningContractIssues).toHaveLength(1);
    expect(report.findings.listeningContractIssues[0].issues).toEqual(
      expect.arrayContaining(["LISTENING_DESCRIPTOR_REQUIRED"])
    );
  });
});
