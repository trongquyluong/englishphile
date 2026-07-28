import { z } from "zod";
import type { WritingGradeResult } from "@/lib/writing-grader-shared";

const boundedText = z.string().max(4_000);
const boundedList = z.array(boundedText).max(10);

function criterionSchema(maxScore: 9 | 3) {
  return z.object({
    score: z.number().min(0).max(maxScore),
    maxScore: z.literal(maxScore),
    comment: boundedText,
  });
}

const writingGradeResultSchema = z.object({
  totalScore: z.number().min(0).max(30),
  maxScore: z.literal(30),
  criteria: z.object({
    content: criterionSchema(9),
    organization: criterionSchema(9),
    language: criterionSchema(9),
    mechanics: criterionSchema(3),
  }),
  overallComment: boundedText,
  strengths: boundedList,
  priorityIssues: boundedList,
  detailedFeedback: z
    .array(
      z.object({
        quote: boundedText,
        issue: boundedText,
        explanation: boundedText,
        suggestedRevision: boundedText,
      }),
    )
    .max(10),
  suggestedRewrite: z
    .object({
      thesis: boundedText.optional(),
      paragraph: boundedText.optional(),
    })
    .optional(),
  nextPracticeTasks: boundedList,
  warnings: boundedList,
});

/**
 * Positive mapper for learner-facing Writing feedback loaded from JSON storage.
 * Unknown keys are discarded and malformed or oversized historical rows fail
 * closed instead of crossing the Server Component boundary.
 */
export function toLearnerWritingGradeResult(value: unknown): WritingGradeResult | null {
  const parsed = writingGradeResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
