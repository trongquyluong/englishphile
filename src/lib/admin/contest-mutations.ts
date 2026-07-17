import { Prisma, type ContestStatus, type QuestionType, type SkillType } from "@prisma/client";
import { ADMIN_RESOURCE_UNAVAILABLE, lockContestForAdminMutation } from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";
import { prisma } from "@/lib/prisma";

export type ContestSectionInput = {
  title: string;
  skillType: SkillType;
  orderIndex: number;
  instructions?: string | null;
  points?: number | null;
  audioUrl?: string | null;
  transcript?: string | null;
  passageText?: string | null;
};

export type ContestQuestionInput = {
  orderIndex: number;
  type: QuestionType;
  prompt?: string | null;
  optionsJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
  answerJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
  points?: number | null;
  explanation?: string | null;
  rootWord?: string | null;
};

export type ContestMutationResult<T = undefined> =
  | { ok: true; contestId: string; value?: T }
  | { ok: false; message: string };

async function withLockedContest<T>(
  contestId: string,
  userId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T | null>,
): Promise<ContestMutationResult<T>> {
  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const contest = await lockContestForAdminMutation(tx, contestId);
    if (!contest) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    const value = await operation(tx);
    if (value === null) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    return { ok: true, contestId: contest.id, value };
  });
}

export function createContestSection(contestId: string, input: ContestSectionInput, userId: string) {
  return withLockedContest(contestId, userId, (tx) => tx.contestSection.create({ data: { contestId, ...input } }));
}

export function createContestSectionWithQuestions(
  contestId: string,
  input: ContestSectionInput,
  questions: Array<Omit<ContestQuestionInput, "optionsJson" | "answerJson">>,
  userId: string,
) {
  return withLockedContest(contestId, userId, async (tx) => {
    const section = await tx.contestSection.create({ data: { contestId, ...input } });
    if (questions.length) {
      await tx.contestQuestion.createMany({
        data: questions.map((question) => ({ sectionId: section.id, ...question })),
      });
    }
    return section;
  });
}

export function updateContestSection(contestId: string, sectionId: string, input: ContestSectionInput, userId: string) {
  return withLockedContest(contestId, userId, async (tx) => {
    const result = await tx.contestSection.updateMany({ where: { id: sectionId, contestId }, data: input });
    return result.count === 1 ? result : null;
  });
}

export function deleteContestSection(contestId: string, sectionId: string, userId: string) {
  return withLockedContest(contestId, userId, async (tx) => {
    const result = await tx.contestSection.deleteMany({ where: { id: sectionId, contestId } });
    return result.count === 1 ? result : null;
  });
}

export function createContestQuestion(contestId: string, sectionId: string, input: ContestQuestionInput, userId: string) {
  return withLockedContest(contestId, userId, async (tx) => {
    const section = await tx.contestSection.findFirst({ where: { id: sectionId, contestId }, select: { id: true } });
    if (!section) return null;
    return tx.contestQuestion.create({ data: { sectionId: section.id, ...input } });
  });
}

export function updateContestQuestion(contestId: string, questionId: string, input: ContestQuestionInput, userId: string) {
  return withLockedContest(contestId, userId, async (tx) => {
    const result = await tx.contestQuestion.updateMany({
      where: { id: questionId, section: { contestId } },
      data: input,
    });
    return result.count === 1 ? result : null;
  });
}

export function deleteContestQuestion(contestId: string, questionId: string, userId: string) {
  return withLockedContest(contestId, userId, async (tx) => {
    const result = await tx.contestQuestion.deleteMany({ where: { id: questionId, section: { contestId } } });
    return result.count === 1 ? result : null;
  });
}

export type ContestForPublish = Prisma.ContestGetPayload<{
  include: { sections: { include: { questions: true } } };
}>;

export type ContestValidationError = { field: string; message: string };

export function getContestPublishErrors(contest: ContestForPublish, now = new Date()): ContestValidationError[] {
  const errors: ContestValidationError[] = [];
  if (!contest.title.trim()) errors.push({ field: "title", message: "Tiêu đề contest không được để trống." });
  if (!contest.sections.length) errors.push({ field: "sections", message: "Contest cần có ít nhất một section." });
  if (contest.durationMinutes !== null && contest.durationMinutes !== undefined && contest.durationMinutes <= 0) {
    errors.push({ field: "durationMinutes", message: "Thời lượng contest phải lớn hơn 0." });
  }
  if (contest.startsAt && contest.endsAt && contest.endsAt <= contest.startsAt) {
    errors.push({ field: "endsAt", message: "Thời gian kết thúc phải sau thời gian bắt đầu." });
  } else if (contest.endsAt && contest.endsAt <= now) {
    errors.push({ field: "endsAt", message: "Không thể xuất bản contest đã kết thúc." });
  }

  for (const section of contest.sections) {
    const sectionErrors: string[] = [];
    if (section.skillType === "LISTENING" && !section.audioUrl?.trim()) {
      sectionErrors.push("Listening section cần có đường dẫn audio (audioUrl).");
    }
    if (section.questions.length === 0 && section.skillType !== "WRITING") {
      sectionErrors.push(`Section "${section.title}" cần có ít nhất một câu hỏi.`);
    }
    for (let index = 0; index < section.questions.length; index += 1) {
      const question = section.questions[index];
      if (!question.prompt?.trim()) sectionErrors.push(`Câu hỏi ${index + 1} trong "${section.title}" chưa có nội dung (prompt).`);
      if (["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ"].includes(question.type) && !question.optionsJson) {
        sectionErrors.push(`Câu hỏi ${index + 1} trong "${section.title}" là trắc nghiệm nhưng chưa có options.`);
      }
      if (["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ", "SHORT_ANSWER", "OPEN_CLOZE", "WORD_FORMATION", "LISTENING_SHORT_ANSWER"].includes(question.type) && !question.answerJson) {
        sectionErrors.push(`Câu hỏi ${index + 1} trong "${section.title}" chưa có đáp án đúng.`);
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

export async function publishContestAtomically(contestId: string, userId: string, now = new Date()) {
  return prisma.$transaction(async (tx): Promise<
    | { ok: true; contestId: string; status: Extract<ContestStatus, "SCHEDULED" | "LIVE"> }
    | { ok: false; message: string; validationErrors?: ContestValidationError[] }
  > => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockContestForAdminMutation(tx, contestId);
    if (!locked) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    const contest = await tx.contest.findUnique({
      where: { id: locked.id },
      include: { sections: { include: { questions: true }, orderBy: { orderIndex: "asc" } } },
    });
    if (!contest) return { ok: false, message: ADMIN_RESOURCE_UNAVAILABLE };
    const validationErrors = getContestPublishErrors(contest, now);
    if (validationErrors.length) {
      return { ok: false, message: "Contest chưa đủ điều kiện xuất bản.", validationErrors };
    }
    const status = contest.startsAt && contest.startsAt > now ? "SCHEDULED" : "LIVE";
    await tx.contest.update({ where: { id: locked.id }, data: { status } });
    return { ok: true, contestId: locked.id, status };
  });
}

export function archiveContestAtomically(contestId: string, userId: string) {
  return withLockedContest(contestId, userId, (tx) => tx.contest.update({ where: { id: contestId }, data: { status: "ARCHIVED" } }));
}
