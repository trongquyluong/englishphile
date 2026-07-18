/**
 * db-export-portable.ts
 *
 * Exports Englishphile content data to a portable JSON bundle suitable for
 * importing into a Neon PostgreSQL production database.
 *
 * - Excludes passwordHash and all credential data.
 * - Exports: users (safe fields), source collections, topics, problem-topic
 *   relations, content packs, import batches, problems, questions, theory
 *   notes, contests, contest problems, diagnostic attempts (metadata only),
 *   skill/topic profiles, and recommendations.
 * - Does NOT export: submissions, submission answers, user problem statuses,
 *   classroom data, assignment data (these are user-specific or too large for
 *   the initial content-migration workflow).
 *
 * Usage:
 *   npm run db:export:portable
 *
 * Output:
 *   exports/englishphile-portable-<timestamp>/
 *     manifest.json
 *     users.safe.json
 *     source-collections.json
 *     topics.json
 *     problem-topics.json
 *     content-packs.json
 *     import-batches.json
 *     problems.json
 *     questions.json
 *     theory-notes.json
 *     contests.json
 *     contest-problems.json
 *     diagnostic-attempts.json
 *     user-skill-profiles.json
 *     user-topic-profiles.json
 *     learning-recommendations.json
 */

import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parsePortableUserRole } from "@/lib/import/portable-user-role";
import { PORTABLE_CONTEST_SELECT, PORTABLE_USER_SELECT, serializePortableExportArtifact } from "@/lib/operations/portable-data";
import { classifySafeError } from "@/lib/operations/safe-error";
import { ensureDir, timestampForFile } from "./db-utils";

const prisma = new PrismaClient();

async function writeJson(dir: string, fileName: string, data: unknown) {
  await fs.writeFile(path.join(dir, fileName), serializePortableExportArtifact(fileName, data), "utf8");
}

async function main() {
  const exportDir = path.resolve(
    process.cwd(),
    "exports",
    `englishphile-portable-${timestampForFile()}`,
  );
  await ensureDir(exportDir);

  // --- Safe user export (no passwordHash) ---
  const users = await prisma.user.findMany({
    select: PORTABLE_USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  let legacyTeacherRolesDowngraded = 0;
  const portableUsers = users.map((user) => {
    const roleResult = parsePortableUserRole(user.role);
    if (roleResult.legacyTeacherDowngraded) legacyTeacherRolesDowngraded += 1;
    return { ...user, role: roleResult.role };
  });

  // --- Content & structure data ---
  const [
    sourceCollections,
    topics,
    problemTopics,
    contentPacks,
    importBatches,
    problems,
    questions,
    theoryNotes,
    contests,
    contestProblems,
    // Submissions and progress data are intentionally skipped for the initial
    // content-portability workflow. They can be exported separately if needed.
    diagnosticAttempts,
    userSkillProfiles,
    userTopicProfiles,
    learningRecommendations,
  ] = await Promise.all([
    prisma.sourceCollection.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.topic.findMany({ orderBy: { name: "asc" } }),
    prisma.problemTopic.findMany({
      orderBy: [{ problemId: "asc" }, { topicId: "asc" }],
    }),
    prisma.contentPack.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.problem.findMany({ orderBy: [{ skillType: "asc" }, { orderIndex: "asc" }] }),
    prisma.question.findMany({
      orderBy: [{ problemId: "asc" }, { orderIndex: "asc" }],
    }),
    prisma.theoryNote.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.contest.findMany({ select: PORTABLE_CONTEST_SELECT, orderBy: { createdAt: "asc" } }),
    prisma.contestProblem.findMany({
      orderBy: [{ contestId: "asc" }, { orderIndex: "asc" }],
    }),
    // Diagnostic attempts: export metadata only (no user answers)
    prisma.diagnosticAttempt.findMany({
      select: {
        id: true,
        userId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        score: true,
        total: true,
        estimatedLevel: true,
        skillBreakdownJson: true,
        topicBreakdownJson: true,
        recommendationJson: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userSkillProfile.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.userTopicProfile.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.learningRecommendation.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const files = [
    ["users.safe.json", portableUsers],
    ["source-collections.json", sourceCollections],
    ["topics.json", topics],
    ["problem-topics.json", problemTopics],
    ["content-packs.json", contentPacks],
    ["import-batches.json", importBatches],
    ["problems.json", problems],
    ["questions.json", questions],
    ["theory-notes.json", theoryNotes],
    ["contests.json", contests],
    ["contest-problems.json", contestProblems],
    ["diagnostic-attempts.json", diagnosticAttempts],
    ["user-skill-profiles.json", userSkillProfiles],
    ["user-topic-profiles.json", userTopicProfiles],
    ["learning-recommendations.json", learningRecommendations],
  ] as const;

  await Promise.all(files.map(([name, data]) => writeJson(exportDir, name, data)));

  await writeJson(exportDir, "manifest.json", {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    note: "Portable content export for migration to Neon PostgreSQL.",
    warnings: [
      "users.safe.json intentionally excludes passwordHash.",
      "Submissions, submission answers, user problem statuses, classrooms, and assignments are NOT exported (user-specific data).",
      ...(legacyTeacherRolesDowngraded > 0
        ? [`${legacyTeacherRolesDowngraded} legacy role value(s) were downgraded to STUDENT.`]
        : []),
      "Import into a target database using: npm run db:import:portable",
    ],
    counts: {
      users: portableUsers.length,
      sourceCollections: sourceCollections.length,
      topics: topics.length,
      problemTopics: problemTopics.length,
      contentPacks: contentPacks.length,
      importBatches: importBatches.length,
      problems: problems.length,
      questions: questions.length,
      theoryNotes: theoryNotes.length,
      contests: contests.length,
      contestProblems: contestProblems.length,
      diagnosticAttempts: diagnosticAttempts.length,
      userSkillProfiles: userSkillProfiles.length,
      userTopicProfiles: userTopicProfiles.length,
      learningRecommendations: learningRecommendations.length,
    },
  });

  console.log("\nPortable export completed in the configured export directory.");
  console.log(
    "NOTE: Submissions, submission answers, user problem statuses, classrooms, and assignments were NOT exported.",
  );
  console.log("NOTE: No passwordHash was included in the export.");
  console.log(
    "\nTo import into a target database:\n  npm run db:import:portable -- --input <export-dir>\n",
  );
}

main()
  .catch((error) => {
    console.error(`Portable export failed (${classifySafeError(error)}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
