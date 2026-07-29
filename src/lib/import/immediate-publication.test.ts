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
});
