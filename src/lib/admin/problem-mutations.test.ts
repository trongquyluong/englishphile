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

const validErrorOptions = [
  { id: "A", text: "The students" },
  { id: "B", text: "was" },
  { id: "C", text: "ready" },
  { id: "D", text: "today" },
];

const validTriosMetadata = {
  sentences: [
    "The committee reached a _____ after two hours.",
    "Her silence led me to the wrong _____.",
    "The evidence points to one _____.",
  ],
};

const validPronunciationOptions = [
  { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
  { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
  { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
];

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

function errorQuestionPayload(
  options: unknown = validErrorOptions,
  answer: unknown = { correctPart: "B", correction: "were" },
): QuestionEditPayload {
  return {
    id: "question-a",
    type: "ERROR_IDENTIFICATION",
    skillType: "ERROR_IDENTIFICATION",
    difficulty: "C1",
    prompt: "The students was ready today.",
    options,
    answer,
    orderIndex: 0,
    contentStatus: "PUBLISHED",
  };
}

function triosQuestionPayload(
  metadata: unknown = validTriosMetadata,
  answer: unknown = { acceptedAnswers: ["conclusion"] },
): QuestionEditPayload {
  return {
    id: "question-a",
    type: "TRIOS_GAPPED_SENTENCES",
    skillType: "TRIOS",
    difficulty: "C1",
    prompt: "Điền một từ chung.",
    passage: "Compatibility mirror.",
    options: null,
    answer,
    metadata,
    orderIndex: 0,
    contentStatus: "PUBLISHED",
  };
}

function pronunciationQuestionPayload(
  options: unknown = validPronunciationOptions,
  answer: unknown = { correctOptionId: "C" },
): QuestionEditPayload {
  return {
    id: "question-a",
    type: "PRONUNCIATION_ODD_ONE_OUT",
    skillType: "PRONUNCIATION",
    difficulty: "C1",
    prompt: "Chọn một từ.",
    options,
    answer,
    metadata: { focus: "not-authoritative" },
    orderIndex: 0,
    contentStatus: "PUBLISHED",
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

function listeningMCQQuestionPayload(
  options: unknown = [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }],
  answer: unknown = { correctOptionId: "B" },
): QuestionEditPayload {
  return {
    id: "question-a",
    type: "LISTENING_MCQ",
    skillType: "LISTENING",
    difficulty: "C1",
    prompt: "Listen and choose.",
    options,
    answer,
    metadata: validListeningMetadata,
    orderIndex: 0,
    contentStatus: "PUBLISHED",
  };
}

function listeningShortAnswerQuestionPayload(
  answer: unknown = { acceptedAnswers: ["answer"] },
): QuestionEditPayload {
  return {
    id: "question-a",
    type: "LISTENING_SHORT_ANSWER",
    skillType: "LISTENING",
    difficulty: "C1",
    prompt: "Listen and answer.",
    options: null,
    answer,
    metadata: validListeningMetadata,
    orderIndex: 0,
    contentStatus: "PUBLISHED",
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
  corpusQuestions?: Array<{
    id: string;
    problemId: string;
    type: string;
    prompt: string;
  }>;
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
      findMany: vi.fn().mockResolvedValue(options.corpusQuestions ??
        targets.flatMap((target) =>
          target.questions.map((question) => ({
            id: question.id,
            problemId: question.problemId,
            type: question.type,
            prompt: question.prompt,
          })),
        )),
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

  it("edit-to-publish revalidates an omitted invalid Error Identification row after the lock", async () => {
    const stored = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: null,
        answer: { correctPart: "A", correction: "fixed" },
      }],
    };
    const tx = transactionWith({
      targets: [stored as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await updateProblemWithQuestions(
      {
        ...problemPayload,
        questionType: "ERROR_IDENTIFICATION",
        skillType: "ERROR_IDENTIFICATION",
        contentStatus: "PUBLISHED",
      },
      [],
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("bốn phần");
    expect(tx.problem.findUnique).toHaveBeenCalled();
    expect(tx.problem.update).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("edit-to-publish accepts a valid Error Identification candidate through the locked write path", async () => {
    const stored = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: null,
        answer: { correctPart: "A", correction: "fixed" },
      }],
    };
    const tx = transactionWith({
      targets: [stored as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await updateProblemWithQuestions(
      {
        ...problemPayload,
        questionType: "ERROR_IDENTIFICATION",
        skillType: "ERROR_IDENTIFICATION",
        contentStatus: "PUBLISHED",
      },
      [errorQuestionPayload()],
      "admin-a",
    );

    expect(result.ok).toBe(true);
    expect(tx.problem.findUnique).toHaveBeenCalled();
    expect(tx.problem.update).toHaveBeenCalled();
    expect(tx.question.updateMany).toHaveBeenCalled();
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

  it("individual publish rejects legacy Error Identification without A-D options", async () => {
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: null,
        answer: { correctPart: "A", correction: "replacement" },
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await setProblemContentStatus(
      "problem-a",
      "PUBLISHED",
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("bốn phần");
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("individual publish accepts a valid canonical Error Identification row", async () => {
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: validErrorOptions,
        answer: { correctPart: "B", correction: "were" },
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await setProblemContentStatus(
      "problem-a",
      "PUBLISHED",
      "admin-a",
    );

    expect(result.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalled();
    expect(tx.question.updateMany).toHaveBeenCalled();
  });

  it("bulk publish-safe rejects persisted Error Identification QA errors", async () => {
    const target = {
      ...storedProblem("problem-a", "pack-a"),
      title: "Error Identification fixture",
      slug: "error-identification-fixture",
      statement: "Chọn phần sai.",
      instructions: "Chọn A-D và sửa lại.",
      estimatedMinutes: 5,
      questionType: "ERROR_IDENTIFICATION" as const,
      sourceCollection: { id: "source-a", name: "Synthetic source" },
      problemTopics: [{
        topic: { id: "topic-a", name: "Grammar", slug: "grammar" },
      }],
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: null,
        answer: { correctPart: "A", correction: "replacement" },
      }],
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
      { contentPackId: "pack-a", qaRequirement: "safe" },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("QA");
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("bulk publish-safe remains tolerant of substantive duplicate-prompt warnings", async () => {
    const duplicatePrompt = "Which option completes this substantive sentence correctly?";
    const target = {
      ...storedProblem("problem-a", "pack-a"),
      title: "Duplicate prompt warning fixture",
      slug: "duplicate-prompt-warning-fixture",
      statement: "Chọn đáp án đúng.",
      instructions: "Chọn một đáp án.",
      estimatedMinutes: 5,
      questionType: "MCQ" as const,
      sourceCollection: { id: "source-a", name: "Synthetic source" },
      problemTopics: [{
        topic: { id: "topic-a", name: "Grammar", slug: "grammar" },
      }],
      questions: [{
        ...storedQuestion(),
        prompt: duplicatePrompt,
        explanation: "Giải thích đầy đủ cho câu hỏi kiểm thử cảnh báo trùng prompt.",
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
      corpusQuestions: [
        {
          id: "question-a",
          problemId: "problem-a",
          type: "MCQ",
          prompt: duplicatePrompt,
        },
        {
          id: "question-comparison",
          problemId: "problem-comparison",
          type: "OPEN_CLOZE",
          prompt: duplicatePrompt.toUpperCase(),
        },
      ],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
      { contentPackId: "pack-a", qaRequirement: "safe" },
    );

    expect(result.ok).toBe(true);
    expect(tx.question.findMany).toHaveBeenCalledTimes(1);
    expect(tx.problem.updateMany).toHaveBeenCalled();
    expect(tx.question.updateMany).toHaveBeenCalled();
  });

  it("ordinary bulk publish rejects an invalid Error Identification row after transaction reload", async () => {
    const target = {
      ...storedProblem("problem-a"),
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: null,
        answer: { correctPart: "A", correction: "fixed" },
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("bốn phần");
    expect(tx.problem.findMany).toHaveBeenCalled();
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("ordinary bulk publish accepts a valid canonical Error Identification row", async () => {
    const target = {
      ...storedProblem("problem-a"),
      questions: [{
        ...storedQuestion(),
        type: "ERROR_IDENTIFICATION" as const,
        skillType: "ERROR_IDENTIFICATION" as const,
        options: validErrorOptions,
        answer: { correctPart: "B", correction: "were" },
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
    );

    expect(result.ok).toBe(true);
    expect(tx.problem.findMany).toHaveBeenCalled();
    expect(tx.problem.updateMany).toHaveBeenCalled();
    expect(tx.question.updateMany).toHaveBeenCalled();
  });

  it("individual publish blocks missing Pronunciation spans and accepts a complete row", async () => {
    const missingSpans = validPronunciationOptions.map(
      ({ id, text }) => ({ id, text }),
    );
    let target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...pronunciationQuestionPayload(missingSpans),
      }],
    };
    let tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const blocked = await setProblemContentStatus(
      "problem-a",
      "PUBLISHED",
      "admin-a",
    );

    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain("targetSpan");
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();

    target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...pronunciationQuestionPayload(),
      }],
    };
    tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const accepted = await setProblemContentStatus(
      "problem-a",
      "PUBLISHED",
      "admin-a",
    );

    expect(accepted.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalled();
    expect(tx.question.updateMany).toHaveBeenCalled();
  });

  it("edit-to-publish rechecks omitted Pronunciation rows after lock/reload", async () => {
    const missingSpans = validPronunciationOptions.map(
      ({ id, text }) => ({ id, text }),
    );
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...pronunciationQuestionPayload(missingSpans),
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await updateProblemWithQuestions(
      {
        ...problemPayload,
        questionType: "PRONUNCIATION_ODD_ONE_OUT",
        skillType: "PRONUNCIATION",
        contentStatus: "PUBLISHED",
      },
      [],
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("targetSpan");
    expect(tx.problem.findUnique).toHaveBeenCalled();
    expect(tx.problem.update).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("ordinary bulk publication blocks malformed Pronunciation after locked reload", async () => {
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...pronunciationQuestionPayload(validPronunciationOptions, {
          correctOptionId: "E",
        }),
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("A, B, C hoặc D");
    expect(tx.problem.findMany).toHaveBeenCalled();
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("bulk publish-safe rechecks Pronunciation QA under locks", async () => {
    const target = {
      ...storedProblem("problem-a", "pack-a"),
      title: "Pronunciation QA fixture",
      slug: "pronunciation-qa-fixture",
      statement: "Chọn từ có phần gạch chân phát âm khác.",
      instructions: "Chọn một đáp án.",
      estimatedMinutes: 5,
      questionType: "PRONUNCIATION_ODD_ONE_OUT" as const,
      sourceCollection: { id: "source-a", name: "Synthetic source" },
      problemTopics: [{
        topic: { id: "topic-a", name: "Pronunciation", slug: "pronunciation" },
      }],
      questions: [{
        ...storedQuestion(),
        ...pronunciationQuestionPayload(
          validPronunciationOptions.map(
            ({ id, text }) => ({ id, text }),
          ),
        ),
      }],
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
      { contentPackId: "pack-a", qaRequirement: "safe" },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("QA");
    expect(tx.problem.findMany).toHaveBeenCalled();
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("edit-to-publish rejects an omitted malformed Trios row after lock and reload", async () => {
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...triosQuestionPayload(null),
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await updateProblemWithQuestions(
      {
        ...problemPayload,
        questionType: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        contentStatus: "PUBLISHED",
      },
      [],
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("metadata");
    expect(tx.problem.findUnique).toHaveBeenCalled();
    expect(tx.problem.update).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("edit-to-publish accepts a complete canonical Trios candidate", async () => {
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...triosQuestionPayload(null),
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await updateProblemWithQuestions(
      {
        ...problemPayload,
        questionType: "TRIOS_GAPPED_SENTENCES",
        skillType: "TRIOS",
        contentStatus: "PUBLISHED",
      },
      [triosQuestionPayload()],
      "admin-a",
    );

    expect(result.ok).toBe(true);
    expect(tx.problem.update).toHaveBeenCalled();
    expect(tx.question.updateMany).toHaveBeenCalled();
  });

  it("individual publish rejects malformed Trios and accepts canonical Trios", async () => {
    const malformedTarget = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...triosQuestionPayload({
          sentences: [
            validTriosMetadata.sentences[0],
            "Two _____ gaps _____.",
            validTriosMetadata.sentences[2],
          ],
        }),
      }],
    };
    let tx = transactionWith({
      targets: [malformedTarget as unknown as ReturnType<typeof storedProblem>],
    });
    const blocked = await setProblemContentStatus(
      "problem-a",
      "PUBLISHED",
      "admin-a",
    );

    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain("dấu khuyết");
    expect(tx.problem.updateMany).not.toHaveBeenCalled();

    const validTarget = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...triosQuestionPayload(),
      }],
    };
    tx = transactionWith({
      targets: [validTarget as unknown as ReturnType<typeof storedProblem>],
    });
    const accepted = await setProblemContentStatus(
      "problem-a",
      "PUBLISHED",
      "admin-a",
    );

    expect(accepted.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalled();
  });

  it("ordinary bulk publish blocks an invalid Trios answer after transaction reload", async () => {
    const target = {
      ...storedProblem(),
      questions: [{
        ...storedQuestion(),
        ...triosQuestionPayload(validTriosMetadata, {
          acceptedAnswers: ["in conclusion"],
        }),
      }],
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("đúng một từ");
    expect(tx.problem.findMany).toHaveBeenCalled();
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
    expect(tx.question.updateMany).not.toHaveBeenCalled();
  });

  it("bulk publish-safe rechecks persisted Trios QA under locks", async () => {
    const target = {
      ...storedProblem("problem-a", "pack-a"),
      title: "Trios QA fixture",
      slug: "trios-qa-fixture",
      statement: "Điền một từ chung.",
      instructions: "Dùng đúng một từ.",
      estimatedMinutes: 5,
      questionType: "TRIOS_GAPPED_SENTENCES" as const,
      sourceCollection: { id: "source-a", name: "Synthetic source" },
      problemTopics: [{
        topic: { id: "topic-a", name: "Trios", slug: "trios" },
      }],
      questions: [{
        ...storedQuestion(),
        ...triosQuestionPayload(null),
      }],
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const tx = transactionWith({
      targets: [target as unknown as ReturnType<typeof storedProblem>],
    });
    const result = await bulkUpdateProblemStatus(
      ["problem-a"],
      "PUBLISHED",
      "admin-a",
      { contentPackId: "pack-a", qaRequirement: "safe" },
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("QA");
    expect(tx.problem.findMany).toHaveBeenCalled();
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
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

    transactionWith({ resourceRows: [] });
    await bulkUpdateProblemStatus(["missing"], "ARCHIVED", "admin-a");
  });

  it("individual publish blocks malformed LISTENING_MCQ and accepts canonical", async () => {
    const malformedTarget = {
      ...storedProblem(),
      questions: [{ ...storedQuestion(), ...listeningMCQQuestionPayload([]) }],
    };
    let tx = transactionWith({ targets: [malformedTarget as never] });
    const blocked = await setProblemContentStatus("problem-a", "PUBLISHED", "admin-a");
    expect(blocked.ok).toBe(false);
    expect(tx.problem.updateMany).not.toHaveBeenCalled();

    const validTarget = {
      ...storedProblem(),
      questions: [{ ...storedQuestion(), ...listeningMCQQuestionPayload() }],
    };
    tx = transactionWith({ targets: [validTarget as never] });
    const accepted = await setProblemContentStatus("problem-a", "PUBLISHED", "admin-a");
    expect(accepted.ok).toBe(true);
    expect(tx.problem.updateMany).toHaveBeenCalled();
  });

  it("edit-to-publish rechecks omitted LISTENING_SHORT_ANSWER row after lock", async () => {
    const malformedTarget = {
      ...storedProblem(),
      questions: [{ ...storedQuestion(), ...listeningShortAnswerQuestionPayload({ acceptedAnswers: [] }) }],
    };
    const tx = transactionWith({ targets: [malformedTarget as never] });
    const result = await updateProblemWithQuestions(
      { ...problemPayload, questionType: "LISTENING_SHORT_ANSWER", skillType: "LISTENING", contentStatus: "PUBLISHED" },
      [],
      "admin-a"
    );
    expect(result.ok).toBe(false);
    expect(tx.problem.update).not.toHaveBeenCalled();
  });

  it("ordinary bulk publish blocks malformed LISTENING_MCQ after reload", async () => {
    const target = {
      ...storedProblem(),
      questions: [{ ...storedQuestion(), ...listeningMCQQuestionPayload(undefined, { correctOptionId: "Z" }) }],
    };
    const tx = transactionWith({ targets: [target as never] });
    const result = await bulkUpdateProblemStatus(["problem-a"], "PUBLISHED", "admin-a");
    expect(result.ok).toBe(false);
    expect(tx.problem.updateMany).not.toHaveBeenCalled();
  });
});
