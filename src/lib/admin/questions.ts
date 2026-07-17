import { Prisma, type ContentStatus, type Difficulty, type QuestionType, type SkillType } from "@prisma/client";
import { questionTypeValues, skillTypeValues, difficultyValues } from "@/lib/import/types";
import { createContentAuditLog } from "@/lib/admin/audit";

export type AdminResult = {
  ok: boolean;
  message: string;
};

export type QuestionEditPayload = {
  id: string;
  type: QuestionType;
  skillType: SkillType;
  difficulty: Difficulty;
  prompt: string;
  passage?: string | null;
  options?: unknown;
  answer: unknown;
  explanation?: string | null;
  rootWord?: string | null;
  keyword?: string | null;
  targetSentence?: string | null;
  lineNumber?: number | null;
  metadata?: unknown;
  orderIndex: number;
  contentStatus: ContentStatus;
};

export function parseJsonField(text: string, errorMessage: string) {
  if (!text.trim()) return { ok: true as const, value: null };
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, message: errorMessage };
  }
}

function hasJsonValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim().length > 0;
}

export function questionPublishErrors(question: {
  type: QuestionType;
  prompt: string;
  options?: unknown;
  answer?: unknown;
}) {
  const errors: string[] = [];
  const needsOptions = ["MCQ", "GUIDED_CLOZE", "PRONUNCIATION_ODD_ONE_OUT", "READING_MCQ", "LISTENING_MCQ"].includes(question.type);
  const canUseRubric =
    question.type === "WRITING_PROMPT" &&
    hasJsonValue(question.answer) &&
    Boolean((question.answer as Record<string, unknown>)?.rubric);

  if (!question.prompt.trim()) {
    errors.push("Prompt không được để trống.");
  }

  if (!hasJsonValue(question.answer) && !canUseRubric) {
    errors.push("Không thể publish câu hỏi thiếu đáp án.");
  }

  if (needsOptions && !hasJsonValue(question.options)) {
    errors.push("Không thể publish MCQ/guided cloze thiếu options.");
  }

  return errors;
}

export function validateQuestionEditPayload(payload: QuestionEditPayload): AdminResult {
  if (!questionTypeValues.includes(payload.type)) return { ok: false, message: "Question type không hợp lệ." };
  if (!skillTypeValues.includes(payload.skillType)) return { ok: false, message: "Skill type không hợp lệ." };
  if (!difficultyValues.includes(payload.difficulty)) return { ok: false, message: "Độ khó không hợp lệ." };
  if (!payload.prompt.trim() && !payload.passage?.trim()) {
    return { ok: false, message: "Prompt không được để trống." };
  }
  if (payload.contentStatus === "PUBLISHED") {
    const errors = questionPublishErrors(payload);
    if (errors.length) return { ok: false, message: errors[0] };
  }
  return { ok: true, message: "OK" };
}

export async function updateQuestion(
  payload: QuestionEditPayload,
  problemId: string,
  userId: string,
  tx: Prisma.TransactionClient,
): Promise<AdminResult> {
  const validation = validateQuestionEditPayload(payload);
  if (!validation.ok) return validation;

  const before = await tx.question.findFirst({ where: { id: payload.id, problemId } });
  if (!before) return { ok: false, message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };

  const reviewedAt = payload.contentStatus === "PUBLISHED" ? new Date() : payload.contentStatus === "NEEDS_REVIEW" ? new Date() : null;

  const result = await tx.question.updateMany({
    where: { id: payload.id, problemId },
    data: {
      type: payload.type,
      skillType: payload.skillType,
      difficulty: payload.difficulty,
      prompt: payload.prompt.trim(),
      passage: payload.passage?.trim() || null,
      options: payload.options === undefined ? Prisma.JsonNull : JSON.parse(JSON.stringify(payload.options)),
      answer: JSON.parse(JSON.stringify(payload.answer ?? {})),
      explanation: payload.explanation?.trim() || null,
      rootWord: payload.rootWord?.trim() || null,
      keyword: payload.keyword?.trim() || null,
      targetSentence: payload.targetSentence?.trim() || null,
      lineNumber: payload.lineNumber,
      metadata: payload.metadata === undefined ? Prisma.JsonNull : JSON.parse(JSON.stringify(payload.metadata)),
      orderIndex: payload.orderIndex,
      contentStatus: payload.contentStatus,
      reviewedAt,
      reviewedById: reviewedAt ? userId : null,
    },
  });
  if (result.count !== 1) throw new Error("Scoped question update invariant failed after parent validation.");
  const updated = await tx.question.findUnique({ where: { id: payload.id } });
  if (!updated) throw new Error("Updated question disappeared inside the locked transaction.");

  await createContentAuditLog({
    userId,
    entityType: "Question",
    entityId: payload.id,
    action: "UPDATED",
    beforeJson: before,
    afterJson: updated,
  }, tx);

  return { ok: true, message: "Đã cập nhật câu hỏi." };
}
