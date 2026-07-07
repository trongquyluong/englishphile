import type { ContentStatus, Difficulty, QuestionType, SkillType } from "@prisma/client";
import { createContentAuditLog } from "@/lib/admin/audit";
import { questionPublishErrors, updateQuestion, type AdminResult, type QuestionEditPayload } from "@/lib/admin/questions";
import { generateSlug } from "@/lib/import/duplicates";
import { contentStatusOrder, difficultyOrder, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

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

export async function createOrReuseAdminTopic(name: string) {
  const cleanName = name.trim();
  const slug = generateSlug(cleanName);
  const existing = await prisma.topic.findFirst({
    where: { OR: [{ slug }, { name: cleanName }] },
  });
  if (existing) return existing;
  return prisma.topic.create({
    data: {
      name: cleanName,
      slug,
      description: `Topic được tạo trong admin: ${cleanName}`,
    },
  });
}

export async function validateProblemCanPublish(problemId: string, candidateQuestions?: QuestionEditPayload[]) {
  const problem = await prisma.problem.findUnique({
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

export async function updateProblem(
  payload: ProblemEditPayload,
  userId: string,
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

  const existingSlug = await prisma.problem.findFirst({ where: { slug, NOT: { id: payload.id } } });
  if (existingSlug) return { ok: false, message: "Slug đã tồn tại." };

  if (payload.contentStatus === "PUBLISHED" && !options.skipPublishValidation) {
    const publishErrors = await validateProblemCanPublish(payload.id);
    if (publishErrors.length) return { ok: false, message: publishErrors[0] };
  }

  const before = await prisma.problem.findUnique({
    where: { id: payload.id },
    include: { problemTopics: true },
  });
  if (!before) return { ok: false, message: "Không tìm thấy bài." };

  const topics = await Promise.all(payload.topicTags.filter(Boolean).map((topic) => createOrReuseAdminTopic(topic)));
  const reviewedAt = payload.contentStatus === "PUBLISHED" || payload.contentStatus === "NEEDS_REVIEW" ? new Date() : null;
  const publishedAt = payload.contentStatus === "PUBLISHED" ? (before.publishedAt ?? new Date()) : payload.contentStatus === "ARCHIVED" ? before.publishedAt : null;

  const updated = await prisma.problem.update({
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
  });

  return { ok: true, message: "Đã lưu thay đổi." };
}

export async function updateProblemWithQuestions(
  problemPayload: ProblemEditPayload,
  questionPayloads: QuestionEditPayload[],
  userId: string,
): Promise<AdminResult> {
  const normalizedQuestionPayloads =
    problemPayload.contentStatus === "DRAFT"
      ? questionPayloads
      : questionPayloads.map((question) => ({ ...question, contentStatus: problemPayload.contentStatus }));

  if (problemPayload.contentStatus === "PUBLISHED") {
    if (normalizedQuestionPayloads.length === 0) return { ok: false, message: "Không thể publish bài chưa có câu hỏi." };
    for (const question of normalizedQuestionPayloads) {
      const errors = questionPublishErrors(question);
      if (errors.length) return { ok: false, message: errors[0] };
    }
  }

  const problemResult = await updateProblem(problemPayload, userId, { skipPublishValidation: true });
  if (!problemResult.ok) return problemResult;

  for (const question of normalizedQuestionPayloads) {
    const result = await updateQuestion(question, userId);
    if (!result.ok) return result;
  }

  return { ok: true, message: "Đã lưu thay đổi." };
}

export async function setProblemContentStatus(
  problemId: string,
  contentStatus: ContentStatus,
  userId: string,
): Promise<AdminResult> {
  if (contentStatus === "PUBLISHED") {
    const publishErrors = await validateProblemCanPublish(problemId);
    if (publishErrors.length) return { ok: false, message: publishErrors[0] };
  }

  const before = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!before) return { ok: false, message: "Không tìm thấy bài." };

  const reviewedAt = contentStatus === "PUBLISHED" || contentStatus === "NEEDS_REVIEW" ? new Date() : null;
  const updated = await prisma.problem.update({
    where: { id: problemId },
    data: {
      contentStatus,
      publishedAt: contentStatus === "PUBLISHED" ? new Date() : contentStatus === "ARCHIVED" ? before.publishedAt : null,
      reviewedAt,
      reviewedById: reviewedAt ? userId : null,
      questions: {
        updateMany: {
          where: {},
          data: {
            contentStatus,
            reviewedAt,
            reviewedById: reviewedAt ? userId : null,
          },
        },
      },
    },
  });

  await createContentAuditLog({
    userId,
    entityType: "Problem",
    entityId: problemId,
    action: contentStatus === "PUBLISHED" ? "PUBLISHED" : contentStatus === "ARCHIVED" ? "ARCHIVED" : contentStatus === "DRAFT" ? "RESTORED" : "REVIEWED",
    beforeJson: before,
    afterJson: updated,
  });

  return { ok: true, message: "Đã cập nhật trạng thái nội dung." };
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
): Promise<AdminResult> {
  const ids = [...new Set(problemIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, message: "Chưa chọn bài nào." };

  for (const id of ids) {
    const result = await setProblemContentStatus(id, contentStatus, userId);
    if (!result.ok) return result;
  }

  return { ok: true, message: `Đã cập nhật ${ids.length} bài.` };
}
