import "server-only";

import { prisma } from "@/lib/prisma";
import {
  projectWritingRubric,
  type WritingRubricPresentation,
} from "@/lib/questions/writing-rubric-contract";

type WritingRubricSourceRow = {
  id: string;
  answer: unknown;
};

export function projectWritingRubricRows(
  rows: readonly WritingRubricSourceRow[],
): Map<string, WritingRubricPresentation> {
  const presentations = new Map<string, WritingRubricPresentation>();
  for (const row of rows) {
    const presentation = projectWritingRubric(row.answer);
    if (presentation) presentations.set(row.id, presentation);
  }
  return presentations;
}

/**
 * Reads raw answers only for already-authorized Writing question IDs and
 * returns only the safe rubric projection. Raw answers never leave this
 * server-only module.
 */
export async function getLearnerWritingRubrics(
  questionIds: readonly string[],
): Promise<Map<string, WritingRubricPresentation>> {
  const uniqueQuestionIds = [...new Set(questionIds)].sort();
  if (uniqueQuestionIds.length === 0) return new Map();

  const rows = await prisma.question.findMany({
    where: {
      id: { in: uniqueQuestionIds },
      type: "WRITING_PROMPT",
    },
    select: {
      id: true,
      answer: true,
    },
  });

  return projectWritingRubricRows(rows);
}
