import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ questionFindMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { question: { findMany: database.questionFindMany } },
}));

import {
  detectImportDuplicates,
} from "@/lib/import/duplicate-detection";
import type {
  NormalizedProblem,
  NormalizedQuestion,
} from "@/lib/import/types";

const prompt = "Select the option that best completes this carefully written advanced grammar sentence for independent practice.";
const options = [
  { id: "A", text: "answer" },
  { id: "B", text: "other" },
  { id: "C", text: "choice" },
  { id: "D", text: "distractor" },
];

function importedQuestion(promptValue = prompt): NormalizedQuestion {
  return {
    type: "MCQ",
    skillType: "MULTIPLE_CHOICE",
    difficulty: "B2",
    prompt: promptValue,
    passage: null,
    options,
    answer: { correctOptionId: "A" },
    explanation: "Synthetic explanation.",
    orderIndex: 0,
  };
}

function importedProblem(): NormalizedProblem {
  return {
    title: "Advanced Grammar Review",
    slug: "advanced-grammar-review",
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "B2",
    sourceCollection: {
      name: "Synthetic source",
      description: "Synthetic duplicate-detection regression source.",
      sourceType: "JSON",
    },
    statement: "Choose the best answer in each sentence.",
    instructions: "Choose one answer.",
    estimatedMinutes: 5,
    topics: ["Grammar"],
    questions: [importedQuestion()],
    orderIndex: 0,
  };
}

function persistedCandidate(promptValue = prompt) {
  return {
    id: "existing-question",
    type: "MCQ",
    skillType: "MULTIPLE_CHOICE",
    prompt: promptValue,
    passage: null,
    options,
    answer: { correctOptionId: "A" },
    problem: {
      id: "existing-problem",
      title: "Advanced Grammar Review",
      statement: "Choose the best answer in each sentence.",
    },
  };
}

describe("unchanged import duplicate-detection outcomes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps an exact fingerprint match skipped", async () => {
    database.questionFindMany.mockResolvedValue([persistedCandidate()]);

    const risk = await detectImportDuplicates(
      importedProblem(),
      importedQuestion(),
    );

    expect(risk).toMatchObject({
      level: "EXACT",
      similarity: 1,
      action: "skip",
      existingQuestionId: "existing-question",
    });
    expect(database.questionFindMany).toHaveBeenCalledTimes(1);
  });

  it("keeps a high-similarity non-exact match skipped", async () => {
    const nearPrompt = "Select the option that best completes this carefully written advanced grammar sentence for focused practice.";
    database.questionFindMany.mockResolvedValue([
      persistedCandidate(nearPrompt),
    ]);

    const risk = await detectImportDuplicates(
      importedProblem(),
      importedQuestion(),
    );

    expect(risk).toMatchObject({
      level: "HIGH_SIMILARITY",
      action: "skip",
    });
    expect(risk.similarity).toBeGreaterThanOrEqual(0.9);
    expect(database.questionFindMany).toHaveBeenCalledTimes(2);
  });

  it("keeps a possible match imported for review", async () => {
    const nearPrompt = "Select the answer that correctly completes this carefully written grammar sentence for focused revision.";
    database.questionFindMany.mockResolvedValue([
      persistedCandidate(nearPrompt),
    ]);

    const risk = await detectImportDuplicates(
      importedProblem(),
      importedQuestion(),
    );

    expect(risk).toMatchObject({
      level: "POSSIBLE",
      action: "needs_review",
    });
    expect(risk.similarity).toBeGreaterThanOrEqual(0.75);
    expect(risk.similarity).toBeLessThan(0.9);
    expect(database.questionFindMany).toHaveBeenCalledTimes(2);
  });
});
