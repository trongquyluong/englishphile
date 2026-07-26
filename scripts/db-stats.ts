import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { classifySafeError } from "@/lib/operations/safe-error";

const prisma = new PrismaClient();

async function main() {
  const [
    users,
    publishedProblems,
    needsReviewProblems,
    archivedProblems,
    diagnosticEligibleProblems,
    contentPacks,
    contests,
    diagnosticAttempts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.problem.count({ where: { contentStatus: "PUBLISHED" } }),
    prisma.problem.count({ where: { contentStatus: "NEEDS_REVIEW" } }),
    prisma.problem.count({ where: { contentStatus: "ARCHIVED" } }),
    prisma.problem.count({ where: { isDiagnosticEligible: true, contentStatus: "PUBLISHED" } }),
    prisma.contentPack.count(),
    prisma.contest.count(),
    prisma.diagnosticAttempt.count(),
  ]);

  console.table({
    users,
    publishedProblems,
    needsReviewProblems,
    archivedProblems,
    diagnosticEligibleProblems,
    contentPacks,
    contests,
    diagnosticAttempts,
  });
}

main()
  .catch((error) => {
    console.error(`Database statistics failed (${classifySafeError(error)}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
