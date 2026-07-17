import { describe, expect, it, vi } from "vitest";
import {
  buildContentPackExecutionManifest,
  contentPackBatchIdentitySummary,
  reconcileContentPackExecutionInTransaction,
  summarizeContentPackExecution,
} from "@/lib/content-packs/execution";
import { createContentPackFileIdentity } from "@/lib/content-packs/file-identity";

const one = createContentPackFileIdentity("one.json", "JSON", "ONE", 0);
const two = createContentPackFileIdentity("two.csv", "CSV", "TWO", 1);

describe("content-pack explicit partial-result policy runtime", () => {
  it("reports exact committed totals for all-success", () => {
    expect(summarizeContentPackExecution([
      { ...one, status: "IMPORTED", problemsImported: 2, questionsImported: 10 },
      { ...two, status: "IMPORTED", problemsImported: 3, questionsImported: 12 },
    ])).toEqual({
      status: "IMPORTED",
      importedFiles: 2,
      failedFiles: 0,
      pendingFiles: 0,
      problemsImported: 5,
      questionsImported: 22,
    });
  });

  it("reports partial success without counting failed-file rows", () => {
    expect(summarizeContentPackExecution([
      { ...one, status: "IMPORTED", problemsImported: 2, questionsImported: 10 },
      { ...two, status: "FAILED", problemsImported: 999, questionsImported: 999 },
    ])).toEqual({
      status: "PARTIALLY_IMPORTED",
      importedFiles: 1,
      failedFiles: 1,
      pendingFiles: 0,
      problemsImported: 2,
      questionsImported: 10,
    });
  });

  it("does not claim success when no file committed", () => {
    expect(summarizeContentPackExecution([
      { ...one, status: "FAILED", problemsImported: 0, questionsImported: 0 },
    ]).status).toBe("FAILED");
  });

  it("keeps a pending entry from final success and excludes its untrusted totals", () => {
    expect(summarizeContentPackExecution([
      { ...one, status: "PENDING", problemsImported: 999, questionsImported: 999 },
    ])).toEqual({
      status: "VALIDATED",
      importedFiles: 0,
      failedFiles: 0,
      pendingFiles: 1,
      problemsImported: 0,
      questionsImported: 0,
    });
  });

  it("does not bind a batch whose content digest differs from the durable entry", async () => {
    const changed = createContentPackFileIdentity("one.json", "JSON", "CHANGED", 0);
    const manifestJson = buildContentPackExecutionManifest(null, [{ ...one, state: "PENDING" }]);
    const tx = {
      contentPack: {
        findUnique: vi.fn().mockResolvedValue({ id: "pack-a", manifestJson }),
        update: vi.fn().mockImplementation(async ({ data }) => ({ id: "pack-a", ...data })),
      },
      importBatch: {
        findMany: vi.fn().mockResolvedValue([{
          id: "batch-changed",
          status: "IMPORTED",
          summary: { ...contentPackBatchIdentitySummary(changed), problemsImported: 9, questionsImported: 99 },
        }]),
      },
    };
    const result = await reconcileContentPackExecutionInTransaction(tx as never, "pack-a");
    expect(result?.summary).toEqual(expect.objectContaining({ status: "VALIDATED", problemsImported: 0, questionsImported: 0 }));
    expect(result?.results[0]).toEqual(expect.objectContaining({ status: "PENDING", problemsImported: 0, questionsImported: 0 }));
  });

  it("refuses ambiguous duplicate committed batches instead of double counting", async () => {
    const manifestJson = buildContentPackExecutionManifest(null, [{ ...one, state: "PENDING" }]);
    const summary = { ...contentPackBatchIdentitySummary(one), problemsImported: 2, questionsImported: 10 };
    const tx = {
      contentPack: {
        findUnique: vi.fn().mockResolvedValue({ id: "pack-a", manifestJson }),
        update: vi.fn(),
      },
      importBatch: {
        findMany: vi.fn().mockResolvedValue([
          { id: "batch-one", status: "IMPORTED", summary },
          { id: "batch-two", status: "IMPORTED", summary },
        ]),
      },
    };
    await expect(reconcileContentPackExecutionInTransaction(tx as never, "pack-a")).resolves.toBeNull();
    expect(tx.contentPack.update).not.toHaveBeenCalled();
  });
});
