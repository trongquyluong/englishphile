import type { ContentStatus, PrismaClient } from "@prisma/client";
import type {
  ImportIssue,
  ImportPlan,
  ImportSummary,
  NormalizedImportPayload,
  NormalizedProblem,
  NormalizedQuestion,
} from "@/lib/import/types";
import { attachDuplicateRiskMetadata, detectImportDuplicates, getQuestionFingerprint } from "@/lib/import/duplicate-detection";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | typeof prisma;

export function generateSlug(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `problem-${Date.now()}`;
}

function topicSlug(value: string) {
  return generateSlug(value);
}

export function detectDuplicateQuestion(questions: NormalizedQuestion[], candidate: NormalizedQuestion) {
  const key = getQuestionFingerprint(candidate);
  return questions.some((question) => getQuestionFingerprint(question) === key);
}

function emptySummary(): ImportSummary {
  return {
    sourceCollectionsToCreate: 0,
    sourceCollectionsReused: 0,
    topicsToCreate: 0,
    topicsReused: 0,
    problemsToCreate: 0,
    questionsToCreate: 0,
    duplicateProblemsSkipped: 0,
    duplicateQuestionsSkipped: 0,
    exactDuplicateQuestionsSkipped: 0,
    highSimilarityQuestionsSkipped: 0,
    possibleDuplicateQuestionsFlagged: 0,
    problemsImported: 0,
    questionsImported: 0,
    errors: 0,
    warnings: 0,
  };
}

export async function buildImportPlan(payload: NormalizedImportPayload, baseIssues: ImportIssue[] = []): Promise<ImportPlan> {
  const issues: ImportIssue[] = [...baseIssues];
  const summary = emptySummary();
  const preview: ImportPlan["preview"] = [];
  const sourceNames = [...new Set(payload.problems.map((problem) => problem.sourceCollection.name))];
  const topicNames = [...new Set(payload.problems.flatMap((problem) => problem.topics))];
  const problemSlugs = [...new Set(payload.problems.map((problem) => problem.slug))];

  const [existingSources, existingTopics, existingProblems] = await Promise.all([
    prisma.sourceCollection.findMany({ where: { name: { in: sourceNames } }, select: { name: true } }),
    prisma.topic.findMany({
      where: {
        OR: [
          { name: { in: topicNames } },
          { slug: { in: topicNames.map(topicSlug) } },
        ],
      },
      select: { name: true, slug: true },
    }),
    prisma.problem.findMany({ where: { slug: { in: problemSlugs } }, select: { slug: true } }),
  ]);

  const existingSourceNames = new Set(existingSources.map((source) => source.name));
  const existingTopicKeys = new Set(existingTopics.flatMap((topic) => [topic.name.toLowerCase(), topic.slug]));
  const existingProblemSlugs = new Set(existingProblems.map((problem) => problem.slug));
  const seenProblemSlugs = new Set<string>();
  const usedNewSources = new Set<string>();
  const usedReusedSources = new Set<string>();
  const usedNewTopics = new Set<string>();
  const usedReusedTopics = new Set<string>();
  const normalizedProblems: NormalizedProblem[] = [];

  for (const problem of payload.problems) {
    const messages: string[] = [];
    const importedQuestions: NormalizedQuestion[] = [];
    let action: "create" | "skip" = "create";

    if (seenProblemSlugs.has(problem.slug) || existingProblemSlugs.has(problem.slug)) {
      action = "skip";
      summary.duplicateProblemsSkipped += 1;
      const message = seenProblemSlugs.has(problem.slug)
        ? "Trùng slug trong file import; problem này sẽ bị bỏ qua."
        : "Slug đã tồn tại trong database; Phase 2 bỏ qua thay vì overwrite.";
      messages.push(message);
      issues.push({ level: "warning", path: `problems.${problem.slug}`, message });
    }

    seenProblemSlugs.add(problem.slug);

    for (const question of problem.questions) {
      if (detectDuplicateQuestion(importedQuestions, question)) {
        summary.duplicateQuestionsSkipped += 1;
        summary.exactDuplicateQuestionsSkipped += 1;
        const message = "Question trùng hoàn toàn trong cùng problem; question này sẽ bị bỏ qua.";
        messages.push(message);
        issues.push({ level: "warning", path: `problems.${problem.slug}.questions.${question.orderIndex}`, message, code: "DUPLICATE_EXACT" });
      } else {
        const duplicateRisk = action === "create" ? await detectImportDuplicates(problem, question) : { level: "NONE" as const, action: "import" as const, similarity: 0 };
        if (duplicateRisk.level === "EXACT") {
          summary.duplicateQuestionsSkipped += 1;
          summary.exactDuplicateQuestionsSkipped += 1;
          const message = "Câu này trùng với câu đã có nên đã bị bỏ qua.";
          messages.push(message);
          issues.push({
            level: "warning",
            path: `problems.${problem.slug}.questions.${question.orderIndex}`,
            message,
            code: "DUPLICATE_EXACT",
            duplicate: {
              similarity: duplicateRisk.similarity,
              action: "skip",
              existingQuestionId: duplicateRisk.existingQuestionId,
              existingProblemId: duplicateRisk.existingProblemId,
              existingProblemTitle: duplicateRisk.existingProblemTitle,
              existingPromptExcerpt: duplicateRisk.existingPromptExcerpt,
            },
          });
        } else if (duplicateRisk.level === "HIGH_SIMILARITY") {
          summary.duplicateQuestionsSkipped += 1;
          summary.highSimilarityQuestionsSkipped += 1;
          const message = "Câu này rất giống câu đã có nên đã bị bỏ qua.";
          messages.push(message);
          issues.push({
            level: "warning",
            path: `problems.${problem.slug}.questions.${question.orderIndex}`,
            message,
            code: "DUPLICATE_HIGH_SIMILARITY",
            duplicate: {
              similarity: duplicateRisk.similarity,
              action: "skip",
              existingQuestionId: duplicateRisk.existingQuestionId,
              existingProblemId: duplicateRisk.existingProblemId,
              existingProblemTitle: duplicateRisk.existingProblemTitle,
              existingPromptExcerpt: duplicateRisk.existingPromptExcerpt,
            },
          });
        } else if (duplicateRisk.level === "POSSIBLE") {
          summary.possibleDuplicateQuestionsFlagged += 1;
          const message = "Câu này có thể trùng với câu đã có; đã import ở trạng thái cần duyệt.";
          messages.push(message);
          issues.push({
            level: "warning",
            path: `problems.${problem.slug}.questions.${question.orderIndex}`,
            message,
            code: "DUPLICATE_POSSIBLE",
            duplicate: {
              similarity: duplicateRisk.similarity,
              action: "needs_review",
              existingQuestionId: duplicateRisk.existingQuestionId,
              existingProblemId: duplicateRisk.existingProblemId,
              existingProblemTitle: duplicateRisk.existingProblemTitle,
              existingPromptExcerpt: duplicateRisk.existingPromptExcerpt,
            },
          });
          importedQuestions.push(attachDuplicateRiskMetadata(question, duplicateRisk));
        } else {
          importedQuestions.push(question);
        }
      }
    }

    if (action === "create") {
      normalizedProblems.push({ ...problem, questions: importedQuestions });
      summary.problemsToCreate += 1;
      summary.questionsToCreate += importedQuestions.length;

      if (existingSourceNames.has(problem.sourceCollection.name)) {
        usedReusedSources.add(problem.sourceCollection.name);
      } else {
        usedNewSources.add(problem.sourceCollection.name);
      }

      for (const topicName of problem.topics) {
        const slug = topicSlug(topicName);
        if (existingTopicKeys.has(topicName.toLowerCase()) || existingTopicKeys.has(slug)) {
          usedReusedTopics.add(slug);
        } else {
          usedNewTopics.add(slug);
        }
      }
    }

    preview.push({
      title: problem.title,
      slug: problem.slug,
      skillType: problem.skillType,
      questionType: problem.questionType,
      difficulty: problem.difficulty,
      sourceName: problem.sourceCollection.name,
      topicNames: problem.topics,
      questionCount: action === "create" ? importedQuestions.length : 0,
      action,
      messages,
    });
  }

  summary.sourceCollectionsToCreate = usedNewSources.size;
  summary.sourceCollectionsReused = usedReusedSources.size;
  summary.topicsToCreate = usedNewTopics.size;
  summary.topicsReused = usedReusedTopics.size;
  summary.errors = issues.filter((issue) => issue.level === "error").length;
  summary.warnings = issues.filter((issue) => issue.level === "warning").length;

  return {
    ok: summary.errors === 0,
    importType: payload.importType,
    summary,
    issues,
    preview,
    payload: { ...payload, problems: normalizedProblems },
  };
}

export async function createOrReuseSourceCollection(
  sourceCollection: NormalizedProblem["sourceCollection"],
  db: Db = prisma,
) {
  const existing = await db.sourceCollection.findFirst({ where: { name: sourceCollection.name } });
  if (existing) return existing;

  return db.sourceCollection.create({
    data: {
      name: sourceCollection.name,
      description: sourceCollection.description,
      originalFileName: sourceCollection.originalFileName,
      sourceType: sourceCollection.sourceType,
      copyrightNote: sourceCollection.copyrightNote,
    },
  });
}

export async function createOrReuseTopic(name: string, db: Db = prisma) {
  const slug = topicSlug(name);
  const existing = await db.topic.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) return existing;

  return db.topic.create({
    data: {
      name,
      slug,
      description: `Topic được tạo từ import: ${name}`,
    },
  });
}

export async function createProblemWithQuestions(
  problem: NormalizedProblem,
  sourceCollectionId: string,
  topicIds: string[],
  options: { contentStatus?: ContentStatus; reviewedById?: string; importedBatchId?: string; contentPackId?: string } = {},
  db: Db = prisma,
) {
  const contentStatus = options.contentStatus ?? "NEEDS_REVIEW";
  const reviewDate = contentStatus === "PUBLISHED" ? new Date() : null;

  return db.problem.create({
    data: {
      title: problem.title,
      slug: problem.slug,
      skillType: problem.skillType,
      questionType: problem.questionType,
      difficulty: problem.difficulty,
      sourceCollectionId,
      statement: problem.statement,
      instructions: problem.instructions,
      estimatedMinutes: problem.estimatedMinutes,
      acceptanceRate: 0,
      contentStatus,
      publishedAt: contentStatus === "PUBLISHED" ? new Date() : null,
      reviewedAt: reviewDate,
      reviewedById: reviewDate ? options.reviewedById : null,
      importedBatchId: options.importedBatchId,
      contentPackId: options.contentPackId,
      orderIndex: problem.orderIndex,
      problemTopics: {
        create: topicIds.map((topicId) => ({ topicId })),
      },
      questions: {
        create: problem.questions.map((question) => ({
          type: question.type,
          skillType: question.skillType,
          difficulty: question.difficulty,
          prompt: question.prompt,
          passage: question.passage,
          options: question.options === undefined ? null : JSON.parse(JSON.stringify(question.options)),
          answer: JSON.parse(JSON.stringify(question.answer)),
          explanation: question.explanation,
          rootWord: question.rootWord,
          keyword: question.keyword,
          targetSentence: question.targetSentence,
          lineNumber: question.lineNumber,
          metadata: question.metadata === undefined ? null : JSON.parse(JSON.stringify(question.metadata)),
          contentStatus,
          reviewedAt: reviewDate,
          reviewedById: reviewDate ? options.reviewedById : null,
          orderIndex: question.orderIndex,
        })),
      },
    },
  });
}
