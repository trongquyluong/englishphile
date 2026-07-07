import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { ensureDir, timestampForFile } from "./db-utils";

const prisma = new PrismaClient();

async function writeJson(dir: string, fileName: string, data: unknown) {
  await fs.writeFile(path.join(dir, fileName), JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const exportDir = path.resolve(process.cwd(), "exports", `englishphile-${timestampForFile()}`);
  await ensureDir(exportDir);

  const [
    users,
    sourceCollections,
    contentPacks,
    topics,
    problemTopics,
    problems,
    questions,
    contests,
    contestProblems,
    theoryNotes,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sourceCollection.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.contentPack.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.topic.findMany({ orderBy: { name: "asc" } }),
    prisma.problemTopic.findMany({ orderBy: [{ problemId: "asc" }, { topicId: "asc" }] }),
    prisma.problem.findMany({ orderBy: [{ skillType: "asc" }, { orderIndex: "asc" }] }),
    prisma.question.findMany({ orderBy: [{ problemId: "asc" }, { orderIndex: "asc" }] }),
    prisma.contest.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.contestProblem.findMany({ orderBy: [{ contestId: "asc" }, { orderIndex: "asc" }] }),
    prisma.theoryNote.findMany({ orderBy: { orderIndex: "asc" } }),
  ]);

  await Promise.all([
    writeJson(exportDir, "users.safe.json", users),
    writeJson(exportDir, "source-collections.json", sourceCollections),
    writeJson(exportDir, "content-packs.json", contentPacks),
    writeJson(exportDir, "topics.json", topics),
    writeJson(exportDir, "problem-topics.json", problemTopics),
    writeJson(exportDir, "problems.json", problems),
    writeJson(exportDir, "questions.json", questions),
    writeJson(exportDir, "contests.json", contests),
    writeJson(exportDir, "contest-problems.json", contestProblems),
    writeJson(exportDir, "wiki-theory-notes.json", theoryNotes),
    writeJson(exportDir, "manifest.json", {
      exportedAt: new Date().toISOString(),
      warning: "users.safe.json intentionally excludes credential hashes.",
      counts: {
        users: users.length,
        sourceCollections: sourceCollections.length,
        contentPacks: contentPacks.length,
        topics: topics.length,
        problems: problems.length,
        questions: questions.length,
        contests: contests.length,
        theoryNotes: theoryNotes.length,
      },
    }),
  ]);

  console.log(`Safe export written: ${exportDir}`);
  console.log("Credential hashes were not exported.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
