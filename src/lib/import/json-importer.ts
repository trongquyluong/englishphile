import type { ImportExecutionResult, ImportPlan } from "@/lib/import/types";
import type { ContentStatus } from "@prisma/client";
import { buildImportPlan, createOrReuseSourceCollection, createOrReuseTopic, createProblemWithQuestions } from "@/lib/import/duplicates";
import { normalizeJsonPayload, parseJsonText } from "@/lib/import/validation";
import { prisma } from "@/lib/prisma";

export async function validateJsonImport(text: string): Promise<ImportPlan> {
  const parsed = parseJsonText(text);
  if (!parsed.data) {
    return buildImportPlan({ importType: "JSON", problems: [] }, parsed.issues);
  }

  const normalized = normalizeJsonPayload(parsed.data);
  if (!normalized.payload) {
    return buildImportPlan({ importType: "JSON", problems: [] }, normalized.issues);
  }

  return buildImportPlan(normalized.payload, normalized.issues);
}

export async function importJsonPayload(
  text: string,
  userId: string,
  options: { publishImmediately?: boolean; contentPackId?: string; fileName?: string } = {},
): Promise<ImportExecutionResult> {
  const plan = await validateJsonImport(text);

  if (!plan.ok) {
    const batch = await prisma.importBatch.create({
      data: {
        userId,
        importType: "JSON",
        status: "FAILED",
        summary: JSON.parse(JSON.stringify(plan.summary)),
        errorLog: JSON.parse(JSON.stringify(plan.issues)),
        contentPackId: options.contentPackId,
      },
    });
    return { ...plan, batchId: batch.id, status: "FAILED" };
  }

  let sourceCollectionId: string | undefined;
  let problemsImported = 0;
  let questionsImported = 0;
  const contentStatus: ContentStatus =
    options.publishImmediately && plan.summary.possibleDuplicateQuestionsFlagged === 0 ? "PUBLISHED" : "NEEDS_REVIEW";

  const batch = await prisma.importBatch.create({
    data: {
      userId,
      importType: "JSON",
      status: "IMPORTED",
      summary: JSON.parse(JSON.stringify(plan.summary)),
      errorLog: plan.issues.length ? JSON.parse(JSON.stringify(plan.issues)) : undefined,
      contentPackId: options.contentPackId,
    },
  });

  for (const problem of plan.payload.problems) {
    const sourceCollection = await createOrReuseSourceCollection(problem.sourceCollection);
    sourceCollectionId ??= sourceCollection.id;
    const topics = await Promise.all(problem.topics.map((topicName) => createOrReuseTopic(topicName)));
    await createProblemWithQuestions(
      problem,
      sourceCollection.id,
      topics.map((topic) => topic.id),
      { contentStatus, reviewedById: userId, importedBatchId: batch.id, contentPackId: options.contentPackId },
    );
    problemsImported += 1;
    questionsImported += problem.questions.length;
  }

  const summary = { ...plan.summary, problemsImported, questionsImported, fileName: options.fileName };
  const updatedBatch = await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      sourceCollectionId,
      summary: JSON.parse(JSON.stringify(summary)),
    },
  });

  return { ...plan, summary, batchId: updatedBatch.id, status: "IMPORTED" };
}
