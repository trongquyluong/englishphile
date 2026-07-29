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
    expect(report.findings.shortExplanations).toHaveLength(440);
    expect(report.findings.duplicatePromptGroups).toHaveLength(3);
    expect(report.manifestMismatches).toEqual([]);
    expect(report.malformedInputs).toEqual([]);
    expect(report.normalizerWarnings).toEqual([]);
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
    expect(secondaryNormalized.issues).toEqual([]);
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
});
