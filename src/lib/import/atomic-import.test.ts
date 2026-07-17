import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportPlan, NormalizedProblem } from "@/lib/import/types";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
const imported = vi.hoisted(() => ({ problem: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: database.transaction } }));
vi.mock("@/lib/import/duplicates", () => ({
  createProblemWithQuestions: imported.problem,
  generateSlug: (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
}));

import {
  executeImportPlanAtomically,
  inspectImportCommitBounds,
  MAX_IMPORT_PROBLEMS_PER_COMMIT,
  MAX_IMPORT_TOPIC_ASSOCIATIONS_PER_COMMIT,
} from "@/lib/import/atomic-import";
import { ContentAdminTransactionAuthorizationError } from "@/lib/auth/content-admin-transaction";
import {
  buildContentPackExecutionManifest,
  contentPackBatchIdentitySummary,
} from "@/lib/content-packs/execution";
import { createContentPackFileIdentity } from "@/lib/content-packs/file-identity";

function normalizedProblem(slug: string, topics = ["Grammar"]): NormalizedProblem {
  return {
    title: slug,
    slug,
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "B2",
    sourceCollection: { name: "Source", description: "Description", sourceType: "JSON" },
    statement: "Statement",
    topics,
    questions: [{
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "B2",
      prompt: "Prompt",
      options: [{ id: "A", text: "Answer" }, { id: "B", text: "Other" }],
      answer: { correctOptionId: "A" },
      orderIndex: 0,
    }],
    orderIndex: 0,
  };
}

function plan(problems: NormalizedProblem[], ok = true): ImportPlan {
  return {
    ok,
    importType: "JSON",
    summary: {
      sourceCollectionsToCreate: 0,
      sourceCollectionsReused: 1,
      topicsToCreate: 0,
      topicsReused: 1,
      problemsToCreate: problems.length,
      questionsToCreate: problems.reduce((total, problem) => total + problem.questions.length, 0),
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
    issues: ok ? [] : [{ level: "error", path: "payload", message: "Invalid plan." }],
    preview: [],
    payload: { importType: "JSON", problems },
  };
}

function transaction(principal: { id: string; email: string; role: "STUDENT" | "ADMIN" } | null = {
  id: "admin-a",
  email: "admin@example.test",
  role: "ADMIN",
}) {
  const tx = {
    $queryRaw: vi.fn().mockImplementation(async (query: unknown) => {
      const strings = Array.isArray(query) ? query : (query as { strings?: unknown[] })?.strings;
      const sql = Array.isArray(strings) ? strings.join("?") : String(query);
      if (sql.includes('FROM "User"')) return principal ? [principal] : [];
      if (sql.includes('FROM "ContentPack"')) return [{ id: "pack-a" }];
      return [];
    }),
    importBatch: {
      create: vi.fn().mockResolvedValue({ id: "batch-a" }),
      update: vi.fn().mockResolvedValue({ id: "batch-a" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    contentPack: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    sourceCollection: {
      findMany: vi.fn().mockResolvedValue([{ id: "source-a", name: "Source" }]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    topic: {
      findMany: vi.fn().mockResolvedValue([{ id: "topic-a", name: "Grammar", slug: "grammar" }]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  database.transaction.mockImplementation(async (callback) => callback(tx));
  imported.problem.mockResolvedValue({ id: "problem" });
  return tx;
}

describe("atomic JSON/CSV commit helper (production function with mocked Prisma transaction)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("commits batch status and every imported problem together on all-success", async () => {
    const tx = transaction();
    const result = await executeImportPlanAtomically(plan([normalizedProblem("one"), normalizedProblem("two")]), {
      importType: "JSON",
      userId: "admin-a",
      contentStatus: "NEEDS_REVIEW",
    });
    expect(result.status).toBe("IMPORTED");
    expect(result.summary.problemsImported).toBe(2);
    expect(imported.problem).toHaveBeenCalledTimes(2);
    expect(tx.sourceCollection.findMany).toHaveBeenCalledTimes(1);
    expect(tx.topic.findMany).toHaveBeenCalledTimes(1);
    expect(tx.importBatch.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "IMPORTED" }) }));
  });

  it("simulates rollback at the mocked repository boundary when a later problem fails", async () => {
    const tx = transaction();
    const pending: string[] = [];
    const committed: string[] = [];
    imported.problem
      .mockImplementationOnce(async () => { pending.push("one"); return { id: "one" }; })
      .mockRejectedValueOnce(new Error("second problem failed"));
    database.transaction.mockImplementation(async (callback) => {
      try {
        const value = await callback(tx);
        committed.push(...pending);
        return value;
      } catch (error) {
        pending.length = 0;
        throw error;
      }
    });
    await expect(executeImportPlanAtomically(plan([normalizedProblem("one"), normalizedProblem("two")]), {
      importType: "CSV", userId: "admin-a", contentStatus: "NEEDS_REVIEW",
    })).rejects.toThrow("second problem failed");
    expect(committed).toEqual([]);
    expect(tx.importBatch.update).not.toHaveBeenCalled();
  });

  it("rejects actual oversized payload counts before content creation even when summary counters understate them", async () => {
    const tx = transaction();
    const oversized = Array.from({ length: MAX_IMPORT_PROBLEMS_PER_COMMIT + 1 }, (_, index) => normalizedProblem(`p-${index}`));
    const understated = plan(oversized);
    understated.summary.problemsToCreate = 0;
    understated.summary.questionsToCreate = 0;
    const result = await executeImportPlanAtomically(understated, {
      importType: "JSON", userId: "admin-a", contentStatus: "NEEDS_REVIEW",
    });
    expect(result.status).toBe("FAILED");
    expect(result.summary.problemsToCreate).toBe(oversized.length);
    expect(imported.problem).not.toHaveBeenCalled();
    expect(tx.sourceCollection.findMany).not.toHaveBeenCalled();
    expect(tx.importBatch.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });

  it("rejects a direct invalid-plan invocation before content creation", async () => {
    const tx = transaction();
    const result = await executeImportPlanAtomically(plan([normalizedProblem("one")], false), {
      importType: "JSON", userId: "admin-a", contentStatus: "NEEDS_REVIEW",
    });
    expect(result.status).toBe("FAILED");
    expect(imported.problem).not.toHaveBeenCalled();
    expect(tx.sourceCollection.findMany).not.toHaveBeenCalled();
  });

  it("enforces normalized association counts and duplicate topics cannot inflate or bypass limits", () => {
    const duplicates = normalizedProblem("one", ["Grammar", " Grammar ", "Grammar"]);
    expect(inspectImportCommitBounds(plan([duplicates])).topicAssociationCount).toBe(1);
    const excessive = normalizedProblem("two", Array.from({ length: MAX_IMPORT_TOPIC_ASSOCIATIONS_PER_COMMIT + 1 }, (_, index) => `Topic ${index}`));
    expect(inspectImportCommitBounds(plan([excessive])).withinBounds).toBe(false);
  });

  it("denies a missing current principal before taxonomy lookup or content writes", async () => {
    const tx = transaction(null);
    await expect(executeImportPlanAtomically(plan([normalizedProblem("one")]), {
      importType: "JSON", userId: "deleted-admin", contentStatus: "NEEDS_REVIEW",
    })).rejects.toBeInstanceOf(ContentAdminTransactionAuthorizationError);
    expect(tx.sourceCollection.findMany).not.toHaveBeenCalled();
    expect(imported.problem).not.toHaveBeenCalled();
  });

  it("uses the durable file identity to avoid importing an already committed pack file again", async () => {
    const tx = transaction();
    const identity = createContentPackFileIdentity("01-one.json", "JSON", "ONE", 0);
    tx.contentPack.findUnique.mockResolvedValue({
      manifestJson: buildContentPackExecutionManifest(null, [{ ...identity, state: "PENDING" }]),
    });
    tx.importBatch.findMany.mockResolvedValue([{
      id: "batch-existing",
      summary: {
        ...plan([]).summary,
        ...contentPackBatchIdentitySummary(identity),
        problemsImported: 1,
        questionsImported: 2,
      },
    }]);
    const result = await executeImportPlanAtomically(plan([normalizedProblem("one")]), {
      importType: "JSON",
      userId: "admin-a",
      contentStatus: "NEEDS_REVIEW",
      contentPackId: "pack-a",
      fileIdentity: identity,
    });
    expect(result).toEqual(expect.objectContaining({ status: "IMPORTED", batchId: "batch-existing" }));
    expect(imported.problem).not.toHaveBeenCalled();
    expect(tx.importBatch.create).not.toHaveBeenCalled();
  });
});
