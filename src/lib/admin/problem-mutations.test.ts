import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: database.transaction } }));

import {
  bulkUpdateProblemStatus,
  setProblemContentStatus,
  updateProblemWithQuestions,
  MAX_PROBLEM_EDIT_QUESTIONS,
  MAX_PROBLEM_TOPIC_ASSOCIATIONS,
  type ProblemEditPayload,
} from "@/lib/admin/problems";
import type { QuestionEditPayload } from "@/lib/admin/questions";
import { ADMIN_RESOURCE_UNAVAILABLE, MAX_ADMIN_BULK_ITEMS, MAX_ADMIN_BULK_QUESTIONS } from "@/lib/admin/mutation-locks";

const problemPayload: ProblemEditPayload = {
  id: "problem-a",
  title: "Problem A",
  slug: "problem-a",
  statement: "Statement",
  skillType: "MULTIPLE_CHOICE",
  questionType: "MCQ",
  difficulty: "B2",
  estimatedMinutes: 10,
  sourceCollectionId: null,
  topicTags: [],
  contentStatus: "DRAFT",
};

function questionPayload(id = "question-a"): QuestionEditPayload {
  return {
    id,
    type: "MCQ",
    skillType: "MULTIPLE_CHOICE",
    difficulty: "B2",
    prompt: "Prompt",
    options: [{ id: "A", text: "Answer" }, { id: "B", text: "Other" }],
    answer: { correctOptionId: "A", secret: "must-not-be-audited" },
    orderIndex: 0,
    contentStatus: "DRAFT",
  };
}

function storedQuestion(id = "question-a") {
  return {
    ...questionPayload(id),
    problemId: "problem-a",
    passage: null,
    explanation: null,
    rootWord: null,
    keyword: null,
    targetSentence: null,
    lineNumber: null,
    metadata: null,
    reviewedAt: null,
    reviewedById: null,
  };
}

function storedProblem(id = "problem-a", contentPackId: string | null = null) {
  return {
    id,
    contentPackId,
    contentStatus: "DRAFT" as const,
    publishedAt: null,
    reviewedAt: null,
    reviewedById: null,
    questions: [storedQuestion(id === "problem-a" ? "question-a" : `question-${id}`)],
    problemTopics: [],
  };
}

function sqlText(query: unknown) {
  if (Array.isArray(query)) return query.join("?");
  const strings = (query as { strings?: unknown[] })?.strings;
  return Array.isArray(strings) ? strings.join("?") : String(query);
}

function transactionWith(options: {
  principal?: { id: string; email: string; role: "STUDENT" | "ADMIN" } | null;
  resourceRows?: Array<{ id: string }>;
  targets?: ReturnType<typeof storedProblem>[];
} = {}) {
  let resourceRows = options.resourceRows ?? [{ id: "problem-a" }];
  const targets = options.targets ?? [storedProblem()];
  const principal = options.principal === undefined
    ? { id: "admin-a", email: "admin@example.test", role: "ADMIN" as const }
    : options.principal;
  const tx = {
    $queryRaw: vi.fn().mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes('FROM "User"')) return principal ? [principal] : [];
      if (sql.includes('FROM "ContentPack"')) return [{ id: "pack-a" }];
      return resourceRows;
    }),
    problem: {
      findUnique: vi.fn().mockResolvedValue(targets[0] ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(targets),
      update: vi.fn().mockResolvedValue({ id: "problem-a", contentStatus: "DRAFT", problemTopics: [] }),
      updateMany: vi.fn().mockImplementation(async ({ where }) => ({ count: where.id.in.length })),
    },
    question: {
      findFirst: vi.fn().mockResolvedValue(storedQuestion()),
      findUnique: vi.fn().mockResolvedValue(storedQuestion()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    topic: { findFirst: vi.fn(), create: vi.fn() },
    contentAuditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit" }),
      createMany: vi.fn().mockResolvedValue({ count: targets.length }),
    },
  };
  Object.assign(tx, { setResourceRows: (rows: Array<{ id: string }>) => { resourceRows = rows; } });
  database.transaction.mockImplementation(async (callback) => callback(tx));
  return tx;
}

describe("problem/question atomic admin mutations (production helpers with mocked Prisma transaction)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a question belonging to Problem A and scopes the write by problemId", async () => {
    const tx = transactionWith();
    const result = await updateProblemWithQuestions(problemPayload, [questionPayload()], "admin-a");
    expect(result.ok).toBe(true);
    expect(tx.question.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "question-a", problemId: "problem-a" },
    }));
  });

  it("persists only safe mapper output through the actual problem/question audit writers", async () => {
    const tx = transactionWith();
    await updateProblemWithQuestions(problemPayload, [questionPayload()], "admin-a");
    expect(tx.contentAuditLog.create).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(tx.contentAuditLog.create.mock.calls);
    for (const sentinel of ["must-not-be-audited", "Prompt", "Answer", "Statement"]) {
      expect(serialized).not.toContain(sentinel);
    }
    for (const call of tx.contentAuditLog.create.mock.calls) {
      expect(call[0].data.afterJson.changedFields).toEqual([...new Set(call[0].data.afterJson.changedFields)]);
      expect(call[0].data.afterJson.changedFields.length).toBeLessThanOrEqual(32);
    }
  });

  it("rejects a Problem B question through Problem A before any content mutation", async () => {
    const tx = transactionWith();
    const result = await updateProblemWithQuestions(problemPayload, [questionPayload("question-b")], "admin-a");
    expect(result).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(tx.problem.update).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate question IDs before opening a transaction", async () => {
    const result = await updateProblemWithQuestions(problemPayload, [questionPayload(), questionPayload()], "admin-a");
    expect(result.ok).toBe(false);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("rejects oversized edit questions and topic associations before opening a content transaction", async () => {
    const tooManyQuestions = Array.from({ length: MAX_PROBLEM_EDIT_QUESTIONS + 1 }, (_, index) => questionPayload(`q-${index}`));
    expect((await updateProblemWithQuestions(problemPayload, tooManyQuestions, "admin-a")).ok).toBe(false);
    const tooManyTopics = {
      ...problemPayload,
      topicTags: Array.from({ length: MAX_PROBLEM_TOPIC_ASSOCIATIONS + 1 }, (_, index) => `Topic ${index}`),
    };
    expect((await updateProblemWithQuestions(tooManyTopics, [], "admin-a")).ok).toBe(false);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("rejects a mixed valid/foreign list with zero mutations", async () => {
    const tx = transactionWith();
    const result = await updateProblemWithQuestions(problemPayload, [questionPayload(), questionPayload("question-b")], "admin-a");
    expect(result.ok).toBe(false);
    expect(tx.problem.update).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("simulates rollback at the mocked transaction boundary when an audit write fails", async () => {
    const tx = transactionWith();
    const pending: string[] = [];
    const committed: string[] = [];
    tx.problem.update.mockImplementation(async () => {
      pending.push("problem");
      return { id: "problem-a", contentStatus: "DRAFT", problemTopics: [] };
    });
    tx.contentAuditLog.create.mockRejectedValue(new Error("audit unavailable"));
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
    await expect(updateProblemWithQuestions(problemPayload, [questionPayload()], "admin-a")).rejects.toThrow("audit unavailable");
    expect(committed).toEqual([]);
  });

  it("uses set-based status, child, and audit mutations for a bounded bulk", async () => {
    const targets = [storedProblem("problem-a"), storedProblem("problem-b")];
    const tx = transactionWith({ resourceRows: targets.map(({ id }) => ({ id })), targets });
    const result = await bulkUpdateProblemStatus(["problem-a", "problem-b"], "NEEDS_REVIEW", "admin-a");
    expect(result.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.question.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.contentAuditLog.createMany).toHaveBeenCalledTimes(1);
    expect(tx.problem.findUnique).not.toHaveBeenCalled();
  });

  it("simulates rollback when the set-based audit mutation fails", async () => {
    const targets = [storedProblem("problem-a"), storedProblem("problem-b")];
    const tx = transactionWith({ resourceRows: targets.map(({ id }) => ({ id })), targets });
    tx.contentAuditLog.createMany.mockRejectedValue(new Error("audit failed"));
    await expect(bulkUpdateProblemStatus(["problem-a", "problem-b"], "ARCHIVED", "admin-a")).rejects.toThrow("audit failed");
  });

  it("publishes a valid problem with child status and audit in the same mocked callback", async () => {
    const tx = transactionWith();
    const result = await setProblemContentStatus("problem-a", "PUBLISHED", "admin-a");
    expect(result.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ contentStatus: "PUBLISHED" }) }));
    expect(tx.question.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ contentStatus: "PUBLISHED" }) }));
    expect(tx.contentAuditLog.createMany).toHaveBeenCalledTimes(1);
  });

  it("does not publish when a locked child is invalid", async () => {
    const target = { ...storedProblem(), questions: [{ ...storedQuestion(), prompt: "", answer: {} }] };
    const tx = transactionWith({ targets: [target] });
    const result = await setProblemContentStatus("problem-a", "PUBLISHED", "admin-a");
    expect(result.ok).toBe(false);
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.contentAuditLog.createMany).not.toHaveBeenCalled();
  });

  it("keeps status audit JSON bounded and excludes question prompts, answers, and arrays", async () => {
    const tx = transactionWith();
    await setProblemContentStatus("problem-a", "PUBLISHED", "admin-a");
    const auditData = tx.contentAuditLog.createMany.mock.calls[0][0].data[0];
    const serialized = JSON.stringify(auditData);
    expect(serialized).not.toContain("questions");
    expect(serialized).not.toContain("must-not-be-audited");
    expect(serialized).not.toContain("Prompt");
    expect(auditData.beforeJson).toEqual(expect.objectContaining({ id: "problem-a", contentStatus: "DRAFT" }));
  });

  it("rechecks content-pack membership under the pack and problem locks", async () => {
    const member = storedProblem("problem-a", "pack-a");
    const tx = transactionWith({ targets: [member] });
    const result = await bulkUpdateProblemStatus(["problem-a"], "NEEDS_REVIEW", "admin-a", { contentPackId: "pack-a" });
    expect(result.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rejects foreign or changed pack membership with zero writes", async () => {
    const moved = storedProblem("problem-a", "pack-b");
    const tx = transactionWith({ targets: [moved] });
    const result = await bulkUpdateProblemStatus(["problem-a"], "PUBLISHED", "admin-a", { contentPackId: "pack-a", qaRequirement: "safe" });
    expect(result).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
    expect(tx.contentAuditLog.createMany).not.toHaveBeenCalled();
  });

  it("rejects excessive related-question work before status writes", async () => {
    const target = { ...storedProblem(), questions: Array.from({ length: MAX_ADMIN_BULK_QUESTIONS + 1 }, (_, index) => storedQuestion(`q-${index}`)) };
    const tx = transactionWith({ targets: [target] });
    const result = await bulkUpdateProblemStatus(["problem-a"], "ARCHIVED", "admin-a");
    expect(result.ok).toBe(false);
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
  });

  it("handles empty, duplicate, oversized, and unknown bulk IDs without partial mutation", async () => {
    expect((await bulkUpdateProblemStatus([], "ARCHIVED", "admin-a")).ok).toBe(false);
    expect((await bulkUpdateProblemStatus(["a", "a"], "ARCHIVED", "admin-a")).ok).toBe(false);
    expect((await bulkUpdateProblemStatus(Array.from({ length: MAX_ADMIN_BULK_ITEMS + 1 }, (_, index) => `p-${index}`), "ARCHIVED", "admin-a")).ok).toBe(false);
    expect(database.transaction).not.toHaveBeenCalled();

    const tx = transactionWith({ resourceRows: [] });
    const unknown = await bulkUpdateProblemStatus(["missing"], "ARCHIVED", "admin-a");
    expect(unknown).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
  });
});
