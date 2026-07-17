import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportPlan } from "@/lib/import/types";
import { contentPackBatchIdentitySummary } from "@/lib/content-packs/execution";
import type { ContentPackFileIdentity } from "@/lib/content-packs/file-identity";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  validateJson: vi.fn(),
  validateCsv: vi.fn(),
  importJson: vi.fn(),
  importCsv: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/import/json-importer", () => ({
  validateJsonImport: mocks.validateJson,
  importJsonPayload: mocks.importJson,
}));
vi.mock("@/lib/import/csv-importer", () => ({
  validateCsvRows: mocks.validateCsv,
  importCsvRows: mocks.importCsv,
}));

import { importContentPackFiles } from "@/lib/content-packs/importer";

function plan(ok = true): ImportPlan {
  return {
    ok,
    importType: "JSON",
    summary: {
      sourceCollectionsToCreate: 0,
      sourceCollectionsReused: 1,
      topicsToCreate: 0,
      topicsReused: 1,
      problemsToCreate: ok ? 1 : 0,
      questionsToCreate: ok ? 2 : 0,
      duplicateProblemsSkipped: 0,
      duplicateQuestionsSkipped: 0,
      exactDuplicateQuestionsSkipped: 0,
      highSimilarityQuestionsSkipped: 0,
      possibleDuplicateQuestionsFlagged: 0,
      problemsImported: 0,
      questionsImported: 0,
      errors: ok ? 0 : 1,
      warnings: 0,
    },
    issues: ok ? [] : [{ level: "error", path: "file", message: "Invalid file." }],
    preview: [],
    payload: { importType: "JSON", problems: [] },
  };
}

function setupRepository(options: { failFiles?: string[]; failPackPersistence?: boolean } = {}) {
  let pack: Record<string, unknown> | null = null;
  const batches: Array<{ id: string; status: "IMPORTED" | "FAILED"; summary: Record<string, unknown>; createdAt: Date }> = [];
  let batchSequence = 0;
  let failPackPersistence = options.failPackPersistence === true;
  const tx = {
    $queryRaw: vi.fn().mockImplementation(async (query: unknown) => {
      const strings = Array.isArray(query) ? query : (query as { strings?: unknown[] })?.strings;
      const sql = Array.isArray(strings) ? strings.join("?") : String(query);
      if (sql.includes('FROM "User"')) return [{ id: "admin-a", email: "admin@example.test", role: "ADMIN" }];
      if (sql.includes('FROM "ContentPack"')) return pack ? [{ id: pack.id }] : [];
      return [];
    }),
    contentPack: {
      create: vi.fn().mockImplementation(async ({ data }) => {
        pack = { id: "pack-a", createdAt: new Date(), updatedAt: new Date(), ...data };
        return pack;
      }),
      findUnique: vi.fn().mockImplementation(async () => pack),
      update: vi.fn().mockImplementation(async ({ data }) => {
        if (failPackPersistence) throw new Error("pack persistence unavailable");
        pack = { ...pack, ...data, updatedAt: new Date() };
        return pack;
      }),
    },
    importBatch: {
      findMany: vi.fn().mockImplementation(async () => batches),
      create: vi.fn().mockImplementation(async ({ data }) => {
        const batch = { id: `batch-${++batchSequence}`, status: data.status, summary: data.summary, createdAt: new Date() };
        batches.push(batch);
        return batch;
      }),
    },
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  const importFile = async (_content: string, _userId: string, input: { fileIdentity?: ContentPackFileIdentity }) => {
    const identity = input.fileIdentity!;
    const existing = batches.find((batch) => batch.status === "IMPORTED" && batch.summary.executionEntryId === identity.entryId);
    if (existing) {
      return { ...plan(), status: "IMPORTED", batchId: existing.id, summary: existing.summary };
    }
    if (options.failFiles?.includes(identity.fileName)) throw new Error("file commit failed");
    const batch = {
      id: `batch-${++batchSequence}`,
      status: "IMPORTED" as const,
      summary: {
        ...plan().summary,
        ...contentPackBatchIdentitySummary(identity),
        problemsImported: 1,
        questionsImported: 2,
      },
      createdAt: new Date(),
    };
    batches.push(batch);
    return { ...plan(), status: "IMPORTED", batchId: batch.id, summary: batch.summary };
  };
  mocks.importJson.mockImplementation(importFile);
  mocks.importCsv.mockImplementation(importFile);
  return {
    tx,
    batches,
    getPack: () => pack,
    allowPackPersistence: () => { failPackPersistence = false; },
  };
}

const twoFiles = [
  { fileName: "01-one.json", content: "ONE" },
  { fileName: "02-two.json", content: "TWO" },
];

describe("content-pack import orchestrator durability (production orchestrator with mocked collaborators)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateJson.mockResolvedValue(plan());
    mocks.validateCsv.mockResolvedValue(plan());
  });

  it("stores exact durable totals when all files succeed", async () => {
    const repository = setupRepository();
    const result = await importContentPackFiles(twoFiles, "admin-a");
    expect(result.contentPack.status).toBe("IMPORTED");
    expect(result.results.map((item) => item.status)).toEqual(["IMPORTED", "IMPORTED"]);
    expect(result.results.reduce((total, item) => total + item.problemsImported, 0)).toBe(2);
    const manifest = repository.getPack()!.manifestJson as { executionSummary: { problemsImported: number; questionsImported: number } };
    expect(manifest.executionSummary).toEqual(expect.objectContaining({ problemsImported: 2, questionsImported: 4 }));
  });

  it("durably records one committed and one failed file without false all-file success", async () => {
    const repository = setupRepository({ failFiles: ["02-two.json"] });
    const result = await importContentPackFiles(twoFiles, "admin-a");
    expect(result.contentPack.status).toBe("PARTIALLY_IMPORTED");
    expect(result.results.map((item) => item.status)).toEqual(["IMPORTED", "FAILED"]);
    expect(repository.batches.filter((batch) => batch.status === "IMPORTED")).toHaveLength(1);
    expect(repository.batches.filter((batch) => batch.status === "FAILED")).toHaveLength(1);
  });

  it("keeps an invalid file as a durable zero-row failure", async () => {
    setupRepository();
    mocks.validateJson.mockImplementation(async (content: string) => plan(content !== "INVALID"));
    const result = await importContentPackFiles([
      { fileName: "01-valid.json", content: "VALID" },
      { fileName: "02-invalid.json", content: "INVALID" },
    ], "admin-a");
    expect(result.contentPack.status).toBe("PARTIALLY_IMPORTED");
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: "02-invalid.json", status: "FAILED", problemsImported: 0, questionsImported: 0 }),
    ]));
    expect(mocks.importJson).toHaveBeenCalledTimes(1);
  });

  it("rejects when final pack persistence fails", async () => {
    const repository = setupRepository({ failPackPersistence: true });
    await expect(importContentPackFiles(twoFiles, "admin-a")).rejects.toThrow("pack persistence unavailable");
    expect(repository.batches.filter((batch) => batch.status === "IMPORTED")).toHaveLength(2);
    const manifest = repository.getPack()!.manifestJson as { executionPlan: unknown[] };
    expect(manifest.executionPlan).toHaveLength(2);
  });

  it("the internal identical-content resume primitive skips committed work", async () => {
    const repository = setupRepository();
    const first = await importContentPackFiles(twoFiles, "admin-a");
    const committedBefore = repository.batches.filter((batch) => batch.status === "IMPORTED").length;
    const second = await importContentPackFiles(twoFiles, "admin-a", { resumeContentPackId: first.contentPack.id });
    expect(repository.batches.filter((batch) => batch.status === "IMPORTED")).toHaveLength(committedBefore);
    expect(second.results.reduce((total, item) => total + item.problemsImported, 0)).toBe(2);
    expect(second.contentPack.status).toBe("IMPORTED");
  });

  it("rejects every exact duplicate filename before validation or content import", async () => {
    const repository = setupRepository();
    const result = await importContentPackFiles([
      { fileName: "duplicate.json", content: "ONE" },
      { fileName: "duplicate.json", content: "ONE" },
    ], "admin-a");
    expect(result.contentPack.status).toBe("FAILED");
    expect(result.results).toHaveLength(2);
    expect(result.results.every((item) => item.status === "FAILED" && item.problemsImported === 0 && item.questionsImported === 0)).toBe(true);
    expect(new Set(result.results.map((item) => item.entryId)).size).toBe(2);
    expect(repository.batches).toHaveLength(0);
    expect(mocks.validateJson).not.toHaveBeenCalled();
    expect(mocks.importJson).not.toHaveBeenCalled();
  });

  it("rejects case-only duplicate names while importing a distinct file once", async () => {
    const repository = setupRepository();
    const result = await importContentPackFiles([
      { fileName: "Duplicate.JSON", content: "ONE" },
      { fileName: "duplicate.json", content: "TWO" },
      { fileName: "unique.json", content: "THREE" },
    ], "admin-a");
    expect(result.contentPack.status).toBe("PARTIALLY_IMPORTED");
    expect(result.results.filter((item) => item.status === "FAILED")).toHaveLength(2);
    expect(result.results.filter((item) => item.status === "IMPORTED")).toHaveLength(1);
    expect(result.results.reduce((total, item) => total + item.problemsImported, 0)).toBe(1);
    expect(repository.batches.filter((batch) => batch.status === "IMPORTED")).toHaveLength(1);
    expect(mocks.validateJson).toHaveBeenCalledTimes(1);
    expect(mocks.importJson).toHaveBeenCalledTimes(1);
  });

  it("rejects changed content under the same filename before resume import", async () => {
    setupRepository();
    const first = await importContentPackFiles(twoFiles, "admin-a");
    const callsBefore = mocks.importJson.mock.calls.length;
    await expect(importContentPackFiles([
      { fileName: "01-one.json", content: "CHANGED" },
      twoFiles[1],
    ], "admin-a", { resumeContentPackId: first.contentPack.id })).rejects.toMatchObject({ name: "AdminResourceUnavailableError" });
    expect(mocks.importJson).toHaveBeenCalledTimes(callsBefore);
  });

  it("treats a changed filename with identical content as a different identity on resume", async () => {
    setupRepository();
    const first = await importContentPackFiles(twoFiles, "admin-a");
    const callsBefore = mocks.importJson.mock.calls.length;
    await expect(importContentPackFiles([
      { fileName: "01-renamed.json", content: "ONE" },
      twoFiles[1],
    ], "admin-a", { resumeContentPackId: first.contentPack.id })).rejects.toMatchObject({ name: "AdminResourceUnavailableError" });
    expect(mocks.importJson).toHaveBeenCalledTimes(callsBefore);
  });

  it("rejects reordered files for the internal resume primitive", async () => {
    setupRepository();
    const first = await importContentPackFiles(twoFiles, "admin-a");
    await expect(importContentPackFiles([...twoFiles].reverse(), "admin-a", {
      resumeContentPackId: first.contentPack.id,
    })).rejects.toMatchObject({ name: "AdminResourceUnavailableError" });
  });
});
