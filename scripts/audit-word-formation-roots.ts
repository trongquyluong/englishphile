import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function main() {
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
    problemTitle: question.problem.title,
    problemSlug: question.problem.slug,
    questionContentStatus: question.contentStatus,
    problemContentStatus: question.problem.contentStatus,
    isDiagnosticEligible: question.problem.isDiagnosticEligible,
    prompt: question.prompt,
    answer: question.answer,
    explanation: question.explanation,
  }));

  console.log(`Found ${missingRootWords.length} Word Formation question(s) with missing rootWord.`);

  for (const item of report) {
    console.log("\n---");
    console.log(`Question: ${item.questionId}`);
    console.log(`Problem: ${item.problemTitle} (${item.problemSlug}, ${item.problemId})`);
    console.log(`Status: question=${item.questionContentStatus}, problem=${item.problemContentStatus}`);
    console.log(`Diagnostic eligible: ${item.isDiagnosticEligible}`);
    console.log(`Prompt: ${item.prompt}`);
    console.log(`Answer: ${stringify(item.answer)}`);
    if (item.explanation) {
      console.log(`Explanation: ${item.explanation}`);
    }
  }

  const exportDir = path.resolve(process.cwd(), "exports");
  await fs.mkdir(exportDir, { recursive: true });
  const reportPath = path.join(exportDir, "word-formation-root-audit.json");
  await fs.writeFile(reportPath, stringify(report), "utf8");
  console.log(`\nWrote report to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
