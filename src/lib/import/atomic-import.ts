import { Prisma, type ContentStatus, type ImportType } from "@prisma/client";
import { AdminResourceUnavailableError, lockContentPackForAdminMutation } from "@/lib/admin/mutation-locks";
import {
  isContentAdminTransactionAuthorizationError,
  requireContentAdminInTransaction,
} from "@/lib/auth/content-admin-transaction";
import {
  contentPackBatchIdentitySummary,
  readContentPackBatchIdentity,
  readContentPackExecutionPlan,
  reconcileContentPackExecutionInTransaction,
} from "@/lib/content-packs/execution";
import {
  contentPackFileIdentityKey,
  type ContentPackFileIdentity,
} from "@/lib/content-packs/file-identity";
import {
  createProblemWithQuestions,
  generateSlug,
  type ImportProblemWriteStage,
} from "@/lib/import/duplicates";
import type { ImportExecutionResult, ImportIssue, ImportPlan, NormalizedProblem } from "@/lib/import/types";
import {
  classifySafePrismaErrorKind,
  safeErrorSignal,
  safePrismaKnownRequestCode,
} from "@/lib/operations/safe-error";
import { prisma } from "@/lib/prisma";

export const MAX_IMPORT_PROBLEMS_PER_COMMIT = 25;
export const MAX_IMPORT_QUESTIONS_PER_COMMIT = 250;
export const MAX_IMPORT_TOPIC_ASSOCIATIONS_PER_COMMIT = 100;
export const MAX_IMPORT_UNIQUE_TOPICS_PER_COMMIT = 50;
export const MAX_IMPORT_UNIQUE_SOURCES_PER_COMMIT = 25;

type ImportCommitInput = {
  importType: ImportType;
  userId: string;
  contentStatus: ContentStatus;
  contentPackId?: string;
  fileIdentity?: ContentPackFileIdentity;
};

type ImportCommitStage =
  | "transaction-start"
  | "principal-revalidation"
  | "content-pack-lock"
  | "committed-file-lookup"
  | "import-batch-create"
  | "taxonomy-lock"
  | "source-lookup"
  | "source-create"
  | "topic-lookup"
  | "topic-create"
  | ImportProblemWriteStage
  | "import-batch-finalize"
  | "content-pack-reconcile";

function normalizeProblems(problems: NormalizedProblem[]) {
  return problems.map((problem) => ({
    ...problem,
    topics: [...new Set(problem.topics.map((topic) => topic.trim()).filter(Boolean))],
  }));
}

export function inspectImportCommitBounds(plan: ImportPlan) {
  const problems = normalizeProblems(plan.payload.problems);
  const problemCount = problems.length;
  const questionCount = problems.reduce((total, problem) => total + problem.questions.length, 0);
  const topicAssociationCount = problems.reduce((total, problem) => total + problem.topics.length, 0);
  const uniqueTopicCount = new Set(problems.flatMap((problem) => problem.topics.map((topic) => generateSlug(topic)))).size;
  const uniqueSourceCount = new Set(problems.map((problem) => problem.sourceCollection.name.trim())).size;
  const duplicateSlugs = new Set(problems.map((problem) => problem.slug)).size !== problemCount;
  const withinBounds =
    problemCount <= MAX_IMPORT_PROBLEMS_PER_COMMIT &&
    questionCount <= MAX_IMPORT_QUESTIONS_PER_COMMIT &&
    topicAssociationCount <= MAX_IMPORT_TOPIC_ASSOCIATIONS_PER_COMMIT &&
    uniqueTopicCount <= MAX_IMPORT_UNIQUE_TOPICS_PER_COMMIT &&
    uniqueSourceCount <= MAX_IMPORT_UNIQUE_SOURCES_PER_COMMIT &&
    !duplicateSlugs;
  return {
    problems,
    problemCount,
    questionCount,
    topicAssociationCount,
    uniqueTopicCount,
    uniqueSourceCount,
    duplicateSlugs,
    withinBounds,
  };
}

function commitLimitIssue(): ImportIssue {
  return {
    level: "error",
    path: "import",
    message:
      `Mỗi lần commit chỉ hỗ trợ tối đa ${MAX_IMPORT_PROBLEMS_PER_COMMIT} bài, ` +
      `${MAX_IMPORT_QUESTIONS_PER_COMMIT} câu hỏi, ${MAX_IMPORT_TOPIC_ASSOCIATIONS_PER_COMMIT} liên kết topic, ` +
      `${MAX_IMPORT_UNIQUE_TOPICS_PER_COMMIT} topic và ${MAX_IMPORT_UNIQUE_SOURCES_PER_COMMIT} nguồn duy nhất; slug bài không được trùng.`,
    code: "IMPORT_COMMIT_LIMIT",
  };
}

function planWithActualCounts(plan: ImportPlan, bounds: ReturnType<typeof inspectImportCommitBounds>) {
  return {
    ...plan,
    payload: { ...plan.payload, problems: bounds.problems },
    summary: {
      ...plan.summary,
      problemsToCreate: bounds.problemCount,
      questionsToCreate: bounds.questionCount,
    },
  };
}

async function lockPackIfPresent(tx: Prisma.TransactionClient, input: ImportCommitInput) {
  if (!input.contentPackId) return;
  if (!input.fileIdentity) throw new AdminResourceUnavailableError();
  const pack = await lockContentPackForAdminMutation(tx, input.contentPackId);
  if (!pack) throw new AdminResourceUnavailableError();
  const stored = await tx.contentPack.findUnique({ where: { id: pack.id }, select: { manifestJson: true } });
  if (!stored) throw new AdminResourceUnavailableError();
  const expectedKey = contentPackFileIdentityKey(input.fileIdentity);
  const matches = readContentPackExecutionPlan(stored.manifestJson)
    .filter((entry) => entry.state === "PENDING" && contentPackFileIdentityKey(entry) === expectedKey);
  if (matches.length !== 1) throw new AdminResourceUnavailableError();
}

async function recordRejectedPlan(
  plan: ImportPlan,
  input: ImportCommitInput,
): Promise<ImportExecutionResult> {
  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, input.userId);
    await lockPackIfPresent(tx, input);
    const summary = {
      ...plan.summary,
      ...(input.fileIdentity ? contentPackBatchIdentitySummary(input.fileIdentity) : {}),
    };
    const batch = await tx.importBatch.create({
      data: {
        userId: input.userId,
        importType: input.importType,
        status: "FAILED",
        summary: JSON.parse(JSON.stringify(summary)),
        errorLog: JSON.parse(JSON.stringify(plan.issues)),
        contentPackId: input.contentPackId,
      },
    });
    if (input.contentPackId) {
      const reconciled = await reconcileContentPackExecutionInTransaction(tx, input.contentPackId);
      if (!reconciled) throw new AdminResourceUnavailableError();
    }
    return { ...plan, summary, batchId: batch.id, status: "FAILED" };
  });
}

function summaryRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function findCommittedFile(
  tx: Prisma.TransactionClient,
  plan: ImportPlan,
  input: ImportCommitInput,
): Promise<ImportExecutionResult | null> {
  if (!input.contentPackId || !input.fileIdentity) return null;
  const batches = await tx.importBatch.findMany({
    where: {
      contentPackId: input.contentPackId,
      status: "IMPORTED",
    },
    select: { id: true, summary: true },
  });
  const expectedKey = contentPackFileIdentityKey(input.fileIdentity);
  const matches = batches.filter((batch) => {
    const identity = readContentPackBatchIdentity(batch.summary);
    return identity ? contentPackFileIdentityKey(identity) === expectedKey : false;
  });
  if (matches.length > 1) throw new AdminResourceUnavailableError();
  const batch = matches[0];
  if (!batch) return null;
  const stored = summaryRecord(batch.summary);
  const summary = {
    ...plan.summary,
    problemsImported: Number.isSafeInteger(stored.problemsImported) ? Number(stored.problemsImported) : 0,
    questionsImported: Number.isSafeInteger(stored.questionsImported) ? Number(stored.questionsImported) : 0,
  };
  return { ...plan, summary, batchId: batch.id, status: "IMPORTED" };
}

async function lockTaxonomyKeys(tx: Prisma.TransactionClient, keys: string[]) {
  if (!keys.length) return;
  const sortedKeys = [...new Set(keys)].sort();
  await tx.$queryRaw`
    SELECT count(*)::int AS "lockCount"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended("lockKey", 0))
      FROM unnest(ARRAY[${Prisma.join(sortedKeys)}]::text[]) AS taxonomy_lock("lockKey")
      ORDER BY "lockKey"
    ) AS acquired_taxonomy_locks
  `;
}

async function prepareTaxonomy(
  tx: Prisma.TransactionClient,
  problems: NormalizedProblem[],
  setStage: (stage: ImportCommitStage) => void,
) {
  const sourceInputs = new Map(problems.map((problem) => [problem.sourceCollection.name, problem.sourceCollection]));
  const sourceNames = [...sourceInputs.keys()];
  const topicNames = [...new Set(problems.flatMap((problem) => problem.topics))];
  const topicInputs = new Map<string, string>();
  for (const name of topicNames) {
    const slug = generateSlug(name);
    if (!topicInputs.has(slug)) topicInputs.set(slug, name);
  }

  setStage("taxonomy-lock");
  await lockTaxonomyKeys(tx, [
    ...sourceNames.map((name) => `source:${name}`),
    ...topicInputs.keys().map((slug) => `topic:${slug}`),
  ]);

  setStage("source-lookup");
  const sources = await tx.sourceCollection.findMany({
    where: { name: { in: sourceNames } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  const sourceByName = new Map<string, string>();
  for (const source of sources) {
    if (!sourceByName.has(source.name)) sourceByName.set(source.name, source.id);
  }
  const missingSources = [...sourceInputs.values()].filter((source) => !sourceByName.has(source.name));
  if (missingSources.length) {
    setStage("source-create");
    const createdSources = await tx.sourceCollection.createManyAndReturn({
      data: missingSources.map((source) => ({
        name: source.name,
        description: source.description,
        originalFileName: source.originalFileName,
        sourceType: source.sourceType,
        copyrightNote: source.copyrightNote,
      })),
      select: { id: true, name: true },
    });
    for (const source of createdSources) sourceByName.set(source.name, source.id);
  }

  const topicSlugs = [...topicInputs.keys()];
  setStage("topic-lookup");
  const topics = topicNames.length
    ? await tx.topic.findMany({
        where: { OR: [{ name: { in: topicNames } }, { slug: { in: topicSlugs } }] },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const topicByKey = new Map<string, string>();
  for (const topic of topics) {
    topicByKey.set(topic.name, topic.id);
    topicByKey.set(topic.slug, topic.id);
  }
  const missingTopics = [...topicInputs].filter(([slug, name]) => !topicByKey.has(name) && !topicByKey.has(slug));
  if (missingTopics.length) {
    setStage("topic-create");
    const createdTopics = await tx.topic.createManyAndReturn({
      data: missingTopics.map(([slug, name]) => ({ name, slug, description: `Topic được tạo từ import: ${name}` })),
      select: { id: true, name: true, slug: true },
    });
    for (const topic of createdTopics) {
      topicByKey.set(topic.name, topic.id);
      topicByKey.set(topic.slug, topic.id);
    }
  }
  return { sourceByName, topicByKey };
}

export async function executeImportPlanAtomically(
  originalPlan: ImportPlan,
  input: ImportCommitInput,
): Promise<ImportExecutionResult> {
  const bounds = inspectImportCommitBounds(originalPlan);
  let plan = planWithActualCounts(originalPlan, bounds);
  if (!plan.ok || !bounds.withinBounds) {
    if (!bounds.withinBounds) {
      const issue = commitLimitIssue();
      plan = {
        ...plan,
        ok: false,
        issues: [...plan.issues, issue],
        summary: { ...plan.summary, errors: plan.summary.errors + 1 },
      };
    }
    return recordRejectedPlan(plan, input);
  }

  let stage: ImportCommitStage = "transaction-start";
  try {
    return await prisma.$transaction(async (tx) => {
      // Consistent lock order: current User, optional ContentPack, then content.
      stage = "principal-revalidation";
      await requireContentAdminInTransaction(tx, input.userId);
      stage = "content-pack-lock";
      await lockPackIfPresent(tx, input);
      stage = "committed-file-lookup";
      const committed = await findCommittedFile(tx, plan, input);
      if (committed) return committed;

      stage = "import-batch-create";
      const batch = await tx.importBatch.create({
        data: {
          userId: input.userId,
          importType: input.importType,
          status: "VALIDATED",
          summary: JSON.parse(JSON.stringify({
            ...plan.summary,
            ...(input.fileIdentity ? contentPackBatchIdentitySummary(input.fileIdentity) : {}),
          })),
          errorLog: plan.issues.length ? JSON.parse(JSON.stringify(plan.issues)) : undefined,
          contentPackId: input.contentPackId,
        },
      });
      const taxonomy = await prepareTaxonomy(tx, bounds.problems, (nextStage) => { stage = nextStage; });
      let sourceCollectionId: string | undefined;
      let problemsImported = 0;
      let questionsImported = 0;
      for (const problem of bounds.problems) {
        const sourceId = taxonomy.sourceByName.get(problem.sourceCollection.name);
        if (!sourceId) throw new Error("Import taxonomy invariant failed.");
        sourceCollectionId ??= sourceId;
        const topicIds = [...new Set(problem.topics.map(
          (topic) => taxonomy.topicByKey.get(topic) ?? taxonomy.topicByKey.get(generateSlug(topic)),
        ))];
        if (topicIds.some((topicId) => !topicId)) throw new Error("Import taxonomy invariant failed.");
        await createProblemWithQuestions(problem, sourceId, topicIds as string[], {
          contentStatus: input.contentStatus,
          reviewedById: input.userId,
          importedBatchId: batch.id,
          contentPackId: input.contentPackId,
          reportStage: (nextStage) => { stage = nextStage; },
        }, tx);
        problemsImported += 1;
        questionsImported += problem.questions.length;
      }

      const summary = {
        ...plan.summary,
        problemsImported,
        questionsImported,
        ...(input.fileIdentity ? contentPackBatchIdentitySummary(input.fileIdentity) : {}),
      };
      stage = "import-batch-finalize";
      const updatedBatch = await tx.importBatch.update({
        where: { id: batch.id },
        data: { status: "IMPORTED", sourceCollectionId, summary: JSON.parse(JSON.stringify(summary)) },
      });
      if (input.contentPackId) {
        stage = "content-pack-reconcile";
        const reconciled = await reconcileContentPackExecutionInTransaction(tx, input.contentPackId);
        if (!reconciled) throw new AdminResourceUnavailableError();
      }
      return { ...plan, summary, batchId: updatedBatch.id, status: "IMPORTED" };
    });
  } catch (error) {
    if (!isContentAdminTransactionAuthorizationError(error)) {
      console.error("Import commit failed.", {
        ...safeErrorSignal("import-commit", error),
        stage,
        prismaErrorKind: classifySafePrismaErrorKind(error),
        prismaCode: safePrismaKnownRequestCode(error),
      });
    }
    throw error;
  }
}
