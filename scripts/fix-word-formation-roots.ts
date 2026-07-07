import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

type RootWordFix = {
  id: string;
  rootWord: string;
};

const fixes: RootWordFix[] = [
  // { id: "QUESTION_ID", rootWord: "ENTERTAIN" },
];

function normalizeRootWord(value: string) {
  return value.trim().toUpperCase();
}

async function main() {
  if (fixes.length === 0) {
    throw new Error("No fixes configured. Fill the fixes array with verified question ids and root words before running.");
  }

  const seenIds = new Set<string>();
  for (const fix of fixes) {
    if (seenIds.has(fix.id)) {
      throw new Error(`Duplicate question id in fixes: ${fix.id}`);
    }
    seenIds.add(fix.id);

    const rootWord = normalizeRootWord(fix.rootWord);
    if (!rootWord) {
      throw new Error(`Empty rootWord for question ${fix.id}`);
    }

    const question = await prisma.question.findUnique({
      where: { id: fix.id },
      select: { id: true, type: true },
    });

    if (!question) {
      throw new Error(`Question not found: ${fix.id}`);
    }
    if (question.type !== "WORD_FORMATION") {
      throw new Error(`Question ${fix.id} is ${question.type}, not WORD_FORMATION.`);
    }

    const updated = await prisma.question.update({
      where: { id: fix.id },
      data: { rootWord },
      select: { id: true, rootWord: true },
    });

    console.log(`Updated ${updated.id}: ${updated.rootWord}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
