"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ContestStatus, QuestionType, SkillType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/import/duplicates";

// --- Helpers ---

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseJson(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseStatus(value: string): ContestStatus {
  if (value === "DRAFT" || value === "SCHEDULED" || value === "LIVE" || value === "ENDED" || value === "ARCHIVED") return value;
  return "DRAFT";
}

function parseSkillType(value: string): SkillType {
  const valid: SkillType[] = [
    "USE_OF_ENGLISH", "PRONUNCIATION", "MULTIPLE_CHOICE", "OPEN_CLOZE", "GUIDED_CLOZE",
    "WORD_FORMATION", "SENTENCE_TRANSFORMATION", "ERROR_IDENTIFICATION",
    "READING", "WRITING", "LISTENING", "TRIOS", "COLLOCATIONS", "PHRASAL_VERBS", "TRANSITIONS", "GRAMMAR_FOCUS",
  ];
  if (valid.includes(value as SkillType)) return value as SkillType;
  return "USE_OF_ENGLISH";
}

function parseQuestionType(value: string): QuestionType {
  const valid: QuestionType[] = [
    "MCQ", "SHORT_ANSWER", "WORD_FORMATION", "OPEN_CLOZE", "GUIDED_CLOZE",
    "SENTENCE_TRANSFORMATION", "ERROR_IDENTIFICATION", "LISTENING_SHORT_ANSWER",
    "LISTENING_MCQ", "READING_MCQ", "WRITING_PROMPT", "TRIOS_GAPPED_SENTENCES", "PRONUNCIATION_ODD_ONE_OUT",
  ];
  if (valid.includes(value as QuestionType)) return value as QuestionType;
  return "MCQ";
}

function redirectBack(path: string, ok: boolean, message: string): never {
  redirect(`${path}?${ok ? "message" : "error"}=${encodeURIComponent(message)}`);
}

// --- Contest CRUD ---

export async function createContestAction(formData: FormData) {
  const user = await requireAdmin();
  const title = text(formData, "title");
  if (!title) redirectBack("/admin/contests-builder/new", false, "Tiêu đề không được để trống.");

  const slug = text(formData, "slug") || generateSlug(title);

  const contest = await prisma.contest.create({
    data: {
      title,
      slug,
      description: nullableText(formData, "description"),
      contestType: "PRACTICE_CONTEST",
      status: parseStatus(text(formData, "status")),
      visibility: "PUBLIC",
      durationMinutes: numberOrNull(formData, "durationMinutes"),
      startsAt: dateOrNull(formData, "startsAt"),
      endsAt: dateOrNull(formData, "endsAt"),
      createdById: user.id,
    },
  });

  revalidatePath("/admin/contests-builder");
  revalidatePath("/contests");
  redirect(`/admin/contests-builder/${contest.id}/edit?message=${encodeURIComponent("Đã tạo contest.")}`);
}

export async function updateContestMetaAction(formData: FormData) {
  await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;
  const title = text(formData, "title");
  if (!title) redirectBack(returnTo, false, "Tiêu đề không được để trống.");

  await prisma.contest.update({
    where: { id: contestId },
    data: {
      title,
      slug: text(formData, "slug") || generateSlug(title),
      description: nullableText(formData, "description"),
      status: parseStatus(text(formData, "status")),
      durationMinutes: numberOrNull(formData, "durationMinutes"),
      startsAt: dateOrNull(formData, "startsAt"),
      endsAt: dateOrNull(formData, "endsAt"),
    },
  });

  revalidatePath("/contests");
  revalidatePath(`/admin/contests-builder/${contestId}`);
  redirectBack(returnTo, true, "Đã cập nhật.");
}

// --- Sections ---

export async function createSectionAction(formData: FormData) {
  await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contestSection.create({
    data: {
      contestId,
      title: text(formData, "title") || "Section mới",
      skillType: parseSkillType(text(formData, "skillType")),
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      instructions: nullableText(formData, "instructions"),
      points: numberOrNull(formData, "points"),
      audioUrl: nullableText(formData, "audioUrl"),
      transcript: nullableText(formData, "transcript"),
      passageText: nullableText(formData, "passageText"),
    },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function updateSectionAction(formData: FormData) {
  await requireAdmin();
  const sectionId = text(formData, "sectionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contestSection.update({
    where: { id: sectionId },
    data: {
      title: text(formData, "title") || "Section không tiêu đề",
      skillType: parseSkillType(text(formData, "skillType")),
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      instructions: nullableText(formData, "instructions"),
      points: numberOrNull(formData, "points"),
      audioUrl: nullableText(formData, "audioUrl"),
      transcript: nullableText(formData, "transcript"),
      passageText: nullableText(formData, "passageText"),
    },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteSectionAction(formData: FormData) {
  await requireAdmin();
  const sectionId = text(formData, "sectionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contestSection.delete({ where: { id: sectionId } });

  revalidatePath(returnTo);
  redirect(returnTo);
}

// --- Questions ---

export async function createQuestionAction(formData: FormData) {
  await requireAdmin();
  const sectionId = text(formData, "sectionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contestQuestion.create({
    data: {
      sectionId,
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      type: parseQuestionType(text(formData, "type")),
      prompt: nullableText(formData, "prompt"),
      optionsJson: parseJson(formData, "optionsJson"),
      answerJson: parseJson(formData, "answerJson"),
      points: numberOrNull(formData, "points"),
      explanation: nullableText(formData, "explanation"),
      rootWord: nullableText(formData, "rootWord"),
    },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function updateQuestionAction(formData: FormData) {
  await requireAdmin();
  const questionId = text(formData, "questionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contestQuestion.update({
    where: { id: questionId },
    data: {
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      type: parseQuestionType(text(formData, "type")),
      prompt: nullableText(formData, "prompt"),
      optionsJson: parseJson(formData, "optionsJson"),
      answerJson: parseJson(formData, "answerJson"),
      points: numberOrNull(formData, "points"),
      explanation: nullableText(formData, "explanation"),
      rootWord: nullableText(formData, "rootWord"),
    },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteQuestionAction(formData: FormData) {
  await requireAdmin();
  const questionId = text(formData, "questionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contestQuestion.delete({ where: { id: questionId } });

  revalidatePath(returnTo);
  redirect(returnTo);
}

// --- Validation for publish ---

export type ValidationError = {
  field: string;
  message: string;
};

export async function validateContestForPublish(contestId: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      sections: {
        include: { questions: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!contest) {
    errors.push({ field: "contest", message: "Không tìm thấy contest." });
    return errors;
  }

  if (!contest.title.trim()) {
    errors.push({ field: "title", message: "Tiêu đề contest không được để trống." });
  }

  if (!contest.sections.length) {
    errors.push({ field: "sections", message: "Contest cần có ít nhất một section." });
  }

  for (const section of contest.sections) {
    const sectionErrors = [];
    if (section.skillType === "LISTENING" && !section.audioUrl?.trim()) {
      sectionErrors.push("Listening section cần có đường dẫn audio (audioUrl).");
    }
    if (section.questions.length === 0 && section.skillType !== "WRITING") {
      sectionErrors.push(`Section "${section.title}" cần có ít nhất một câu hỏi.`);
    }

    for (let i = 0; i < section.questions.length; i++) {
      const q = section.questions[i];
      if (!q.prompt?.trim()) {
        sectionErrors.push(`Câu hỏi ${i + 1} trong "${section.title}" chưa có nội dung (prompt).`);
      }
      if (["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ"].includes(q.type) && !q.optionsJson) {
        sectionErrors.push(`Câu hỏi ${i + 1} trong "${section.title}" là trắc nghiệm nhưng chưa có đáp án (options).`);
      }
      if (["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ", "SHORT_ANSWER", "OPEN_CLOZE", "WORD_FORMATION", "LISTENING_SHORT_ANSWER"].includes(q.type) && !q.answerJson) {
        sectionErrors.push(`Câu hỏi ${i + 1} trong "${section.title}" chưa có đáp án đúng (answerJson).`);
      }
    }

    if (sectionErrors.length) {
      errors.push({ field: `section:${section.id}`, message: sectionErrors.join(" ") });
    }
  }

  return errors;
}

export async function publishContestAction(formData: FormData) {
  await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const errors = await validateContestForPublish(contestId);
  if (errors.length) {
    const message = errors.map((e) => e.message).join(" ");
    redirectBack(returnTo, false, `Không thể xuất bản: ${message}`);
  }

  await prisma.contest.update({
    where: { id: contestId },
    data: { status: "LIVE" },
  });

  revalidatePath("/contests");
  revalidatePath(returnTo);
  redirectBack(returnTo, true, "Đã xuất bản contest.");
}

export async function archiveContestAction(formData: FormData) {
  await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  await prisma.contest.update({
    where: { id: contestId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/contests");
  revalidatePath(returnTo);
  redirectBack(returnTo, true, "Đã lưu trữ contest.");
}
