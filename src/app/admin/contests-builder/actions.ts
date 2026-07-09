"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ContestStatus, ContestVisibility, QuestionType, SkillType } from "@prisma/client";
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

function parseVisibility(value: string): ContestVisibility {
  if (value === "PUBLIC" || value === "PRIVATE" || value === "UNLISTED") return value;
  return "PUBLIC";
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

const MCQ_QUESTION_TYPES: QuestionType[] = ["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ", "PRONUNCIATION_ODD_ONE_OUT"];

function optionIdForIndex(index: number) {
  return String.fromCharCode(65 + (index % 26));
}

// Accepts one option per line as "A|text" (or a raw JSON array) and normalizes to [{ id, text }].
function parseOptionsInput(formData: FormData, key = "optionsJson") {
  const raw = text(formData, key);
  if (!raw) return null;
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to line-based parsing
    }
  }
  const options = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separator = line.indexOf("|");
      if (separator === -1) return { id: optionIdForIndex(index), text: line };
      return {
        id: line.slice(0, separator).trim().toUpperCase() || optionIdForIndex(index),
        text: line.slice(separator + 1).trim(),
      };
    });
  return options.length ? options : null;
}

// Accepts plain-text answers ("A", "answer 1 / answer 2", "A|correction") or a raw JSON object,
// normalized to the shapes checkQuestionAnswer expects per question type.
function parseAnswerInput(formData: FormData, type: QuestionType, key = "answerJson") {
  const raw = text(formData, key);
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to plain-text parsing
    }
  }
  if (MCQ_QUESTION_TYPES.includes(type)) {
    return { correctOptionId: raw.toUpperCase() };
  }
  if (type === "ERROR_IDENTIFICATION") {
    const separator = raw.indexOf("|");
    if (separator === -1) return { correctPart: raw.toUpperCase() };
    return { correctPart: raw.slice(0, separator).trim().toUpperCase(), correction: raw.slice(separator + 1).trim() };
  }
  const acceptedAnswers = raw.split("/").map((item) => item.trim()).filter(Boolean);
  return acceptedAnswers.length ? { acceptedAnswers } : null;
}

async function ensureUniqueSlug(base: string, excludeContestId?: string) {
  let slug = base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const existing = await prisma.contest.findFirst({
      where: { slug, ...(excludeContestId ? { id: { not: excludeContestId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

// --- Contest CRUD ---

export async function createContestAction(formData: FormData) {
  const user = await requireAdmin();
  const title = text(formData, "title");
  if (!title) redirectBack("/admin/contests-builder/new", false, "Tiêu đề không được để trống.");

  const slug = await ensureUniqueSlug(text(formData, "slug") || generateSlug(title));
  const visibility = parseVisibility(text(formData, "visibility"));
  const accessCode = visibility === "PRIVATE" ? nullableText(formData, "accessCode") : null;

  const contest = await prisma.contest.create({
    data: {
      title,
      slug,
      description: nullableText(formData, "description"),
      contestType: "PRACTICE_CONTEST",
      status: "DRAFT",
      visibility,
      accessCode,
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

  const visibility = parseVisibility(text(formData, "visibility"));
  const accessCode = visibility === "PRIVATE" ? nullableText(formData, "accessCode") : null;

  // Status is managed only by publish/archive actions so saving the form never unpublishes a contest.
  await prisma.contest.update({
    where: { id: contestId },
    data: {
      title,
      slug: await ensureUniqueSlug(text(formData, "slug") || generateSlug(title), contestId),
      description: nullableText(formData, "description"),
      visibility,
      accessCode,
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

// Exam-entry flow: create a section plus N empty questions so the admin only has to fill in content.
export async function createSectionWithQuestionsAction(formData: FormData) {
  await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;
  const skillType = parseSkillType(text(formData, "skillType"));
  const questionType = parseQuestionType(text(formData, "questionType"));
  const questionCount = Math.min(100, Math.max(0, Math.round(numberOrNull(formData, "questionCount") ?? 0)));
  const totalPoints = numberOrNull(formData, "points");
  const pointsPerQuestion =
    questionCount > 0 && totalPoints && totalPoints > 0
      ? Math.round((totalPoints / questionCount) * 100) / 100
      : null;

  const section = await prisma.contestSection.create({
    data: {
      contestId,
      title: text(formData, "title") || "Phần thi mới",
      skillType,
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      points: totalPoints,
    },
  });

  if (questionCount > 0) {
    await prisma.contestQuestion.createMany({
      data: Array.from({ length: questionCount }, (_, index) => ({
        sectionId: section.id,
        orderIndex: index,
        type: questionType,
        points: pointsPerQuestion,
      })),
    });
  }

  revalidatePath(returnTo);
  redirectBack(
    returnTo,
    true,
    questionCount > 0
      ? `Đã thêm phần thi với ${questionCount} câu hỏi. Mở từng câu bên dưới để nhập nội dung.`
      : "Đã thêm phần thi. Thêm câu hỏi bên dưới để hoàn thiện.",
  );
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

  const type = parseQuestionType(text(formData, "type"));
  await prisma.contestQuestion.create({
    data: {
      sectionId,
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      type,
      prompt: nullableText(formData, "prompt"),
      optionsJson: parseOptionsInput(formData) ?? Prisma.DbNull,
      answerJson: parseAnswerInput(formData, type) ?? Prisma.DbNull,
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

  const type = parseQuestionType(text(formData, "type"));
  await prisma.contestQuestion.update({
    where: { id: questionId },
    data: {
      orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
      type,
      prompt: nullableText(formData, "prompt"),
      optionsJson: parseOptionsInput(formData) ?? Prisma.DbNull,
      answerJson: parseAnswerInput(formData, type) ?? Prisma.DbNull,
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
      const shown = sectionErrors.slice(0, 3);
      const hidden = sectionErrors.length - shown.length;
      errors.push({
        field: `section:${section.id}`,
        message: shown.join(" ") + (hidden > 0 ? ` (+${hidden} lỗi khác trong section này)` : ""),
      });
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
    redirectBack(returnTo, false, `Chưa thể xuất bản: còn ${errors.length} mục cần hoàn thiện (xem danh sách trong trang).`);
  }

  const contest = await prisma.contest.findUnique({ where: { id: contestId }, select: { startsAt: true } });
  const nextStatus: ContestStatus = contest?.startsAt && contest.startsAt > new Date() ? "SCHEDULED" : "LIVE";

  await prisma.contest.update({
    where: { id: contestId },
    data: { status: nextStatus },
  });

  revalidatePath("/contests");
  revalidatePath(returnTo);
  redirectBack(
    returnTo,
    true,
    nextStatus === "SCHEDULED" ? "Đã xuất bản. Contest sẽ mở khi đến thời gian bắt đầu." : "Đã xuất bản contest.",
  );
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
