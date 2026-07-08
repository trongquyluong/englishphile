import { prisma } from "@/lib/prisma";

export const WRITING_DAILY_LIMIT = 5;

export type WritingSubmissionUsage = {
  used: number;
  limit: number;
  remaining: number;
};

function getStartOfToday(): Date {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return startOfToday;
}

/**
 * Get the user's writing submission usage for today.
 * Returns used count, limit, and remaining count.
 */
export async function getWritingSubmissionUsage(userId: string): Promise<WritingSubmissionUsage> {
  const startOfToday = getStartOfToday();

  const count = await prisma.writingSubmission.count({
    where: {
      userId,
      createdAt: { gte: startOfToday },
    },
  });

  const used = count;
  const limit = WRITING_DAILY_LIMIT;
  const remaining = Math.max(0, limit - used);

  return { used, limit, remaining };
}
