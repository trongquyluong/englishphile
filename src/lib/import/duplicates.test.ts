import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  createProblemWithQuestions,
  type ImportProblemWriteStage,
} from "@/lib/import/duplicates";
import type { NormalizedProblem } from "@/lib/import/types";

function normalizedProblem(): NormalizedProblem {
  return {
    title: "Synthetic title",
    slug: "synthetic-slug",
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "B2",
    sourceCollection: { name: "Synthetic source", description: "Synthetic description", sourceType: "JSON" },
    statement: "Synthetic statement",
    instructions: "Synthetic instructions",
    estimatedMinutes: 10,
    topics: ["Synthetic topic"],
    questions: [{
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "B2",
      prompt: "Synthetic prompt",
      options: [{ id: "A", text: "Synthetic option" }],
      answer: { correctOptionId: "A" },
      explanation: "Synthetic explanation",
      orderIndex: 0,
    }],
    orderIndex: 3,
  };
}

function transaction() {
  return {
    problem: { create: vi.fn() },
    question: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    problemTopic: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as Prisma.TransactionClient;
}

describe("createProblemWithQuestions operation staging (production helper with mocked transaction)", () => {
  it("reports one nested stage immediately before the unchanged nested Problem.create", async () => {
    const tx = transaction();
    const stages: ImportProblemWriteStage[] = [];
    tx.problem.create = vi.fn().mockImplementation(async (input) => {
      expect(stages).toEqual(["problem-nested-create"]);
      return { id: "problem-created", input };
    });

    const created = await createProblemWithQuestions(
      normalizedProblem(),
      "source-id",
      ["topic-id"],
      {
        contentStatus: "PUBLISHED",
        reviewedById: "reviewer-id",
        importedBatchId: "batch-id",
        contentPackId: "pack-id",
        reportStage: (stage) => stages.push(stage),
      },
      tx,
    );

    expect(created).toEqual(expect.objectContaining({ id: "problem-created" }));
    expect(stages).toEqual(["problem-nested-create"]);
    expect(tx.problem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceCollectionId: "source-id",
        importedBatchId: "batch-id",
        contentPackId: "pack-id",
        contentStatus: "PUBLISHED",
        reviewedById: "reviewer-id",
        questions: {
          create: [expect.objectContaining({
            prompt: "Synthetic prompt",
            answer: { correctOptionId: "A" },
            contentStatus: "PUBLISHED",
            reviewedById: "reviewer-id",
          })],
        },
        problemTopics: {
          create: [{ topicId: "topic-id" }],
        },
      }),
    });
    expect(tx.question.createMany).not.toHaveBeenCalled();
    expect(tx.problemTopic.createMany).not.toHaveBeenCalled();
  });
});
