import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { classifySafeError } from "@/lib/operations/safe-error";

const prisma = new PrismaClient();

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const targetQuestions = await prisma.question.findMany({
    where: {
      prompt: { contains: "director's", mode: "insensitive" },
    },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          slug: true,
          contentStatus: true,
          isDiagnosticEligible: true,
        },
      },
    },
    orderBy: [{ problemId: "asc" }, { orderIndex: "asc" }],
  });

  console.log(`Found ${targetQuestions.length} matching question record(s).`);

  const questions = await prisma.question.findMany({
    where: { type: "WORD_FORMATION" },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          slug: true,
          contentStatus: true,
          isDiagnosticEligible: true,
        },
      },
    },
    orderBy: [{ problemId: "asc" }, { orderIndex: "asc" }],
  });

  const missingRootWords = questions.filter((question) => !question.rootWord?.trim());

  const report = missingRootWords.map((question) => ({
    questionId: question.id,
    problemId: question.problemId,
    questionContentStatus: question.contentStatus,
    problemContentStatus: question.problem.contentStatus,
    isDiagnosticEligible: question.problem.isDiagnosticEligible,
  }));

  console.log(`Found ${missingRootWords.length} Word Formation question(s) with missing rootWord.`);

  const exportDir = path.resolve(process.cwd(), "exports");
  await fs.mkdir(exportDir, { recursive: true });
  const reportPath = path.join(exportDir, "word-formation-root-audit.json");
  await fs.writeFile(reportPath, stringify(report), "utf8");
  console.log("\nWrote the minimized audit report to the configured export directory.");
}

main()
  .catch((error) => {
    console.error(`Word-formation audit failed (${classifySafeError(error)}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
