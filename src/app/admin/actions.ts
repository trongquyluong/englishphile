"use server";

import type { ContentStatus, Difficulty, QuestionType, SkillType, SourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveProblem,
  bulkUpdateProblemStatus,
  markProblemNeedsReview,
  publishProblem,
  restoreProblemDraft,
  updateProblemWithQuestions,
  type ProblemEditPayload,
} from "@/lib/admin/problems";
import { parseJsonField, type QuestionEditPayload } from "@/lib/admin/questions";
import { updateSourceCollection } from "@/lib/admin/sources";
import { updateTopic } from "@/lib/admin/topics";
import { requireAdmin } from "@/lib/auth/session";
import { contentStatusOrder, difficultyOrder, skillOrder } from "@/lib/labels";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length ? value : null;
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redirectBack(path: string, result: { ok: boolean; message: string }): never {
  const key = result.ok ? "message" : "error";
  redirect(`${path}?${key}=${encodeURIComponent(result.message)}`);
}

function parseContentStatus(value: string): ContentStatus {
  return contentStatusOrder.includes(value as ContentStatus) ? (value as ContentStatus) : "DRAFT";
}

function parseQuestionType(value: string): QuestionType {
  return value as QuestionType;
}

function parseSkillType(value: string): SkillType {
  return skillOrder.includes(value as SkillType) ? (value as SkillType) : "MULTIPLE_CHOICE";
}

function parseDifficulty(value: string): Difficulty {
  return difficultyOrder.includes(value as Difficulty) ? (value as Difficulty) : "B2";
}

export async function updateProblemWithQuestionsAction(formData: FormData) {
  const user = await requireAdmin();
  const problemId = text(formData, "problemId");
  const returnTo = `/admin/problems/${problemId}/edit`;

  const problemPayload: ProblemEditPayload = {
    id: problemId,
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    statement: text(formData, "statement"),
    instructions: nullableText(formData, "instructions"),
    skillType: parseSkillType(text(formData, "skillType")),
    questionType: parseQuestionType(text(formData, "questionType")),
    difficulty: parseDifficulty(text(formData, "difficulty")),
    estimatedMinutes: numberOrNull(formData, "estimatedMinutes"),
    sourceCollectionId: nullableText(formData, "sourceCollectionId"),
    topicTags: text(formData, "topicTags")
      .split(",")
      .map((topic) => topic.trim())
      .filter(Boolean),
    contentStatus: parseContentStatus(text(formData, "contentStatus")),
  };

  const questionIds = formData.getAll("questionId").map((value) => String(value));
  const questionPayloads: QuestionEditPayload[] = [];

  for (const questionId of questionIds) {
    const options = parseJsonField(text(formData, `question_${questionId}_options`), "JSON options không hợp lệ.");
    if (!options.ok) redirectBack(returnTo, { ok: false, message: options.message });
    const answer = parseJsonField(text(formData, `question_${questionId}_answer`), "JSON đáp án không hợp lệ.");
    if (!answer.ok) redirectBack(returnTo, { ok: false, message: answer.message });
    const metadata = parseJsonField(text(formData, `question_${questionId}_metadata`), "JSON metadata không hợp lệ.");
    if (!metadata.ok) redirectBack(returnTo, { ok: false, message: metadata.message });

    questionPayloads.push({
      id: questionId,
      type: parseQuestionType(text(formData, `question_${questionId}_type`)),
      skillType: parseSkillType(text(formData, `question_${questionId}_skillType`)),
      difficulty: parseDifficulty(text(formData, `question_${questionId}_difficulty`)),
      prompt: text(formData, `question_${questionId}_prompt`),
      passage: nullableText(formData, `question_${questionId}_passage`),
      options: options.value,
      answer: answer.value ?? {},
      explanation: nullableText(formData, `question_${questionId}_explanation`),
      rootWord: nullableText(formData, `question_${questionId}_rootWord`),
      keyword: nullableText(formData, `question_${questionId}_keyword`),
      targetSentence: nullableText(formData, `question_${questionId}_targetSentence`),
      lineNumber: numberOrNull(formData, `question_${questionId}_lineNumber`),
      metadata: metadata.value,
      orderIndex: Number(text(formData, `question_${questionId}_orderIndex`) || 0),
      contentStatus: parseContentStatus(text(formData, `question_${questionId}_contentStatus`)),
    });
  }

  const result = await updateProblemWithQuestions(problemPayload, questionPayloads, user.id);
  revalidatePath("/admin/problems");
  revalidatePath(`/admin/problems/${problemId}`);
  revalidatePath(`/admin/problems/${problemId}/edit`);
  revalidatePath("/admin/review");
  revalidatePath("/problems");
  redirectBack(result.ok ? `/admin/problems/${problemId}` : returnTo, result);
}

export async function problemStatusAction(formData: FormData) {
  const user = await requireAdmin();
  const problemId = text(formData, "problemId");
  const intent = text(formData, "intent");
  const requestedReturnTo = text(formData, "returnTo");
  const returnTo = /^\/admin(?:\/|$)/.test(requestedReturnTo) ? requestedReturnTo : `/admin/problems/${problemId}`;
  const result =
    intent === "publish"
      ? await publishProblem(problemId, user.id)
      : intent === "archive"
        ? await archiveProblem(problemId, user.id)
        : intent === "needs-review"
          ? await markProblemNeedsReview(problemId, user.id)
          : await restoreProblemDraft(problemId, user.id);

  revalidatePath("/admin/problems");
  revalidatePath("/admin/review");
  revalidatePath("/problems");
  redirectBack(returnTo, result);
}

export async function bulkProblemStatusAction(formData: FormData) {
  const user = await requireAdmin();
  const problemIds = formData.getAll("problemId").map((value) => String(value));
  const status = parseContentStatus(text(formData, "bulkStatus"));
  const result = await bulkUpdateProblemStatus(problemIds, status, user.id);
  revalidatePath("/admin/problems");
  revalidatePath("/admin/review");
  revalidatePath("/problems");
  redirectBack("/admin/problems", result);
}

export async function updateSourceCollectionAction(formData: FormData) {
  const user = await requireAdmin();
  const sourceId = text(formData, "sourceId");
  const result = await updateSourceCollection(
    {
      id: sourceId,
      name: text(formData, "name"),
      description: text(formData, "description"),
      originalFileName: nullableText(formData, "originalFileName"),
      sourceType: text(formData, "sourceType") as SourceType,
      copyrightNote: nullableText(formData, "copyrightNote"),
    },
    user.id,
  );
  revalidatePath("/admin/sources");
  revalidatePath(`/admin/sources/${sourceId}`);
  redirectBack(`/admin/sources/${sourceId}`, result);
}

export async function updateTopicAction(formData: FormData) {
  const user = await requireAdmin();
  const topicId = text(formData, "topicId");
  const result = await updateTopic(
    {
      id: topicId,
      name: text(formData, "name"),
      slug: text(formData, "slug"),
      description: nullableText(formData, "description"),
      parentId: nullableText(formData, "parentId"),
    },
    user.id,
  );
  revalidatePath("/admin/topics");
  revalidatePath(`/admin/topics/${topicId}`);
  revalidatePath("/problems");
  redirectBack(`/admin/topics/${topicId}`, result);
}
