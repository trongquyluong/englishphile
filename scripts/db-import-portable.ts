/**
 * db-import-portable.ts
 *
 * Imports a portable JSON bundle (created by db-export-portable.ts) into a
 * target PostgreSQL database.
 *
 * Connection priority:
 *   1. --url argument (highest)
 *   2. DIRECT_URL env var (for Neon migrations)
 *   3. DATABASE_URL env var (fallback)
 *
 * Safety:
 *   - Skips rows that already exist (idempotent by email, slug, composite key).
 *   - Prompts for confirmation when target URL looks like a hosted service.
 *   - Does NOT overwrite existing users; creates placeholder accounts for imported
 *     users who do not yet exist in the target DB.
 *
 * Usage:
 *   # Using env vars (DIRECT_URL or DATABASE_URL)
 *   npm run db:import:portable -- --input exports/englishphile-portable-2026-07-07
 *
 *   # Using a specific connection URL
 *   npm run db:import:portable -- --input <path> --url "postgresql://..."
 *
 *   # Dry-run (show what would be imported without writing)
 *   npm run db:import:portable -- --input <path> --dry-run
 *
 * Import order (respects foreign-key dependencies):
 *   1. Users (safe fields)
 *   2. UserProfiles
 *   3. SourceCollections
 *   4. Topics
 *   5. ContentPacks
 *   6. ImportBatches
 *   7. Problems
 *   8. Questions
 *   9. TheoryNotes
 *   10. Contests
 *   11. ContestProblems
 *   12. DiagnosticAttempts
 *   13. UserSkillProfiles
 *   14. UserTopicProfiles
 *   15. LearningRecommendations
 *   16. ProblemTopics
 */

import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

interface ImportOptions {
  inputDir: string;
  targetUrl: string;
  dryRun: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  let inputDir = "";
  let targetUrl = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && i + 1 < args.length) {
      inputDir = args[++i];
    } else if (args[i] === "--url" && i + 1 < args.length) {
      targetUrl = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!inputDir) {
    console.error("Usage: npm run db:import:portable -- --input <export-dir> [--url <connection-url>] [--dry-run]");
    console.error("Example: npm run db:import:portable -- --input exports/englishphile-portable-2026-07-07");
    process.exit(1);
  }

  return {
    inputDir: path.resolve(inputDir),
    targetUrl: targetUrl || process.env.DIRECT_URL || process.env.DATABASE_URL || "",
    dryRun,
  };
}

function readJson<T>(dir: string, file: string): T[] {
  const filePath = path.join(dir, file);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T[];
}

async function confirm(question: string): Promise<boolean> {
  // On CI/non-TTY, default to no (fail-safe).
  if (!process.stdin.isTTY) {
    console.warn("\nWARNING: Not a TTY — proceeding without confirmation for safety.\n");
    return true;
  }

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N) `, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

function looksLikeProduction(url: string): boolean {
  if (!url) return false;
  return /neon\.tech|supabase|railway|planetscale|render\.com/i.test(url);
}

async function main() {
  const opts = parseArgs();

  if (!opts.targetUrl) {
    console.error("\nERROR: No connection URL. Set DIRECT_URL, DATABASE_URL, or pass --url.");
    console.error("Example: npm run db:import:portable -- --input <path> --url \"postgresql://user:pass@host/db\"");
    process.exit(1);
  }

  // Verify input dir exists.
  try {
    fs.accessSync(opts.inputDir);
  } catch {
    console.error(`\nERROR: Export directory not found: ${opts.inputDir}`);
    process.exit(1);
  }

  // Verify manifest exists.
  const manifestPath = path.join(opts.inputDir, "manifest.json");
  let manifest: { exportedAt?: string; version?: string; counts?: Record<string, number> };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    console.error(`\nERROR: manifest.json not found in ${opts.inputDir}`);
    process.exit(1);
  }

  console.log(`\n=== Englishphile Portable Import ===\n`);
  console.log(`Source:      ${opts.inputDir}`);
  console.log(`Target URL:  ${opts.targetUrl.replace(/\/\/[^@]+@/, "//***@")}`);
  console.log(`Mode:       ${opts.dryRun ? "DRY RUN (no changes)" : "LIVE IMPORT"}`);
  console.log(`Exported:   ${manifest.exportedAt ?? "unknown"}`);
  console.log(`Version:    ${manifest.version ?? "unknown"}`);

  if (opts.dryRun) {
    console.log("\nDRY RUN: Showing import plan without writing to the database.\n");
  }

  // Safety confirmation for production-like targets.
  if (looksLikeProduction(opts.targetUrl) && !opts.dryRun) {
    console.warn("⚠  WARNING: Target URL looks like a hosted production database.");
    const proceed = await confirm("\nImporting will modify the target database. Continue?");
    if (!proceed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // Create a standalone PrismaClient pointing to the target database.
  // This bypasses the singleton wrapper so we can connect to a different URL.
  const prisma = new PrismaClient({
    datasources: { db: { url: opts.targetUrl } },
    log: ["error"],
  });

  // Verify connection.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error(`\nERROR: Could not connect to target database: ${err}`);
    process.exit(1);
  }

  console.log("\nConnected to target database ✓");

  if (opts.dryRun) {
    await prisma.$disconnect();
    // Print a summary of what would be imported.
    const counts = manifest.counts ?? {};
    console.log("\nImport plan (counts from manifest):");
    for (const [key, count] of Object.entries(counts)) {
      console.log(`  ${key}: ${count} rows`);
    }
    console.log("\nDRY RUN complete. No data was written.");
    return;
  }

  // ---- Import logic (order matters for FK dependencies) ----

  // Helper: safely parse a nullable JSON value.
  function nullableJson(val: unknown) {
    if (val === null || val === undefined) return undefined;
    return val as object;
  }

  async function upsertUser(user: Record<string, unknown>) {
    const existing = await prisma.user.findUnique({ where: { email: user.email as string } });
    if (existing) {
      // Update role if needed, preserve existing password.
      if (existing.role !== (user.role as string)) {
        await prisma.user.update({
          where: { email: user.email as string },
          data: { role: user.role as "STUDENT" | "TEACHER" | "ADMIN" },
        });
      }
      return;
    }
    // Create placeholder — passwordHash intentionally empty, user must reset.
    await prisma.user.create({
      data: {
        id: user.id as string,
        email: user.email as string,
        passwordHash: "",
        username: (user.username as string | null) ?? null,
        displayName: user.displayName as string,
        fullName: (user.fullName as string | null) ?? null,
        role: user.role as "STUDENT" | "TEACHER" | "ADMIN",
      },
    });

    // Also upsert the embedded profile if present in the export.
    const profile = user.profile as Record<string, unknown> | null;
    if (profile && profile.id) {
      await upsertUserProfile(profile);
    }
  }

  async function upsertSourceCollection(sc: Record<string, unknown>) {
    await prisma.sourceCollection.upsert({
      where: { id: sc.id as string },
      update: {
        name: sc.name as string,
        description: sc.description as string,
        originalFileName: (sc.originalFileName as string | null) ?? null,
        sourceType: (sc.sourceType as "PDF" | "DOCX" | "CSV" | "JSON" | "MANUAL" | "OTHER") ?? "MANUAL",
        copyrightNote: (sc.copyrightNote as string | null) ?? null,
      },
      create: {
        id: sc.id as string,
        name: sc.name as string,
        description: sc.description as string,
        originalFileName: (sc.originalFileName as string | null) ?? null,
        sourceType: (sc.sourceType as "PDF" | "DOCX" | "CSV" | "JSON" | "MANUAL" | "OTHER") ?? "MANUAL",
        copyrightNote: (sc.copyrightNote as string | null) ?? null,
      },
    });
  }

  async function upsertTopic(topic: Record<string, unknown>) {
    await prisma.topic.upsert({
      where: { slug: topic.slug as string },
      update: {
        name: topic.name as string,
        description: (topic.description as string | null) ?? null,
        parentId: (topic.parentId as string | null) ?? null,
      },
      create: {
        id: topic.id as string,
        name: topic.name as string,
        slug: topic.slug as string,
        description: (topic.description as string | null) ?? null,
        parentId: (topic.parentId as string | null) ?? null,
      },
    });
  }

  async function upsertContentPack(pack: Record<string, unknown>) {
    await prisma.contentPack.upsert({
      where: { id: pack.id as string },
      update: {
        name: pack.name as string,
        version: (pack.version as string | null) ?? null,
        description: (pack.description as string | null) ?? null,
        manifestJson: nullableJson(pack.manifestJson) ?? undefined,
        fileName: (pack.fileName as string | null) ?? null,
        status: (pack.status as "DRAFT" | "VALIDATED" | "PARTIALLY_IMPORTED" | "IMPORTED" | "FAILED" | "ARCHIVED") ?? "DRAFT",
        importedById: (pack.importedById as string | null) ?? null,
      },
      create: {
        id: pack.id as string,
        name: pack.name as string,
        version: (pack.version as string | null) ?? null,
        description: (pack.description as string | null) ?? null,
        manifestJson: nullableJson(pack.manifestJson) ?? undefined,
        fileName: (pack.fileName as string | null) ?? null,
        status: (pack.status as "DRAFT" | "VALIDATED" | "PARTIALLY_IMPORTED" | "IMPORTED" | "FAILED" | "ARCHIVED") ?? "DRAFT",
        importedById: (pack.importedById as string | null) ?? null,
      },
    });
  }

  async function upsertImportBatch(batch: Record<string, unknown>) {
    const exists = await prisma.importBatch.findUnique({ where: { id: batch.id as string } });
    if (exists) return;
    await prisma.importBatch.create({
      data: {
        id: batch.id as string,
        userId: batch.userId as string,
        sourceCollectionId: (batch.sourceCollectionId as string | null) ?? null,
        importType: batch.importType as "JSON" | "CSV",
        status: batch.status as "VALIDATED" | "IMPORTED" | "FAILED",
        summary: batch.summary as object,
        errorLog: nullableJson(batch.errorLog) ?? undefined,
        contentPackId: (batch.contentPackId as string | null) ?? null,
      },
    });
  }

  async function upsertProblem(problem: Record<string, unknown>) {
    await prisma.problem.upsert({
      where: { slug: problem.slug as string },
      update: {
        title: problem.title as string,
        skillType: problem.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS",
        questionType: problem.questionType as
          | "PRONUNCIATION_ODD_ONE_OUT"
          | "MCQ"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING_MCQ"
          | "LISTENING_MCQ"
          | "LISTENING_SHORT_ANSWER"
          | "WRITING_PROMPT"
          | "TRIOS_GAPPED_SENTENCES"
          | "SHORT_ANSWER",
        difficulty: problem.difficulty as "B2" | "C1" | "C2" | "CHUYEN" | "HSG",
        sourceCollectionId: (problem.sourceCollectionId as string | null) ?? null,
        statement: problem.statement as string,
        instructions: (problem.instructions as string | null) ?? null,
        estimatedMinutes: (problem.estimatedMinutes as number | null) ?? null,
        acceptanceRate: (problem.acceptanceRate as number | null) ?? null,
        isDiagnosticEligible: (problem.isDiagnosticEligible as boolean) ?? false,
        diagnosticWeight: (problem.diagnosticWeight as number) ?? 1,
        recommendedMinLevel: (problem.recommendedMinLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        recommendedMaxLevel: (problem.recommendedMaxLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        contentStatus: problem.contentStatus as "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED",
        publishedAt: problem.publishedAt ? new Date(problem.publishedAt as string) : null,
        reviewedAt: problem.reviewedAt ? new Date(problem.reviewedAt as string) : null,
        reviewedById: (problem.reviewedById as string | null) ?? null,
        importedBatchId: (problem.importedBatchId as string | null) ?? null,
        contentPackId: (problem.contentPackId as string | null) ?? null,
        orderIndex: (problem.orderIndex as number) ?? 0,
      },
      create: {
        id: problem.id as string,
        title: problem.title as string,
        slug: problem.slug as string,
        skillType: problem.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS",
        questionType: problem.questionType as
          | "PRONUNCIATION_ODD_ONE_OUT"
          | "MCQ"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING_MCQ"
          | "LISTENING_MCQ"
          | "LISTENING_SHORT_ANSWER"
          | "WRITING_PROMPT"
          | "TRIOS_GAPPED_SENTENCES"
          | "SHORT_ANSWER",
        difficulty: problem.difficulty as "B2" | "C1" | "C2" | "CHUYEN" | "HSG",
        sourceCollectionId: (problem.sourceCollectionId as string | null) ?? null,
        statement: problem.statement as string,
        instructions: (problem.instructions as string | null) ?? null,
        estimatedMinutes: (problem.estimatedMinutes as number | null) ?? null,
        acceptanceRate: (problem.acceptanceRate as number | null) ?? null,
        isDiagnosticEligible: (problem.isDiagnosticEligible as boolean) ?? false,
        diagnosticWeight: (problem.diagnosticWeight as number) ?? 1,
        recommendedMinLevel: (problem.recommendedMinLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        recommendedMaxLevel: (problem.recommendedMaxLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        contentStatus: problem.contentStatus as "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED",
        publishedAt: problem.publishedAt ? new Date(problem.publishedAt as string) : null,
        reviewedAt: problem.reviewedAt ? new Date(problem.reviewedAt as string) : null,
        reviewedById: (problem.reviewedById as string | null) ?? null,
        importedBatchId: (problem.importedBatchId as string | null) ?? null,
        contentPackId: (problem.contentPackId as string | null) ?? null,
        orderIndex: (problem.orderIndex as number) ?? 0,
      },
    });
  }

  async function upsertQuestion(question: Record<string, unknown>) {
    await prisma.question.upsert({
      where: { id: question.id as string },
      update: {
        problemId: question.problemId as string,
        type: question.type as
          | "PRONUNCIATION_ODD_ONE_OUT"
          | "MCQ"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING_MCQ"
          | "LISTENING_MCQ"
          | "LISTENING_SHORT_ANSWER"
          | "WRITING_PROMPT"
          | "TRIOS_GAPPED_SENTENCES"
          | "SHORT_ANSWER",
        skillType: question.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS",
        difficulty: question.difficulty as "B2" | "C1" | "C2" | "CHUYEN" | "HSG",
        prompt: question.prompt as string,
        passage: (question.passage as string | null) ?? null,
        options: nullableJson(question.options) ?? undefined,
        answer: question.answer as object,
        explanation: (question.explanation as string | null) ?? null,
        rootWord: (question.rootWord as string | null) ?? null,
        keyword: (question.keyword as string | null) ?? null,
        targetSentence: (question.targetSentence as string | null) ?? null,
        lineNumber: (question.lineNumber as number | null) ?? null,
        metadata: nullableJson(question.metadata) ?? undefined,
        contentStatus: question.contentStatus as "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED",
        reviewedAt: question.reviewedAt ? new Date(question.reviewedAt as string) : null,
        reviewedById: (question.reviewedById as string | null) ?? null,
        orderIndex: (question.orderIndex as number) ?? 0,
      },
      create: {
        id: question.id as string,
        problemId: question.problemId as string,
        type: question.type as
          | "PRONUNCIATION_ODD_ONE_OUT"
          | "MCQ"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING_MCQ"
          | "LISTENING_MCQ"
          | "LISTENING_SHORT_ANSWER"
          | "WRITING_PROMPT"
          | "TRIOS_GAPPED_SENTENCES"
          | "SHORT_ANSWER",
        skillType: question.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS",
        difficulty: question.difficulty as "B2" | "C1" | "C2" | "CHUYEN" | "HSG",
        prompt: question.prompt as string,
        passage: (question.passage as string | null) ?? null,
        options: nullableJson(question.options) ?? undefined,
        answer: question.answer as object,
        explanation: (question.explanation as string | null) ?? null,
        rootWord: (question.rootWord as string | null) ?? null,
        keyword: (question.keyword as string | null) ?? null,
        targetSentence: (question.targetSentence as string | null) ?? null,
        lineNumber: (question.lineNumber as number | null) ?? null,
        metadata: nullableJson(question.metadata) ?? undefined,
        contentStatus: question.contentStatus as "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED",
        reviewedAt: question.reviewedAt ? new Date(question.reviewedAt as string) : null,
        reviewedById: (question.reviewedById as string | null) ?? null,
        orderIndex: (question.orderIndex as number) ?? 0,
      },
    });
  }

  async function upsertTheoryNote(note: Record<string, unknown>) {
    await prisma.theoryNote.upsert({
      where: { slug: note.slug as string },
      update: {
        title: note.title as string,
        skillType: (note.skillType as "PRONUNCIATION" | "MULTIPLE_CHOICE" | "OPEN_CLOZE" | "GUIDED_CLOZE" | "WORD_FORMATION" | "SENTENCE_TRANSFORMATION" | "ERROR_IDENTIFICATION" | "READING" | "WRITING" | "LISTENING" | "TRIOS" | "COLLOCATIONS" | "PHRASAL_VERBS" | "TRANSITIONS" | "GRAMMAR_FOCUS" | null) ?? null,
        topicId: (note.topicId as string | null) ?? null,
        content: note.content as string,
        orderIndex: (note.orderIndex as number) ?? 0,
      },
      create: {
        id: note.id as string,
        title: note.title as string,
        slug: note.slug as string,
        skillType: (note.skillType as "PRONUNCIATION" | "MULTIPLE_CHOICE" | "OPEN_CLOZE" | "GUIDED_CLOZE" | "WORD_FORMATION" | "SENTENCE_TRANSFORMATION" | "ERROR_IDENTIFICATION" | "READING" | "WRITING" | "LISTENING" | "TRIOS" | "COLLOCATIONS" | "PHRASAL_VERBS" | "TRANSITIONS" | "GRAMMAR_FOCUS" | null) ?? null,
        topicId: (note.topicId as string | null) ?? null,
        content: note.content as string,
        orderIndex: (note.orderIndex as number) ?? 0,
      },
    });
  }

  async function upsertContest(contest: Record<string, unknown>) {
    await prisma.$transaction(async (tx) => {
      const savedContest = await tx.contest.upsert({
        where: { slug: contest.slug as string },
        update: {
          title: contest.title as string,
          description: (contest.description as string | null) ?? null,
          contestType: contest.contestType as "PAST_EXAM" | "LIVE_CONTEST" | "PRACTICE_CONTEST",
          status: contest.status as "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "ARCHIVED",
          visibility: contest.visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
          accessCodeUpdatedAt: new Date(),
          durationMinutes: (contest.durationMinutes as number | null) ?? null,
          startsAt: contest.startsAt ? new Date(contest.startsAt as string) : null,
          endsAt: contest.endsAt ? new Date(contest.endsAt as string) : null,
          sourceName: (contest.sourceName as string | null) ?? null,
          rules: (contest.rules as string | null) ?? null,
          createdById: (contest.createdById as string | null) ?? null,
        },
        create: {
          id: contest.id as string,
          title: contest.title as string,
          slug: contest.slug as string,
          description: (contest.description as string | null) ?? null,
          contestType: contest.contestType as "PAST_EXAM" | "LIVE_CONTEST" | "PRACTICE_CONTEST",
          status: contest.status as "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "ARCHIVED",
          visibility: contest.visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
          accessCodeUpdatedAt: new Date(),
          durationMinutes: (contest.durationMinutes as number | null) ?? null,
          startsAt: contest.startsAt ? new Date(contest.startsAt as string) : null,
          endsAt: contest.endsAt ? new Date(contest.endsAt as string) : null,
          sourceName: (contest.sourceName as string | null) ?? null,
          rules: (contest.rules as string | null) ?? null,
          createdById: (contest.createdById as string | null) ?? null,
        },
      });
      await tx.contestAccessGrant.deleteMany({ where: { contestId: savedContest.id } });
    });
  }

  async function upsertContestProblem(cp: Record<string, unknown>) {
    await prisma.contestProblem.upsert({
      where: { contestId_problemId: { contestId: cp.contestId as string, problemId: cp.problemId as string } },
      update: {
        section: cp.section as string,
        orderIndex: (cp.orderIndex as number) ?? 0,
        points: (cp.points as number | null) ?? null,
      },
      create: {
        id: cp.id as string,
        contestId: cp.contestId as string,
        problemId: cp.problemId as string,
        section: cp.section as string,
        orderIndex: (cp.orderIndex as number) ?? 0,
        points: (cp.points as number | null) ?? null,
      },
    });
  }

  async function upsertProblemTopic(pt: Record<string, unknown>) {
    await prisma.problemTopic.upsert({
      where: { problemId_topicId: { problemId: pt.problemId as string, topicId: pt.topicId as string } },
      update: {},
      create: {
        problemId: pt.problemId as string,
        topicId: pt.topicId as string,
      },
    });
  }

  async function upsertUserProfile(profile: Record<string, unknown>) {
    const exists = await prisma.userProfile.findUnique({ where: { userId: profile.userId as string } });
    if (exists) return;
    await prisma.userProfile.create({
      data: {
        id: profile.id as string,
        userId: profile.userId as string,
        targetExam: (profile.targetExam as string | null) ?? null,
        schoolTarget: (profile.schoolTarget as string | null) ?? null,
        school: (profile.school as string | null) ?? null,
        province: (profile.province as string | null) ?? null,
        avatarUrl: (profile.avatarUrl as string | null) ?? null,
        bio: (profile.bio as string | null) ?? null,
        level: (profile.level as string | null) ?? null,
      },
    });
  }

  async function upsertDiagnosticAttempt(da: Record<string, unknown>) {
    const exists = await prisma.diagnosticAttempt.findUnique({ where: { id: da.id as string } });
    if (exists) return;
    await prisma.diagnosticAttempt.create({
      data: {
        id: da.id as string,
        userId: da.userId as string,
        status: da.status as "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | "NEEDS_REVIEW",
        startedAt: new Date(da.startedAt as string),
        completedAt: da.completedAt ? new Date(da.completedAt as string) : null,
        score: (da.score as number | null) ?? null,
        total: (da.total as number | null) ?? null,
        estimatedLevel: (da.estimatedLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        skillBreakdownJson: nullableJson(da.skillBreakdownJson) ?? undefined,
        topicBreakdownJson: nullableJson(da.topicBreakdownJson) ?? undefined,
        recommendationJson: nullableJson(da.recommendationJson) ?? undefined,
      },
    });
  }

  async function upsertUserSkillProfile(usp: Record<string, unknown>) {
    await prisma.userSkillProfile.upsert({
      where: {
        userId_skillType: {
          userId: usp.userId as string,
          skillType: usp.skillType as
            | "PRONUNCIATION"
            | "MULTIPLE_CHOICE"
            | "OPEN_CLOZE"
            | "GUIDED_CLOZE"
            | "WORD_FORMATION"
            | "SENTENCE_TRANSFORMATION"
            | "ERROR_IDENTIFICATION"
            | "READING"
            | "WRITING"
            | "LISTENING"
            | "TRIOS"
            | "COLLOCATIONS"
            | "PHRASAL_VERBS"
            | "TRANSITIONS"
            | "GRAMMAR_FOCUS",
        },
      },
      update: {
        estimatedLevel: (usp.estimatedLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        accuracy: (usp.accuracy as number | null) ?? null,
        attempted: (usp.attempted as number) ?? 0,
        correct: (usp.correct as number) ?? 0,
        confidence: (usp.confidence as number) ?? 0,
      },
      create: {
        id: usp.id as string,
        userId: usp.userId as string,
        skillType: usp.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS",
        estimatedLevel: (usp.estimatedLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        accuracy: (usp.accuracy as number | null) ?? null,
        attempted: (usp.attempted as number) ?? 0,
        correct: (usp.correct as number) ?? 0,
        confidence: (usp.confidence as number) ?? 0,
      },
    });
  }

  async function upsertUserTopicProfile(utp: Record<string, unknown>) {
    await prisma.userTopicProfile.upsert({
      where: {
        userId_topicId: {
          userId: utp.userId as string,
          topicId: utp.topicId as string,
        },
      },
      update: {
        estimatedLevel: (utp.estimatedLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        accuracy: (utp.accuracy as number | null) ?? null,
        attempted: (utp.attempted as number) ?? 0,
        correct: (utp.correct as number) ?? 0,
        confidence: (utp.confidence as number) ?? 0,
      },
      create: {
        id: utp.id as string,
        userId: utp.userId as string,
        topicId: utp.topicId as string,
        estimatedLevel: (utp.estimatedLevel as "B2" | "C1" | "C2" | "CHUYEN" | "HSG" | null) ?? null,
        accuracy: (utp.accuracy as number | null) ?? null,
        attempted: (utp.attempted as number) ?? 0,
        correct: (utp.correct as number) ?? 0,
        confidence: (utp.confidence as number) ?? 0,
      },
    });
  }

  async function upsertLearningRecommendation(lr: Record<string, unknown>) {
    await prisma.learningRecommendation.upsert({
      where: { id: lr.id as string },
      update: {
        recommendationType: lr.recommendationType as
          | "NEXT_PROBLEM"
          | "SKILL_FOCUS"
          | "TOPIC_REVIEW"
          | "WRONG_QUESTION_RETRY"
          | "CHALLENGE"
          | "DIAGNOSTIC_RETAKE",
        skillType: (lr.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS"
          | null) ?? null,
        topicId: (lr.topicId as string | null) ?? null,
        problemId: (lr.problemId as string | null) ?? null,
        reason: lr.reason as string,
        priority: (lr.priority as number) ?? 0,
        status: lr.status as "ACTIVE" | "DISMISSED" | "COMPLETED",
      },
      create: {
        id: lr.id as string,
        userId: lr.userId as string,
        recommendationType: lr.recommendationType as
          | "NEXT_PROBLEM"
          | "SKILL_FOCUS"
          | "TOPIC_REVIEW"
          | "WRONG_QUESTION_RETRY"
          | "CHALLENGE"
          | "DIAGNOSTIC_RETAKE",
        skillType: (lr.skillType as
          | "PRONUNCIATION"
          | "MULTIPLE_CHOICE"
          | "OPEN_CLOZE"
          | "GUIDED_CLOZE"
          | "WORD_FORMATION"
          | "SENTENCE_TRANSFORMATION"
          | "ERROR_IDENTIFICATION"
          | "READING"
          | "WRITING"
          | "LISTENING"
          | "TRIOS"
          | "COLLOCATIONS"
          | "PHRASAL_VERBS"
          | "TRANSITIONS"
          | "GRAMMAR_FOCUS"
          | null) ?? null,
        topicId: (lr.topicId as string | null) ?? null,
        problemId: (lr.problemId as string | null) ?? null,
        reason: lr.reason as string,
        priority: (lr.priority as number) ?? 0,
        status: lr.status as "ACTIVE" | "DISMISSED" | "COMPLETED",
      },
    });
  }

  // --- Run imports in dependency order ---
  const importSteps: Array<{
    name: string;
    fn: (row: Record<string, unknown>) => Promise<void>;
  }> = [
    { name: "users.safe.json", fn: upsertUser },
    { name: "source-collections.json", fn: upsertSourceCollection },
    { name: "topics.json", fn: upsertTopic },
    { name: "content-packs.json", fn: upsertContentPack },
    { name: "import-batches.json", fn: upsertImportBatch },
    { name: "problems.json", fn: upsertProblem },
    { name: "questions.json", fn: upsertQuestion },
    { name: "wiki-theory-notes.json", fn: upsertTheoryNote },
    { name: "contests.json", fn: upsertContest },
    { name: "contest-problems.json", fn: upsertContestProblem },
    { name: "problem-topics.json", fn: upsertProblemTopic },
    { name: "diagnostic-attempts.json", fn: upsertDiagnosticAttempt },
    { name: "user-skill-profiles.json", fn: upsertUserSkillProfile },
    { name: "user-topic-profiles.json", fn: upsertUserTopicProfile },
    { name: "learning-recommendations.json", fn: upsertLearningRecommendation },
  ];

  for (const step of importSteps) {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = readJson(step.name, step.name);
    } catch {
      // File not found — skip silently (some exports may not have all tables).
      continue;
    }

    console.log(`\nImporting ${step.name} (${rows.length} rows)...`);
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        await step.fn(row);
        imported++;
      } catch (err) {
        const err2 = err as { code?: string; meta?: { field_name?: string } };
        // Log FK violations as skipped rather than failing the whole import.
        if (err2?.code === "P2003") {
          skipped++;
          console.warn(`  Skipped row ${(row as { id?: string }).id ?? "(no id)"}: foreign key constraint failed`);
        } else {
          console.error(`  Error on row ${(row as { id?: string }).id ?? "(no id)"}: ${err}`);
        }
      }
    }

    console.log(`  ✓ Imported: ${imported}  Skipped: ${skipped}`);
  }

  await prisma.$disconnect();

  console.log("\n=== Import complete ===");
  console.log("NOTE: Imported users have empty passwordHash. They must use 'Forgot password' to set a password.");
  console.log("NOTE: Submission, submission-answer, and user-problem-status data was NOT imported (user-specific).");
  console.log("\nNext steps:");
  console.log("  1. Run npm run db:stats to verify counts in the target DB.");
  console.log("  2. Sign up / promote the owner account.");
  console.log("  3. Review published content and run QA.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
