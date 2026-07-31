import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportPlan } from "@/lib/import/types";

const mocks = vi.hoisted(() => ({
  normalizeJsonText: vi.fn(),
  normalizeCsvText: vi.fn(),
  buildImportPlan: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/import/normalize-file", () => ({
  normalizeJsonText: mocks.normalizeJsonText,
  normalizeCsvText: mocks.normalizeCsvText,
}));
vi.mock("@/lib/import/duplicates", () => ({
  buildImportPlan: mocks.buildImportPlan,
}));
vi.mock("@/lib/import/atomic-import", () => ({
  executeImportPlanAtomically: mocks.execute,
}));

import { importCsvRows } from "@/lib/import/csv-importer";
import { importJsonPayload } from "@/lib/import/json-importer";

function plan(
  options: unknown,
  importType: ImportPlan["importType"] = "JSON",
): ImportPlan {
  return {
    ok: true,
    importType,
    issues: [{
      level: "warning",
      path: "problems.0.questions.0.options",
      message: "Error Identification cần đúng bốn phần lựa chọn A, B, C và D.",
      code: "ERROR_IDENTIFICATION_OPTIONS_REQUIRED",
    }],
    preview: [],
    payload: {
      importType,
      problems: [{
        title: "Contract fixture",
        slug: "contract-fixture",
        skillType: "ERROR_IDENTIFICATION",
        questionType: "ERROR_IDENTIFICATION",
        difficulty: "C1",
        sourceCollection: {
          name: "Synthetic source",
          description: "Synthetic",
          sourceType: "JSON",
        },
        statement: "Chọn phần sai.",
        topics: [],
        orderIndex: 0,
        questions: [{
          type: "ERROR_IDENTIFICATION",
          skillType: "ERROR_IDENTIFICATION",
          difficulty: "C1",
          prompt: "The students was ready.",
          options,
          answer: { correctPart: "B", correction: "were" },
          orderIndex: 0,
        }],
      }],
    },
    summary: {
      sourceCollectionsToCreate: 1,
      sourceCollectionsReused: 0,
      topicsToCreate: 0,
      topicsReused: 0,
      problemsToCreate: 1,
      questionsToCreate: 1,
      duplicateProblemsSkipped: 0,
      duplicateQuestionsSkipped: 0,
      exactDuplicateQuestionsSkipped: 0,
      highSimilarityQuestionsSkipped: 0,
      possibleDuplicateQuestionsFlagged: 0,
      problemsImported: 0,
      questionsImported: 0,
      errors: 0,
      warnings: 1,
    },
  };
}

function triosPlan(
  metadata: unknown,
  importType: ImportPlan["importType"] = "JSON",
): ImportPlan {
  const issue = metadata === null
    ? [{
        level: "warning" as const,
        path: "problems.0.questions.0.metadata",
        message: "Trios cần metadata dạng object chứa đúng ba câu.",
        code: "TRIOS_METADATA_REQUIRED",
      }]
    : [];
  return {
    ...plan(null, importType),
    importType,
    issues: issue,
    payload: {
      importType,
      problems: [{
        title: "Trios contract fixture",
        slug: "trios-contract-fixture",
        skillType: "TRIOS",
        questionType: "TRIOS_GAPPED_SENTENCES",
        difficulty: "C1",
        sourceCollection: {
          name: "Synthetic Trios source",
          description: "Synthetic",
          sourceType: importType,
        },
        statement: "Điền một từ chung.",
        topics: [],
        orderIndex: 0,
        questions: [{
          type: "TRIOS_GAPPED_SENTENCES",
          skillType: "TRIOS",
          difficulty: "C1",
          prompt: "Điền một từ duy nhất.",
          passage: "Compatibility mirror.",
          options: null,
          answer: { acceptedAnswers: ["conclusion"] },
          metadata,
          orderIndex: 0,
        }],
      }],
    },
    summary: {
      ...plan(null, importType).summary,
      warnings: issue.length,
    },
  };
}

const validListeningMetadata = {
  listening: {
    version: 1,
    audio: {
      assetRef: "/media/listening/pilot-001/dialogue-01-v1.mp3",
      mimeType: "audio/mpeg",
      byteLength: 2457600,
      durationMs: 92000,
    },
    transcript: {
      text: "Transcript",
      languageTag: "en",
      availabilityPolicy: "AFTER_SUBMISSION",
    },
    attribution: {
      displayText: "Attribution",
    },
    rights: {
      classification: "OWNED",
      evidenceRef: "rights:1",
    },
    unavailableBehavior: "BLOCK_PROBLEM",
  },
};

function listeningMCQPlan(
  options: unknown,
  importType: ImportPlan["importType"] = "JSON",
): ImportPlan {
  const issues = Array.isArray(options) && options.length === 3 ? [] : [{
    level: "warning" as const,
    path: "problems.0.questions.0.options",
    message: "LISTENING_MCQ cần đúng 3 hoặc 4 options.",
    code: "LISTENING_MCQ_OPTION_COUNT_INVALID",
  }];
  return {
    ...plan(null, importType),
    importType,
    issues,
    payload: {
      importType,
      problems: [{
        title: "Listening MCQ contract fixture",
        slug: "listening-mcq-contract-fixture",
        skillType: "LISTENING",
        questionType: "LISTENING_MCQ",
        difficulty: "C1",
        sourceCollection: {
          name: "Synthetic Listening source",
          description: "Synthetic",
          sourceType: importType,
        },
        statement: "Listen and choose.",
        topics: [],
        orderIndex: 0,
        questions: [{
          type: "LISTENING_MCQ",
          skillType: "LISTENING",
          difficulty: "C1",
          prompt: "What is said?",
          options,
          answer: { correctOptionId: "B" },
          metadata: validListeningMetadata,
          orderIndex: 0,
        }],
      }],
    },
    summary: {
      ...plan(null, importType).summary,
      warnings: issues.length,
    },
  };
}

function listeningLegacyAliasPlan(
  aliasCode: "LISTENING_LEGACY_AUDIO_URL" | "LISTENING_LEGACY_SECTION_TYPE" | "BOTH",
  importType: ImportPlan["importType"] = "JSON",
): ImportPlan {
  const issues = [];
  if (aliasCode === "LISTENING_LEGACY_AUDIO_URL" || aliasCode === "BOTH") {
    issues.push({
      level: "warning" as const,
      path: "problems.0.questions.0.metadata.audioUrl",
      message: "Sử dụng trường audioUrl cũ.",
      code: "LISTENING_LEGACY_AUDIO_URL",
    });
  }
  if (aliasCode === "LISTENING_LEGACY_SECTION_TYPE" || aliasCode === "BOTH") {
    issues.push({
      level: "warning" as const,
      path: "problems.0.questions.0.metadata.sectionType",
      message: "Sử dụng trường sectionType cũ.",
      code: "LISTENING_LEGACY_SECTION_TYPE",
    });
  }
  return {
    ...plan(null, importType),
    importType,
    issues,
    payload: {
      importType,
      problems: [{
        title: "Listening Alias fixture",
        slug: "listening-alias-fixture",
        skillType: "LISTENING",
        questionType: "LISTENING_MCQ",
        difficulty: "C1",
        sourceCollection: {
          name: "Synthetic Listening source",
          description: "Synthetic",
          sourceType: importType,
        },
        statement: "Listen and choose.",
        topics: [],
        orderIndex: 0,
        questions: [{
          type: "LISTENING_MCQ",
          skillType: "LISTENING",
          difficulty: "C1",
          prompt: "What is said?",
          options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }],
          answer: { correctOptionId: "B" },
          metadata: validListeningMetadata,
          orderIndex: 0,
        }],
      }],
    },
    summary: {
      ...plan(null, importType).summary,
      warnings: issues.length,
    },
  };
}

function listeningShortAnswerPlan(
  answer: unknown,
  importType: ImportPlan["importType"] = "JSON",
): ImportPlan {
  const issues = answer && typeof answer === "object" && Array.isArray((answer as Record<string, unknown>).acceptedAnswers) && ((answer as Record<string, unknown>).acceptedAnswers as unknown[]).length > 0 ? [] : [{
    level: "warning" as const,
    path: "problems.0.questions.0.answer.acceptedAnswers",
    message: "LISTENING_SHORT_ANSWER cần ít nhất một acceptedAnswers không rỗng.",
    code: "LISTENING_SHORT_ACCEPTED_REQUIRED",
  }];
  return {
    ...plan(null, importType),
    importType,
    issues,
    payload: {
      importType,
      problems: [{
        title: "Listening Short Answer contract fixture",
        slug: "listening-short-answer-contract-fixture",
        skillType: "LISTENING",
        questionType: "LISTENING_SHORT_ANSWER",
        difficulty: "C1",
        sourceCollection: {
          name: "Synthetic Listening source",
          description: "Synthetic",
          sourceType: importType,
        },
        statement: "Listen and answer.",
        topics: [],
        orderIndex: 0,
        questions: [{
          type: "LISTENING_SHORT_ANSWER",
          skillType: "LISTENING",
          difficulty: "C1",
          prompt: "What is said?",
          options: null,
          answer,
          metadata: validListeningMetadata,
          orderIndex: 0,
        }],
      }],
    },
    summary: {
      ...plan(null, importType).summary,
      warnings: issues.length,
    },
  };
}

const validPronunciationOptions = [
  { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
  { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
  { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
];

function pronunciationPlan(
  options: unknown,
  importType: ImportPlan["importType"] = "JSON",
): ImportPlan {
  const missingSpans =
    Array.isArray(options) &&
    options.some(
      (option) =>
        option &&
        typeof option === "object" &&
        !Object.hasOwn(option, "targetSpan"),
    );
  const issues = missingSpans
    ? [{
        level: "warning" as const,
        path: "problems.0.questions.0.options.0.targetSpan",
        message: "Mỗi lựa chọn Pronunciation cần targetSpan với start và end.",
        code: "PRONUNCIATION_TARGET_SPAN_REQUIRED",
      }]
    : [];
  return {
    ...plan(null, importType),
    importType,
    issues,
    payload: {
      importType,
      problems: [{
        title: "Pronunciation contract fixture",
        slug: "pronunciation-contract-fixture",
        skillType: "PRONUNCIATION",
        questionType: "PRONUNCIATION_ODD_ONE_OUT",
        difficulty: "C1",
        sourceCollection: {
          name: "Synthetic Pronunciation source",
          description: "Synthetic",
          sourceType: importType,
        },
        statement: "Chọn từ khác.",
        topics: [],
        orderIndex: 0,
        questions: [{
          type: "PRONUNCIATION_ODD_ONE_OUT",
          skillType: "PRONUNCIATION",
          difficulty: "C1",
          prompt: "Chọn một từ.",
          options,
          answer: { correctOptionId: "C" },
          metadata: { focus: "not-authoritative" },
          orderIndex: 0,
        }],
      }],
    },
    summary: {
      ...plan(null, importType).summary,
      warnings: issues.length,
    },
  };
}

describe("immediate JSON import-publish boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.normalizeJsonText.mockReturnValue({
      payload: { importType: "JSON", problems: [] },
      issues: [],
    });
    mocks.normalizeCsvText.mockReturnValue({
      payload: { importType: "CSV", problems: [] },
      issues: [],
    });
    mocks.execute.mockImplementation(async (receivedPlan, input) => ({
      ...receivedPlan,
      status: receivedPlan.ok ? "IMPORTED" : "FAILED",
      contentStatus: input.contentStatus,
    }));
  });

  it("returns a publication-blocked JSON result before the atomic executor for legacy null options", async () => {
    mocks.buildImportPlan.mockResolvedValue(plan(null));

    const result = await importJsonPayload("{}", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        path: "problems.contract-fixture.questions.0.options",
      }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("does not promote contract warnings when import remains NEEDS_REVIEW", async () => {
    mocks.buildImportPlan.mockResolvedValue(plan(null));

    const result = await importJsonPayload("{}", "admin-a");

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        summary: expect.objectContaining({ errors: 0, warnings: 1 }),
      }),
      expect.objectContaining({ contentStatus: "NEEDS_REVIEW" }),
    );
  });

  it("keeps malformed CSV options as NEEDS_REVIEW and reaches the executor", async () => {
    mocks.buildImportPlan.mockResolvedValue(plan(null, "CSV"));

    const result = await importCsvRows("csv", "admin-a");

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(result.summary).toEqual(expect.objectContaining({
      errors: 0,
      warnings: 1,
    }));
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, importType: "CSV" }),
      expect.objectContaining({
        importType: "CSV",
        contentStatus: "NEEDS_REVIEW",
      }),
    );
  });

  it("promotes malformed CSV options and stops before atomic publication", async () => {
    mocks.buildImportPlan.mockResolvedValue(plan(null, "CSV"));

    const result = await importCsvRows("csv", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        path: "problems.contract-fixture.questions.0.options",
      }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("blocks malformed Trios %s before the atomic executor", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(triosPlan(null, importType));

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        level: "error",
        code: "TRIOS_METADATA_REQUIRED",
        path: "problems.trios-contract-fixture.questions.0.metadata",
      }),
    ]);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("allows canonical Trios %s immediate publication to reach the executor", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(triosPlan({
      sentences: [
        "The committee reached a _____ after two hours.",
        "Her silence led me to the wrong _____.",
        "The evidence points to one _____.",
      ],
    }, importType));

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, issues: [] }),
      expect.objectContaining({ contentStatus: "PUBLISHED", importType }),
    );
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("blocks malformed Pronunciation %s before atomic persistence", async (importType, importer) => {
    const missingSpans = validPronunciationOptions.map(
      ({ id, text }) => ({ id, text }),
    );
    mocks.buildImportPlan.mockResolvedValue(
      pronunciationPlan(missingSpans, importType),
    );

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code: "PRONUNCIATION_TARGET_SPAN_REQUIRED",
        path: "problems.pronunciation-contract-fixture.questions.0.options.0.targetSpan",
      }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("allows canonical Pronunciation %s immediate publication", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(
      pronunciationPlan(validPronunciationOptions, importType),
    );

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, issues: [] }),
      expect.objectContaining({ contentStatus: "PUBLISHED", importType }),
    );
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("blocks malformed LISTENING_MCQ %s before atomic persistence", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(
      listeningMCQPlan([{ id: "A", text: "A" }], importType),
    );

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code: "LISTENING_MCQ_OPTION_COUNT_INVALID",
        path: "problems.listening-mcq-contract-fixture.questions.0.options",
      }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("allows canonical LISTENING_MCQ %s immediate publication", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(
      listeningMCQPlan([{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], importType),
    );

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, issues: [] }),
      expect.objectContaining({ contentStatus: "PUBLISHED", importType }),
    );
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("blocks malformed LISTENING_SHORT_ANSWER %s before atomic persistence", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(
      listeningShortAnswerPlan({ acceptedAnswers: [] }, importType),
    );

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code: "LISTENING_SHORT_ACCEPTED_REQUIRED",
        path: "problems.listening-short-answer-contract-fixture.questions.0.answer.acceptedAnswers",
      }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("allows canonical LISTENING_SHORT_ANSWER %s immediate publication", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(
      listeningShortAnswerPlan({ acceptedAnswers: ["answer"] }, importType),
    );

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, issues: [] }),
      expect.objectContaining({ contentStatus: "PUBLISHED", importType }),
    );
  });

  it.each([
    ["JSON", importJsonPayload, "audioUrl only", "LISTENING_LEGACY_AUDIO_URL", "problems.0.questions.0.metadata.audioUrl"],
    ["CSV", importCsvRows, "audioUrl only", "LISTENING_LEGACY_AUDIO_URL", "problems.0.questions.0.metadata.audioUrl"],
    ["JSON", importJsonPayload, "sectionType only", "LISTENING_LEGACY_SECTION_TYPE", "problems.0.questions.0.metadata.sectionType"],
    ["CSV", importCsvRows, "sectionType only", "LISTENING_LEGACY_SECTION_TYPE", "problems.0.questions.0.metadata.sectionType"],
  ] as const)("blocks %s immediate publication for %s alias before atomic persistence", async (importType, importer, name, aliasCode, path) => {
    mocks.buildImportPlan.mockResolvedValue(listeningLegacyAliasPlan(aliasCode, importType));

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "error",
        code: aliasCode,
        path,
      }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("blocks %s immediate publication for BOTH aliases before atomic persistence", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(listeningLegacyAliasPlan("BOTH", importType));

    const result = await importer("payload", "admin-a", {
      publishImmediately: true,
    });

    expect(result.status).toBe("FAILED");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "error", code: "LISTENING_LEGACY_AUDIO_URL" }),
      expect.objectContaining({ level: "error", code: "LISTENING_LEGACY_SECTION_TYPE" }),
    ]));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", importJsonPayload],
    ["CSV", importCsvRows],
  ] as const)("allows %s NEEDS_REVIEW import with alias warnings", async (importType, importer) => {
    mocks.buildImportPlan.mockResolvedValue(listeningLegacyAliasPlan("BOTH", importType));

    const result = await importer("payload", "admin-a", {
      publishImmediately: false,
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.ok).toBe(true);
    expect(result.issues.filter(i => i.level === "warning").length).toBe(2);
    expect(result.issues.filter(i => i.level === "error").length).toBe(0);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ contentStatus: "NEEDS_REVIEW" }),
    );
  });
});
