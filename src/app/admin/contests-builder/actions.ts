"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ContestVisibility, QuestionType, SkillType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";
import {
  archiveContestAtomically,
  createContestQuestion,
  createContestSection,
  createContestSectionWithQuestions,
  deleteContestQuestion,
  deleteContestSection,
  getContestPublishErrors,
  publishContestAtomically,
  updateContestQuestion,
  updateContestSection,
} from "@/lib/admin/contest-mutations";
import { ADMIN_RESOURCE_UNAVAILABLE, lockContestForAdminMutation } from "@/lib/admin/mutation-locks";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/import/duplicates";
import type { ParsedContest } from "@/lib/import/excel-contest-parser";
import {
  MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS,
  parseContestSectionPlaceholderCount,
} from "@/lib/admin/contest-section-placeholders";

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

async function ensureUniqueSlug(
  base: string,
  excludeContestId?: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  let slug = base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const existing = await db.contest.findFirst({
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

  // ========================================================================
  // INDEPENDENT SERVER-SIDE VALIDATION — do NOT trust client preview data
  // ========================================================================

  // Validate info fields
  if (!info || typeof info !== "object") {
    return { ok: false, error: "Dữ liệu contest không hợp lệ." };
  }
  if (!info.title || typeof info.title !== "string" || info.title.trim().length === 0) {
    return { ok: false, error: "Tiêu đề contest không được để trống." };
  }
  if (info.title.length > 200) {
    return { ok: false, error: "Tiêu đề contest quá dài (tối đa 200 ký tự)." };
  }

  // Validate visibility
  const VALID_VISIBILITY = ["PUBLIC", "PRIVATE", "UNLISTED"];
  if (!info.visibility || !VALID_VISIBILITY.includes(info.visibility)) {
    return { ok: false, error: "Visibility không hợp lệ." };
  }

  // Validate duration (only allow specific values)
  if (info.durationMinutes !== null) {
    const VALID_DURATIONS = [120, 150, 180];
    if (typeof info.durationMinutes !== "number" || !VALID_DURATIONS.includes(info.durationMinutes)) {
      return { ok: false, error: "durationMinutes phải là 120, 150 hoặc 180." };
    }
  }

  // Validate sections array
  if (!Array.isArray(sections)) {
    return { ok: false, error: "Sections phải là một mảng." };
  }
  if (sections.length === 0) {
    return { ok: false, error: "Contest cần có ít nhất một section." };
  }
  if (sections.length > 30) {
    return { ok: false, error: "Số section vượt giới hạn (tối đa 30)." };
  }

  // Validate questions array
  if (!Array.isArray(questions)) {
    return { ok: false, error: "Questions phải là một mảng." };
  }
  if (questions.length === 0) {
    return { ok: false, error: "Contest cần có ít nhất một câu hỏi." };
  }
  if (questions.length > 500) {
    return { ok: false, error: "Số câu hỏi vượt giới hạn (tối đa 500)." };
  }

  // Validate each section
  const sectionIds = new Set<string>();
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section || typeof section !== "object") {
      return { ok: false, error: `Section ${i + 1} không hợp lệ.` };
    }
    if (!section.sectionId || typeof section.sectionId !== "string") {
      return { ok: false, error: `Section ${i + 1} thiếu sectionId.` };
    }
    if (sectionIds.has(section.sectionId)) {
      return { ok: false, error: `Section ID "${section.sectionId}" bị trùng.` };
    }
    sectionIds.add(section.sectionId);

    // Validate section type
    const VALID_SECTION_TYPES = ["UOE_MCQ", "WORD_FORMATION", "OPEN_CLOZE", "GUIDED_CLOZE", "READING", "LISTENING", "WRITING"];
    const sectionType = section.sectionType?.toUpperCase?.() ?? "";
    if (!VALID_SECTION_TYPES.includes(sectionType)) {
      return { ok: false, error: `Section "${section.title || section.sectionId}" có section_type không hỗ trợ.` };
    }

    // Validate required fields
    if (!section.title || typeof section.title !== "string" || section.title.trim().length === 0) {
      return { ok: false, error: `Section ${i + 1} thiếu title.` };
    }
    if (typeof section.orderIndex !== "number" || !Number.isFinite(section.orderIndex)) {
      return { ok: false, error: `Section "${section.title}" có orderIndex không hợp lệ.` };
    }
    if (typeof section.totalPoints !== "number" || !Number.isFinite(section.totalPoints)) {
      return { ok: false, error: `Section "${section.title}" có totalPoints không hợp lệ.` };
    }

    // Validate cell text lengths
    if (section.title && section.title.length > 200) {
      return { ok: false, error: `Section "${section.title}" có tiêu đề quá dài.` };
    }
    if (section.instructions && section.instructions.length > 5000) {
      return { ok: false, error: `Section "${section.title}" có instructions quá dài.` };
    }
  }

  // Validate each question
  const questionIds = new Set<string>();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== "object") {
      return { ok: false, error: `Câu hỏi ${i + 1} không hợp lệ.` };
    }
    if (!q.questionId || typeof q.questionId !== "string") {
      return { ok: false, error: `Câu hỏi ${i + 1} thiếu questionId.` };
    }
    if (questionIds.has(q.questionId)) {
      return { ok: false, error: `Question ID "${q.questionId}" bị trùng.` };
    }
    questionIds.add(q.questionId);

    // Validate section reference
    if (!sectionIds.has(q.sectionId)) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có section_id không tồn tại.` };
    }

    // Validate question type
    const VALID_QUESTION_TYPES = ["MCQ", "SHORT_ANSWER", "WORD_FORMATION", "OPEN_CLOZE", "GUIDED_CLOZE", "LISTENING_SHORT_ANSWER", "WRITING", "LISTENING_MCQ", "READING_MCQ"];
    const qType = q.questionType?.toUpperCase?.() ?? "";
    if (!VALID_QUESTION_TYPES.includes(qType)) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có question_type không hỗ trợ.` };
    }

    // Validate required fields
    if (typeof q.orderIndex !== "number" || !Number.isFinite(q.orderIndex)) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có orderIndex không hợp lệ.` };
    }
    if (typeof q.points !== "number" || !Number.isFinite(q.points)) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có points không hợp lệ.` };
    }

    // Validate cell text lengths
    if (q.prompt && q.prompt.length > 20000) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có prompt quá dài.` };
    }
    if (q.optionA && q.optionA.length > 5000) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có optionA quá dài.` };
    }
    if (q.optionB && q.optionB.length > 5000) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có optionB quá dài.` };
    }
    if (q.optionC && q.optionC.length > 5000) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có optionC quá dài.` };
    }
    if (q.optionD && q.optionD.length > 5000) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có optionD quá dài.` };
    }
    if (q.explanation && q.explanation.length > 10000) {
      return { ok: false, error: `Câu hỏi "${q.questionId}" có explanation quá dài.` };
    }

    // MCQ validation: need options and correct answer
    const MCQ_TYPES = ["MCQ", "GUIDED_CLOZE", "LISTENING_MCQ", "READING_MCQ"];
    if (MCQ_TYPES.includes(qType)) {
      const hasOptions = [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean).length >= 2;
      if (!hasOptions) {
        return { ok: false, error: `Câu hỏi "${q.questionId}" là MCQ nhưng thiếu lựa chọn.` };
      }
      if (!q.correctAnswer || !["A", "B", "C", "D"].includes(q.correctAnswer.toUpperCase())) {
        return { ok: false, error: `Câu hỏi "${q.questionId}" là MCQ nhưng thiếu correctAnswer hợp lệ.` };
      }
    }

    // WORD_FORMATION validation: need root word
    if (qType === "WORD_FORMATION") {
      if (!q.rootWord || typeof q.rootWord !== "string" || q.rootWord.trim().length === 0) {
        return { ok: false, error: `Câu hỏi "${q.questionId}" là WORD_FORMATION nhưng thiếu rootWord.` };
      }
    }

    // Do NOT accept client-provided status — always force DRAFT
    // This is enforced by hardcoding status: "DRAFT" in the transaction below
  }

  // ========================================================================
  // END VALIDATION — proceed with import
  // ========================================================================

  // Build slug
  const baseSlug = info.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  // Parse dates
  const startsAt = info.startAt ? new Date(info.startAt) : null;
  const endsAt = info.endAt ? new Date(info.endAt) : null;

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

  // Use Prisma transaction to ensure atomicity
  // All-or-nothing: if any step fails, no partial contest is created
  const contest = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, user.id);
    const slug = await ensureUniqueSlug(baseSlug, undefined, tx);
    // Create contest as DRAFT
    // For private contests, set accessCodeUpdatedAt to invalidate any stale grants
    const isPrivate = info.visibility === "PRIVATE";
    const newContest = await tx.contest.create({
      data: {
        title: info.title,
        slug,
        description: info.description ?? null,
        contestType: "PRACTICE_CONTEST",
        status: "DRAFT",
        visibility: info.visibility,
        accessCode: isPrivate ? (info.accessCode ?? null) : null,
        // Set accessCodeUpdatedAt for private contests to invalidate any stale grants
        // This is defensive - there shouldn't be existing grants for new contests
        ...(isPrivate ? { accessCodeUpdatedAt: new Date() } : {}),
        durationMinutes: info.durationMinutes,
        startsAt: startsAt ?? null,
        endsAt: endsAt ?? null,
        createdById: user.id,
      },
    });

    // Create sections and questions
    for (const section of sections) {
      const skillType = SECTION_TYPE_MAP[section.sectionType.trim().toUpperCase()] ?? "USE_OF_ENGLISH";

      const sectionRecord = await tx.contestSection.create({
        data: {
          contestId: newContest.id,
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

      const questionRows = sectionQuestions.map((q) => {
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

        return {
          sectionId: sectionRecord.id,
          orderIndex: q.orderIndex,
          type: qType,
          prompt: q.prompt ?? null,
          optionsJson: optionsJson as Prisma.InputJsonValue | undefined,
          answerJson: answerJson as Prisma.InputJsonValue | undefined,
          points: q.points ?? 1,
          explanation: q.explanation ?? null,
          rootWord: q.rootWord ?? null,
        };
      });
      if (questionRows.length) {
        await tx.contestQuestion.createMany({ data: questionRows });
      }
    }

    return newContest;
  });

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

  const baseSlug = text(formData, "slug") || generateSlug(title);
  const visibility = parseVisibility(text(formData, "visibility"));
  const accessCode = visibility === "PRIVATE" ? nullableText(formData, "accessCode") : null;

  const contest = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, user.id);
    const slug = await ensureUniqueSlug(baseSlug, undefined, tx);
    return tx.contest.create({ data: {
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
    } });
  });

  revalidatePath("/admin/contests-builder");
  revalidatePath("/contests");
  redirect(`/admin/contests-builder/${contest.id}/edit?message=${encodeURIComponent("Đã tạo contest.")}`);
}

export async function updateContestMetaAction(formData: FormData) {
  const user = await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;
  const title = text(formData, "title");
  if (!title) redirectBack(returnTo, false, "Tiêu đề không được để trống.");

  const visibility = parseVisibility(text(formData, "visibility"));
  const newAccessCode = visibility === "PRIVATE" ? nullableText(formData, "accessCode") : null;

  const baseSlug = text(formData, "slug") || generateSlug(title);
  const updated = await prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, user.id);
    const contest = await lockContestForAdminMutation(tx, contestId);
    if (!contest) return false;
    const slug = await ensureUniqueSlug(baseSlug, contest.id, tx);
    await tx.contest.update({
      where: { id: contest.id },
      data: {
        title,
        slug,
        description: nullableText(formData, "description"),
        visibility,
        accessCode: newAccessCode,
        durationMinutes: numberOrNull(formData, "durationMinutes"),
        startsAt: dateOrNull(formData, "startsAt"),
        endsAt: dateOrNull(formData, "endsAt"),
        // This editor always submits both fields, so invalidate on every update.
        accessCodeUpdatedAt: new Date(),
      },
    });
    await tx.contestAccessGrant.deleteMany({ where: { contestId: contest.id } });
    return true;
  });
  if (!updated) redirectBack("/admin/contests-builder", false, ADMIN_RESOURCE_UNAVAILABLE);

  revalidatePath("/contests");
  revalidatePath(`/admin/contests-builder/${contestId}`);
  redirectBack(returnTo, true, "Đã cập nhật.");
}

export async function createSectionAction(formData: FormData) {
  const user = await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const result = await createContestSection(contestId, {
    title: text(formData, "title") || "Section mới",
    skillType: parseSkillType(text(formData, "skillType")),
    orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
    instructions: nullableText(formData, "instructions"),
    points: numberOrNull(formData, "points"),
    audioUrl: nullableText(formData, "audioUrl"),
    transcript: nullableText(formData, "transcript"),
    passageText: nullableText(formData, "passageText"),
  }, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function createSectionWithQuestionsAction(formData: FormData) {
  const user = await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;
  const skillType = parseSkillType(text(formData, "skillType"));
  const questionType = parseQuestionType(text(formData, "questionType"));
  const questionCount = parseContestSectionPlaceholderCount(formData.get("questionCount"));
  if (questionCount === null) {
    redirectBack(
      returnTo,
      false,
      `Số câu hỏi phải là số nguyên từ 0 đến ${MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS}.`,
    );
  }
  const totalPoints = numberOrNull(formData, "points");
  const pointsPerQuestion =
    questionCount > 0 && totalPoints && totalPoints > 0
      ? Math.round((totalPoints / questionCount) * 100) / 100
      : null;

  const result = await createContestSectionWithQuestions(
    contestId,
    { title: text(formData, "title") || "Phần thi mới", skillType, orderIndex: numberOrNull(formData, "orderIndex") ?? 0, points: totalPoints },
    Array.from({ length: questionCount }, (_, index) => ({ orderIndex: index, type: questionType, points: pointsPerQuestion })),
    user.id,
  );
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

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
  const user = await requireAdmin();
  const sectionId = text(formData, "sectionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const result = await updateContestSection(contestId, sectionId, {
    title: text(formData, "title") || "Section không tiêu đề",
    skillType: parseSkillType(text(formData, "skillType")),
    orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
    instructions: nullableText(formData, "instructions"),
    points: numberOrNull(formData, "points"),
    audioUrl: nullableText(formData, "audioUrl"),
    transcript: nullableText(formData, "transcript"),
    passageText: nullableText(formData, "passageText"),
  }, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteSectionAction(formData: FormData) {
  const user = await requireAdmin();
  const sectionId = text(formData, "sectionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const result = await deleteContestSection(contestId, sectionId, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function createQuestionAction(formData: FormData) {
  const user = await requireAdmin();
  const sectionId = text(formData, "sectionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const type = parseQuestionType(text(formData, "type"));
  const result = await createContestQuestion(contestId, sectionId, {
    orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
    type,
    prompt: nullableText(formData, "prompt"),
    optionsJson: parseOptionsInput(formData) ?? Prisma.DbNull,
    answerJson: parseAnswerInput(formData, type) ?? Prisma.DbNull,
    points: numberOrNull(formData, "points"),
    explanation: nullableText(formData, "explanation"),
    rootWord: nullableText(formData, "rootWord"),
  }, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

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
  const user = await requireAdmin();
  const questionId = text(formData, "questionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const type = parseQuestionType(text(formData, "type"));
  const result = await updateContestQuestion(contestId, questionId, {
    orderIndex: numberOrNull(formData, "orderIndex") ?? 0,
    type,
    prompt: nullableText(formData, "prompt"),
    optionsJson: parseOptionsInput(formData) ?? Prisma.DbNull,
    answerJson: parseAnswerInput(formData, type) ?? Prisma.DbNull,
    points: numberOrNull(formData, "points"),
    explanation: nullableText(formData, "explanation"),
    rootWord: nullableText(formData, "rootWord"),
  }, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteQuestionAction(formData: FormData) {
  const user = await requireAdmin();
  const questionId = text(formData, "questionId");
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const result = await deleteContestQuestion(contestId, questionId, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

  revalidatePath(returnTo);
  redirect(returnTo);
}

// --- Validation for publish ---

export type ValidationError = {
  field: string;
  message: string;
};

export async function validateContestForPublish(contestId: string): Promise<ValidationError[]> {
  // Require admin authentication — unauthenticated callers get redirected
  // Note: callers should call requireAdmin() before this to avoid redirect throws
  await requireAdmin();

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
    return [{ field: "contest", message: ADMIN_RESOURCE_UNAVAILABLE }];
  }
  return getContestPublishErrors(contest);
}

export async function publishContestAction(formData: FormData) {
  const user = await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const result = await publishContestAtomically(contestId, user.id);
  if (!result.ok) {
    if (result.validationErrors?.length) {
      redirectBack(returnTo, false, `Chưa thể xuất bản: còn ${result.validationErrors.length} mục cần hoàn thiện.`);
    }
    redirectBack("/admin/contests-builder", false, result.message);
  }

  revalidatePath("/contests");
  revalidatePath(returnTo);
  redirectBack(
    returnTo,
    true,
    result.status === "SCHEDULED" ? "Đã xuất bản. Contest sẽ mở khi đến thời gian bắt đầu." : "Đã xuất bản contest.",
  );
}

export async function archiveContestAction(formData: FormData) {
  const user = await requireAdmin();
  const contestId = text(formData, "contestId");
  const returnTo = `/admin/contests-builder/${contestId}/edit`;

  const result = await archiveContestAtomically(contestId, user.id);
  if (!result.ok) redirectBack("/admin/contests-builder", false, result.message);

  revalidatePath("/contests");
  revalidatePath(returnTo);
  redirectBack(returnTo, true, "Đã lưu trữ contest.");
}
