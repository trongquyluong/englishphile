import "server-only";

import { prisma } from "@/lib/prisma";
import { toLearnerWritingGradeResult } from "@/lib/dto/writing-grade";
import {
  isWritingReviewTimestamp,
  targetWordCountValues,
  WRITING_GRADER_MAX_ESSAY_CHARS,
  type TargetWordCount,
  type WritingReviewData,
} from "@/lib/writing-grader-shared";

const targetWordCounts = new Set<string>(targetWordCountValues);

export async function getLatestWritingReview(
  userId: string,
  promptSlug: string,
): Promise<WritingReviewData | null> {
  if (!userId || !promptSlug) return null;

  const submission = await prisma.writingSubmission.findFirst({
    where: {
      userId,
      promptSlug,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: {
      essayText: true,
      targetWordCount: true,
      resultJson: true,
      createdAt: true,
    },
  });

  if (
    !submission ||
    submission.essayText.length > WRITING_GRADER_MAX_ESSAY_CHARS ||
    !targetWordCounts.has(submission.targetWordCount)
  ) {
    return null;
  }

  const result = toLearnerWritingGradeResult(submission.resultJson);
  if (!result) return null;
  const reviewTimestamp = submission.createdAt.getTime();
  if (!isWritingReviewTimestamp(reviewTimestamp)) return null;

  return {
    essayText: submission.essayText,
    targetWordCount: submission.targetWordCount as TargetWordCount,
    result,
    reviewTimestamp,
  };
}
