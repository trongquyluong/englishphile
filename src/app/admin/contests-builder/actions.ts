"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ContestVisibility, QuestionType, SkillType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/import/duplicates";
import type { ParsedContest } from "@/lib/import/excel-contest-parser";

// --- Helpers (shared from existing actions.ts — duplicated here for the new import flow) ---

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

const MCQ_QUESTION_TYPES: QuestionType[] = ["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ", "PRONUNCIATION_ODD_ONE_OUT"];

function redirectBack(path: string, ok: boolean, message: string): never {
  redirect(`${path}?${ok ? "message" : "error"}=${encodeURIComponent(message)}`);
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

// ---------------------------------------------------------------------------
// Import contest from parsed Excel data
// ---------------------------------------------------------------------------

export type ImportResult =
  | { ok: true; contestId: string }
  | { ok: false; error: string };

export async function importContestFromParsedAction(
  data: ParsedContest,
): Promise<ImportResult> {
  const user = await requireAdmin();

  const { info, sections, questions } = data;

  // Build slug
  const baseSlug = info.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const slug = await ensureUniqueSlug(baseSlug);

  // Parse dates
  const startsAt = info.startAt ? new Date(info.startAt) : null;
  const endsAt = info.endAt ? new Date(info.endAt) : null;

  // Create contest
  const contest = await prisma.contest.create({
    data: {
      title: info.title,
      slug,
      description: info.description ?? null,
      contestType: "PRACTICE_CONTEST",
      status: "DRAFT",
      visibility: info.visibility,
      accessCode: info.visibility === "PRIVATE" ? (info.accessCode ?? null) : null,
      durationMinutes: info.durationMinutes,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      createdById: user.id,
    },
  });

  // Section type mapping (same as parser)
  const SECTION_TYPE_MAP: Record<string, SkillType> = {
    UOE_MCQ: "USE_OF_ENGLISH",
    WORD_FORMATION: "WORD_FORMATION",
    OPEN_CLOZE: "OPEN_CLOZE",
    GUIDED_CLOZE: "GUIDED_CLOZE",
    READING: "READING",
    LISTENING: "LISTENING",
    WRITING: "WRITING",
  };

  const QUESTION_TYPE_MAP: Record<string, QuestionType> = {
    MCQ: "MCQ",
    SHORT_ANSWER: "SHORT_ANSWER",
    WORD_FORMATION: "WORD_FORMATION",
    OPEN_CLOZE: "OPEN_CLOZE",
    GUIDED_CLOZE: "GUIDED_CLOZE",
    LISTENING_SHORT_ANSWER: "LISTENING_SHORT_ANSWER",
    WRITING: "WRITING_PROMPT",
    LISTENING_MCQ: "LISTENING_MCQ",
    READING_MCQ: "READING_MCQ",
  };

  // Create sections and questions
  for (const section of sections) {
    const skillType = SECTION_TYPE_MAP[section.sectionType.trim().toUpperCase()] ?? "USE_OF_ENGLISH";

    const sectionRecord = await prisma.contestSection.create({
      data: {
        contestId: contest.id,
        title: section.title,
        skillType,
        orderIndex: section.orderIndex,
        instructions: section.instructions ?? null,
        points: section.totalPoints,
        audioUrl: section.audioUrl ?? null,
        transcript: section.transcriptAdminOnly ?? null,
        passageText: section.passageText ?? null,
      },
    });

    // Get questions for this section
    const sectionQuestions = questions
      .filter((q) => q.sectionId === section.sectionId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    for (const q of sectionQuestions) {
      const qType = QUESTION_TYPE_MAP[q.questionType.trim().toUpperCase()] ?? "MCQ";
      const isMCQ = MCQ_QUESTION_TYPES.includes(qType);

      // Build optionsJson — Prisma JSON fields use undefined (not null) for absent values
      const hasOptions = isMCQ && (q.optionA || q.optionB || q.optionC || q.optionD);
      const optionsJson = hasOptions
        ? [
            ...(q.optionA ? [{ id: "A", text: q.optionA }] : []),
            ...(q.optionB ? [{ id: "B", text: q.optionB }] : []),
            ...(q.optionC ? [{ id: "C", text: q.optionC }] : []),
            ...(q.optionD ? [{ id: "D", text: q.optionD }] : []),
          ]
        : undefined;

      // Build answerJson
      const answerJson =
        isMCQ && q.correctAnswer
          ? { correctOptionId: q.correctAnswer.toUpperCase() }
          : (q.correctAnswer || q.acceptedAnswers)
            ? { acceptedAnswers: (q.acceptedAnswers ?? q.correctAnswer ?? "").split("|").map((a) => a.trim()).filter(Boolean) }
            : undefined;

      await prisma.contestQuestion.create({
        data: {
          sectionId: sectionRecord.id,
          orderIndex: q.orderIndex,
          type: qType,
          prompt: q.prompt ?? null,
          optionsJson: optionsJson as Prisma.InputJsonValue | undefined,
          answerJson: answerJson as Prisma.InputJsonValue | undefined,
          points: q.points ?? 1,
          explanation: q.explanation ?? null,
          rootWord: q.rootWord ?? null,
        },
      });
    }
  }

  revalidatePath("/admin/contests-builder");
  revalidatePath("/contests");

  return { ok: true, contestId: contest.id };
}

// ---------------------------------------------------------------------------
// Original actions preserved (create/update/delete/publish) — kept in this file
// to avoid splitting the existing actions.ts content.
// ---------------------------------------------------------------------------

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

function parseOptionsInput(formData: FormData, key = "optionsJson") {
  const raw = text(formData, key);
  if (!raw) return null;
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  const options = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separator = line.indexOf("|");
      if (separator === -1) return { id: String.fromCharCode(65 + (index % 26)), text: line };
      return {
        id: line.slice(0, separator).trim().toUpperCase() || String.fromCharCode(65 + (index % 26)),
        text: line.slice(separator + 1).trim(),
      };
    });
  return options.length ? options : null;
}

function parseAnswerInput(formData: FormData, type: QuestionType, key = "answerJson") {
  const raw = text(formData, key);
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through
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
  const nextStatus: "SCHEDULED" | "LIVE" = contest?.startsAt && contest.startsAt > new Date() ? "SCHEDULED" : "LIVE";

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
