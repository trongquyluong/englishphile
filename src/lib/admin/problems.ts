import { Prisma, type ContentStatus, type Difficulty, type QuestionType, type SkillType } from "@prisma/client";
import { createContentAuditLog } from "@/lib/admin/audit";
import { questionPublishErrors, updateQuestion, validateQuestionEditPayload, type AdminResult, type QuestionEditPayload } from "@/lib/admin/questions";
import { generateSlug } from "@/lib/import/duplicates";
import { contentStatusOrder, difficultyOrder, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_RESOURCE_UNAVAILABLE,
  MAX_ADMIN_BULK_QUESTIONS,
  lockContentPackForAdminMutation,
  lockProblemsForAdminMutation,
  parseBoundedUniqueIds,
} from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";
import { getContentQaReport } from "@/lib/content-packs/qa";

export type ProblemEditPayload = {
  id: string;
  title: string;
  slug: string;
  statement: string;
  instructions?: string | null;
  skillType: SkillType;
  questionType: QuestionType;
  difficulty: Difficulty;
  estimatedMinutes?: number | null;
  sourceCollectionId?: string | null;
  topicTags: string[];
  contentStatus: ContentStatus;
};

export const MAX_PROBLEM_EDIT_QUESTIONS = 50;
export const MAX_PROBLEM_TOPIC_ASSOCIATIONS = 20;

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function questionTypeIsValid(value: QuestionType) {
  return [
    "PRONUNCIATION_ODD_ONE_OUT",
    "MCQ",
    "OPEN_CLOZE",
    "GUIDED_CLOZE",
    "WORD_FORMATION",
    "SENTENCE_TRANSFORMATION",
    "ERROR_IDENTIFICATION",
    "READING_MCQ",
    "LISTENING_MCQ",
    "LISTENING_SHORT_ANSWER",
    "WRITING_PROMPT",
    "TRIOS_GAPPED_SENTENCES",
    "SHORT_ANSWER",
  ].includes(value);
}

export async function createOrReuseAdminTopic(name: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const cleanName = name.trim();
  const slug = generateSlug(cleanName);
  const existing = await db.topic.findFirst({
    where: { OR: [{ slug }, { name: cleanName }] },
  });
  if (existing) return existing;
  return db.topic.create({
    data: {
      name: cleanName,
      slug,
      description: `Topic được tạo trong admin: ${cleanName}`,
    },
  });
}

export async function validateProblemCanPublish(
  problemId: string,
  candidateQuestions?: QuestionEditPayload[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const problem = await db.problem.findUnique({
    where: { id: problemId },
    include: { questions: { orderBy: { orderIndex: "asc" } } },
  });

  if (!problem) return ["Không tìm thấy bài."];

  const questions = candidateQuestions ?? problem.questions;
  if (questions.length === 0) {
    return ["Không thể publish bài chưa có câu hỏi."];
  }

  const errors: string[] = [];
  for (const question of questions) {
    const questionErrors = questionPublishErrors(question);
    errors.push(...questionErrors.map((message) => `${question.prompt.slice(0, 40) || question.id}: ${message}`));
  }
  return errors;
}

async function updateProblem(
  payload: ProblemEditPayload,
  userId: string,
  db: Prisma.TransactionClient,
  options: { skipPublishValidation?: boolean } = {},
): Promise<AdminResult> {
  if (!payload.title.trim()) return { ok: false, message: "Tiêu đề không được để trống." };
  const slug = payload.slug.trim() || generateSlug(payload.title);
  if (!isValidSlug(slug)) return { ok: false, message: "Slug không hợp lệ." };
  if (!payload.statement.trim()) return { ok: false, message: "Đề bài không được để trống." };
  if (!skillOrder.includes(payload.skillType)) return { ok: false, message: "Skill type không hợp lệ." };
  if (!difficultyOrder.includes(payload.difficulty)) return { ok: false, message: "Độ khó không hợp lệ." };
  if (!questionTypeIsValid(payload.questionType)) return { ok: false, message: "Question type không hợp lệ." };
  if (!contentStatusOrder.includes(payload.contentStatus)) return { ok: false, message: "Content status không hợp lệ." };

  const existingSlug = await db.problem.findFirst({ where: { slug, NOT: { id: payload.id } } });
  if (existingSlug) return { ok: false, message: "Slug đã tồn tại." };

  if (payload.contentStatus === "PUBLISHED" && !options.skipPublishValidation) {
    const publishErrors = await validateProblemCanPublish(payload.id, undefined, db);
    if (publishErrors.length) return { ok: false, message: publishErrors[0] };
  }

  const before = await db.problem.findUnique({
    where: { id: payload.id },
    include: { problemTopics: true },
  });
  if (!before) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };

  const topics = await Promise.all(payload.topicTags.filter(Boolean).map((topic) => createOrReuseAdminTopic(topic, db)));
  const reviewedAt = payload.contentStatus === "PUBLISHED" || payload.contentStatus === "NEEDS_REVIEW" ? new Date() : null;
  const publishedAt = payload.contentStatus === "PUBLISHED" ? (before.publishedAt ?? new Date()) : payload.contentStatus === "ARCHIVED" ? before.publishedAt : null;

  const updated = await db.problem.update({
    where: { id: payload.id },
    data: {
      title: payload.title.trim(),
      slug,
      statement: payload.statement.trim(),
      instructions: payload.instructions?.trim() || null,
      skillType: payload.skillType,
      questionType: payload.questionType,
      difficulty: payload.difficulty,
      estimatedMinutes: payload.estimatedMinutes,
      sourceCollectionId: payload.sourceCollectionId || null,
      contentStatus: payload.contentStatus,
      publishedAt,
      reviewedAt,
      reviewedById: reviewedAt ? userId : null,
      problemTopics: {
        deleteMany: {},
        create: topics.map((topic) => ({ topicId: topic.id })),
      },
    },
    include: { problemTopics: true },
  });

  await createContentAuditLog({
    userId,
    entityType: "Problem",
    entityId: payload.id,
    action: "UPDATED",
    beforeJson: before,
    afterJson: updated,
  }, db);

  return { ok: true, message: "Đã lưu thay đổi." };
}

export async function updateProblemWithQuestions(
  problemPayload: ProblemEditPayload,
  questionPayloads: QuestionEditPayload[],
  userId: string,
): Promise<AdminResult> {
  const normalizedTopicTags = [...new Set(problemPayload.topicTags.map((topic) => topic.trim()).filter(Boolean))];
  if (normalizedTopicTags.length > MAX_PROBLEM_TOPIC_ASSOCIATIONS) {
    return { ok: false, message: `Mỗi bài chỉ hỗ trợ tối đa ${MAX_PROBLEM_TOPIC_ASSOCIATIONS} topic.` };
  }
  if (questionPayloads.length > MAX_PROBLEM_EDIT_QUESTIONS) {
    return { ok: false, message: `Mỗi lần sửa chỉ hỗ trợ tối đa ${MAX_PROBLEM_EDIT_QUESTIONS} câu hỏi.` };
  }
  const normalizedProblemPayload = { ...problemPayload, topicTags: normalizedTopicTags };
  const submittedIds = questionPayloads.map((question) => question.id);
  if (new Set(submittedIds).size !== submittedIds.length) {
    return { ok: false, message: "Danh sách câu hỏi có mã bị trùng." };
  }

  const normalizedQuestionPayloads =
    normalizedProblemPayload.contentStatus === "DRAFT"
      ? questionPayloads
      : questionPayloads.map((question) => ({ ...question, contentStatus: normalizedProblemPayload.contentStatus }));

  for (const question of normalizedQuestionPayloads) {
    const validation = validateQuestionEditPayload(question);
    if (!validation.ok) return validation;
  }

  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockProblemsForAdminMutation(tx, [normalizedProblemPayload.id]);
    if (locked.length !== 1) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    const stored = await tx.problem.findUnique({
      where: { id: normalizedProblemPayload.id },
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    });
    if (!stored) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };

    const storedIds = new Set(stored.questions.map((question) => question.id));
    if (submittedIds.some((id) => !storedIds.has(id))) {
      return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    }

    if (normalizedProblemPayload.contentStatus === "PUBLISHED") {
      const submittedById = new Map(normalizedQuestionPayloads.map((question) => [question.id, question]));
      const candidateQuestions = stored.questions.map((question) => submittedById.get(question.id) ?? question);
      if (candidateQuestions.length === 0) return { ok: false, message: "Không thể publish bài chưa có câu hỏi." };
      for (const question of candidateQuestions) {
        const errors = questionPublishErrors(question);
        if (errors.length) return { ok: false, message: errors[0] };
      }
    }

    const problemResult = await updateProblem(normalizedProblemPayload, userId, tx, { skipPublishValidation: true });
    if (!problemResult.ok) return problemResult;

    for (const question of normalizedQuestionPayloads) {
      const result = await updateQuestion(question, normalizedProblemPayload.id, userId, tx);
      if (!result.ok) throw new Error("Question validation changed after pre-validation.");
    }

    // Omitted stored questions are deliberately preserved. When the problem
    // leaves DRAFT, their lifecycle status follows the parent atomically.
    if (normalizedProblemPayload.contentStatus !== "DRAFT") {
      const reviewedAt = normalizedProblemPayload.contentStatus === "PUBLISHED" || normalizedProblemPayload.contentStatus === "NEEDS_REVIEW" ? new Date() : null;
      await tx.question.updateMany({
        where: { problemId: normalizedProblemPayload.id, ...(submittedIds.length ? { id: { notIn: submittedIds } } : {}) },
        data: {
          contentStatus: normalizedProblemPayload.contentStatus,
          reviewedAt,
          reviewedById: reviewedAt ? userId : null,
        },
      });
    }

    return { ok: true, message: "Đã lưu thay đổi." };
  });
}

type ProblemStatusTarget = Prisma.ProblemGetPayload<{ include: { questions: true } }>;

function statusAuditSnapshot(problem: Pick<ProblemStatusTarget, "id" | "contentStatus" | "publishedAt" | "reviewedAt" | "reviewedById">) {
  return {
    id: problem.id,
    contentStatus: problem.contentStatus,
    publishedAt: problem.publishedAt,
    reviewedAt: problem.reviewedAt,
    reviewedById: problem.reviewedById,
  };
}

function statusAuditAction(contentStatus: ContentStatus) {
  return contentStatus === "PUBLISHED"
    ? "PUBLISHED"
    : contentStatus === "ARCHIVED"
      ? "ARCHIVED"
      : contentStatus === "DRAFT"
        ? "RESTORED"
        : "REVIEWED";
}

async function updateProblemStatusesInTransaction(
  tx: Prisma.TransactionClient,
  targets: ProblemStatusTarget[],
  contentStatus: ContentStatus,
  userId: string,
) {
  if (contentStatus === "PUBLISHED") {
    for (const target of targets) {
      if (!target.questions.length) return { ok: false as const, message: "Không thể publish bài chưa có câu hỏi." };
      for (const question of target.questions) {
        const errors = questionPublishErrors(question);
        if (errors.length) return { ok: false as const, message: errors[0] };
      }
    }
  }

  const now = new Date();
  const reviewedAt = contentStatus === "PUBLISHED" || contentStatus === "NEEDS_REVIEW" ? now : null;
  const problemData: Prisma.ProblemUncheckedUpdateManyInput = {
    contentStatus,
    reviewedAt,
    reviewedById: reviewedAt ? userId : null,
    ...(contentStatus === "PUBLISHED" ? { publishedAt: now } : contentStatus === "ARCHIVED" ? {} : { publishedAt: null }),
  };
  const ids = targets.map((target) => target.id);
  const problemsUpdated = await tx.problem.updateMany({ where: { id: { in: ids } }, data: problemData });
  if (problemsUpdated.count !== ids.length) throw new Error("Scoped problem status update invariant failed.");
  await tx.question.updateMany({
    where: { problemId: { in: ids } },
    data: { contentStatus, reviewedAt, reviewedById: reviewedAt ? userId : null },
  });

  const afterById = new Map(targets.map((target) => [target.id, {
    ...statusAuditSnapshot(target),
    contentStatus,
    publishedAt: contentStatus === "PUBLISHED" ? now : contentStatus === "ARCHIVED" ? target.publishedAt : null,
    reviewedAt,
    reviewedById: reviewedAt ? userId : null,
  }]));
  await tx.contentAuditLog.createMany({
    data: targets.map((target) => ({
      userId,
      entityType: "Problem",
      entityId: target.id,
      action: statusAuditAction(contentStatus),
      beforeJson: JSON.parse(JSON.stringify(statusAuditSnapshot(target))),
      afterJson: JSON.parse(JSON.stringify(afterById.get(target.id))),
    })),
  });
  return { ok: true as const };
}

export async function setProblemContentStatus(
  problemId: string,
  contentStatus: ContentStatus,
  userId: string,
): Promise<AdminResult> {
  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockProblemsForAdminMutation(tx, [problemId]);
    if (locked.length !== 1) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    const targets = await tx.problem.findMany({ where: { id: problemId }, include: { questions: true } });
    if (targets.length !== 1) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    const result = await updateProblemStatusesInTransaction(tx, targets, contentStatus, userId);
    return result.ok ? { ok: true, message: "Đã cập nhật trạng thái nội dung." } : result;
  });
}

export async function publishProblem(problemId: string, userId: string) {
  return setProblemContentStatus(problemId, "PUBLISHED", userId);
}

export async function archiveProblem(problemId: string, userId: string) {
  return setProblemContentStatus(problemId, "ARCHIVED", userId);
}

export async function markProblemNeedsReview(problemId: string, userId: string) {
  return setProblemContentStatus(problemId, "NEEDS_REVIEW", userId);
}

export async function restoreProblemDraft(problemId: string, userId: string) {
  return setProblemContentStatus(problemId, "DRAFT", userId);
}

export async function bulkUpdateProblemStatus(
  problemIds: string[],
  contentStatus: ContentStatus,
  userId: string,
  options: { qaRequirement?: "safe" | "errors"; contentPackId?: string } = {},
): Promise<AdminResult> {
  const parsed = parseBoundedUniqueIds(problemIds);
  if (!parsed.ok) return parsed;
  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    if (options.contentPackId) {
      const pack = await lockContentPackForAdminMutation(tx, options.contentPackId);
      if (!pack) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    }
    const locked = await lockProblemsForAdminMutation(tx, parsed.ids);
    if (locked.length !== parsed.ids.length) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };

    // Validate every target before the first write so a public validation
    // failure cannot commit an earlier item in the batch.
    const targets = await tx.problem.findMany({ where: { id: { in: parsed.ids } }, include: { questions: true } });
    if (targets.length !== parsed.ids.length) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    if (options.contentPackId && targets.some((target) => target.contentPackId !== options.contentPackId)) {
      return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    }
    const questionCount = targets.reduce((total, target) => total + target.questions.length, 0);
    if (questionCount > MAX_ADMIN_BULK_QUESTIONS) {
      return { ok: false, message: `Thao tác có quá ${MAX_ADMIN_BULK_QUESTIONS} câu hỏi liên quan.` };
    }
    if (options.qaRequirement) {
      const report = await getContentQaReport({ problemIds: parsed.ids }, tx);
      const requirementFailed =
        report.problems.length !== parsed.ids.length ||
        (options.qaRequirement === "safe"
          ? report.problems.some((problem) => !problem.canPublish)
          : report.problems.some((problem) => problem.errors === 0));
      if (requirementFailed) {
        return { ok: false, message: "Một hoặc nhiều bài không còn khớp kết quả QA hiện tại." };
      }
    }
    const result = await updateProblemStatusesInTransaction(tx, targets, contentStatus, userId);
    return result.ok ? { ok: true, message: `Đã cập nhật ${parsed.ids.length} bài.` } : result;
  });
}
