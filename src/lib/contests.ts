import type { Contest, ContestAttemptStatus, ContestStatus, ContestType, ContestVisibility, Prisma } from "@prisma/client";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import { generateSlug } from "@/lib/import/duplicates";
import { prisma } from "@/lib/prisma";
import {
  evaluateLockedContestStart,
  getContestAvailabilityDecision,
  type LockedContestStartSnapshot,
} from "@/lib/security/contest-start-decision";
import { claimSingleWinner } from "@/lib/security/replay-guard";
import { lockContestForAdminMutation, shareLockPublishedProblems } from "@/lib/admin/mutation-locks";
import { requireContentAdminInTransaction } from "@/lib/auth/content-admin-transaction";

export type ContestWithProblems = Prisma.ContestGetPayload<{
  include: {
    problems: {
      include: {
        problem: {
          include: {
            questions: { orderBy: { orderIndex: "asc" } };
          };
        };
      };
    };
    sections: {
      include: {
        questions: { orderBy: { orderIndex: "asc" } };
      };
      orderBy: { orderIndex: "asc" };
    };
  };
}>;

function toJson(value: unknown) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

export function parseContestType(value: string): ContestType {
  if (value === "PAST_EXAM" || value === "LIVE_CONTEST" || value === "PRACTICE_CONTEST") return value;
  return "PRACTICE_CONTEST";
}

export function parseContestStatus(value: string): ContestStatus {
  if (value === "DRAFT" || value === "SCHEDULED" || value === "LIVE" || value === "ENDED" || value === "ARCHIVED") return value;
  return "DRAFT";
}

export function parseContestVisibility(value: string): ContestVisibility {
  if (value === "PUBLIC" || value === "PRIVATE" || value === "UNLISTED") return value;
  return "PUBLIC";
}

export type LegacyContestScheduleResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateLegacyContestSchedule(data: {
  status: ContestStatus;
  durationMinutes?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}, now = new Date()): LegacyContestScheduleResult {
  // Draft, archived, and ended records remain editable historical content;
  // active schedule constraints apply only when the submitted state is active.
  if (!["SCHEDULED", "LIVE"].includes(data.status)) return { ok: true };
  if (data.durationMinutes !== null && data.durationMinutes !== undefined && data.durationMinutes <= 0) {
    return { ok: false, message: "Thời lượng contest phải lớn hơn 0." };
  }
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    return { ok: false, message: "Thời gian kết thúc phải sau thời gian bắt đầu." };
  }
  if (data.endsAt && data.endsAt <= now) {
    return { ok: false, message: "Contest đã kết thúc nên không thể đặt ở trạng thái đang hoạt động." };
  }
  if (data.status === "SCHEDULED" && (!data.startsAt || data.startsAt <= now)) {
    return { ok: false, message: "Contest đã lên lịch cần thời gian bắt đầu trong tương lai." };
  }
  if (data.status === "LIVE" && data.startsAt && data.startsAt > now) {
    return { ok: false, message: "Contest chưa đến thời gian bắt đầu nên chưa thể đặt LIVE." };
  }
  return { ok: true };
}

export function getPublicContestWhere(now = new Date()): Prisma.ContestWhereInput {
  return {
    visibility: "PUBLIC",
    OR: [
      { status: { in: ["LIVE", "ENDED"] } },
      { status: "SCHEDULED", startsAt: { lte: now } },
      { contestType: "PAST_EXAM", status: { in: ["SCHEDULED", "LIVE", "ENDED"] } },
      { contestType: "PRACTICE_CONTEST", status: { in: ["SCHEDULED", "LIVE", "ENDED"] } },
    ],
  };
}

export function getContestAvailability(
  contest: Pick<Contest, "contestType" | "status" | "startsAt" | "endsAt">,
  now = new Date(),
) {
  return getContestAvailabilityDecision(contest, now);
}

export async function findContestByIdOrSlug(idOrSlug: string) {
  return prisma.contest.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      problems: {
        orderBy: { orderIndex: "asc" },
        include: {
          problem: {
            include: {
              questions: { orderBy: { orderIndex: "asc" } },
            },
          },
        },
      },
      sections: {
        include: {
          questions: { orderBy: { orderIndex: "asc" } },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
}

export async function createContestAttempt(
  contest: Pick<Contest, "id">,
  userId: string,
  access: { grantId?: string | null; bypassPrivateAccess?: boolean } = {},
) {
  const lockKey = `contest-attempt:${contest.id}:${userId}`;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ locked: string }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "locked"
    `;
    const lockedContests = await tx.$queryRaw<LockedContestStartSnapshot[]>`
      SELECT "id", "contestType", "status", "startsAt", "endsAt", "visibility", "accessCodeUpdatedAt"
      FROM "Contest"
      WHERE "id" = ${contest.id}
      FOR UPDATE
    `;
    const lockedContest = lockedContests[0];
    if (!lockedContest) {
      return { ok: false, message: "Không tìm thấy contest." } as const;
    }

    const [problemRows, sectionRows, grantRecord] = await Promise.all([
      tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "ContestProblem"
        WHERE "contestId" = ${lockedContest.id}
        LIMIT 1
        FOR SHARE
      `,
      tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "ContestSection"
        WHERE "contestId" = ${lockedContest.id}
        LIMIT 1
        FOR SHARE
      `,
      access.grantId
        ? tx.contestAccessGrant.findUnique({
            where: { id: access.grantId },
            select: { userId: true, contestId: true, expiresAt: true, createdAt: true },
          })
        : Promise.resolve(null),
    ]);

    const decision = evaluateLockedContestStart(lockedContest, {
      userId,
      now: new Date(),
      hasContent: problemRows.length > 0 || sectionRows.length > 0,
      bypassPrivateAccess: access.bypassPrivateAccess === true,
      grant: grantRecord
        ? {
            ...grantRecord,
            contest: {
              id: lockedContest.id,
              accessCodeUpdatedAt: lockedContest.accessCodeUpdatedAt,
            },
          }
        : null,
    });
    if (!decision.allowed) return { ok: false, message: decision.message } as const;

    const existing = await tx.contestAttempt.findFirst({
      where: { contestId: contest.id, userId, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    });
    if (existing) return { ok: true, attempt: existing } as const;

    const attempt = await tx.contestAttempt.create({
      data: {
        contestId: contest.id,
        userId,
        status: "IN_PROGRESS",
      },
    });
    return { ok: true, attempt } as const;
  });
}

export function scoreContest(
  contest: ContestWithProblems,
  answersByProblem: Record<string, Record<string, unknown>>,
  answersBySection: Record<string, Record<string, unknown>> = {},
) {
  let score = 0;
  let total = 0;
  const sectionScores = new Map<string, { score: number; total: number; needsReview: number }>();

  // Score problem-based questions
  const problems = contest.problems.map((contestProblem) => {
    const problemAnswers = answersByProblem[contestProblem.problemId] ?? {};
    const questionResults = contestProblem.problem.questions.map((question) => {
      const studentAnswer = problemAnswers[question.id] ?? "";
      const checked = checkQuestionAnswer(question, studentAnswer);
      if (!sectionScores.has(contestProblem.section)) {
        sectionScores.set(contestProblem.section, { score: 0, total: 0, needsReview: 0 });
      }
      const sec = sectionScores.get(contestProblem.section)!;
      if (checked.isCorrect === null) {
        sec.needsReview += 1;
      } else {
        total += 1;
        sec.total += 1;
        if (checked.isCorrect) {
          score += 1;
          sec.score += 1;
        }
      }
      return {
        questionId: question.id,
        type: question.type,
        prompt: question.prompt,
        rootWord: question.rootWord,
        studentAnswer,
        isCorrect: checked.isCorrect,
        feedback: checked.feedback,
        correctAnswer: checked.correctAnswer,
      };
    });
    return {
      contestProblemId: contestProblem.id,
      problemId: contestProblem.problemId,
      section: contestProblem.section,
      title: contestProblem.problem.title,
      results: questionResults,
    };
  });

  // Score section-based questions (standalone, not linked to Problem)
  const sectionResults = contest.sections.map((section) => {
    const sectionAnswers = answersBySection[section.id] ?? {};
    const questionResults = section.questions.map((question) => {
      // Cast answerJson to the shape checkQuestionAnswer expects
      const questionWithAnswer = {
        type: question.type,
        answer: question.answerJson as unknown,
        explanation: question.explanation,
      } as Parameters<typeof checkQuestionAnswer>[0];
      const studentAnswer = sectionAnswers[question.id] ?? "";
      const checked = checkQuestionAnswer(questionWithAnswer, studentAnswer);
      if (!sectionScores.has(section.title)) {
        sectionScores.set(section.title, { score: 0, total: 0, needsReview: 0 });
      }
      const sec = sectionScores.get(section.title)!;
      if (checked.isCorrect === null) {
        sec.needsReview += 1;
      } else {
        total += 1;
        sec.total += 1;
        if (checked.isCorrect) {
          score += 1;
          sec.score += 1;
        }
      }
      return {
        questionId: question.id,
        type: question.type,
        prompt: question.prompt,
        rootWord: question.rootWord,
        studentAnswer,
        isCorrect: checked.isCorrect,
        feedback: checked.feedback,
        correctAnswer: checked.correctAnswer,
      };
    });
    return {
      sectionId: section.id,
      sectionTitle: section.title,
      skillType: section.skillType,
      results: questionResults,
    };
  });

  const needsReview =
    problems.some((p) => p.results.some((r) => r.isCorrect === null)) ||
    sectionResults.some((s) => s.results.some((r) => r.isCorrect === null));
  const sectionBreakdown = [...sectionScores.entries()].map(([section, data]) => ({ section, ...data }));
  return {
    score,
    total,
    status: (needsReview ? "NEEDS_REVIEW" : "SUBMITTED") as ContestAttemptStatus,
    answers: answersByProblem,
    answersBySection,
    problems,
    sectionResults,
    sectionBreakdown,
  };
}

type LegacyContestMutationFailure = {
  ok: false;
  kind: "validation" | "unavailable";
  message: string;
};

export type LegacyContestMutationResult =
  | { ok: true; contest: Contest }
  | LegacyContestMutationFailure;

export async function createContest(data: {
  title: string;
  slug?: string;
  description?: string | null;
  contestType: ContestType;
  status: ContestStatus;
  visibility: ContestVisibility;
  durationMinutes?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  sourceName?: string | null;
  rules?: string | null;
  problems: Array<{ problemId: string; section: string; orderIndex: number; points?: number | null }>;
}, userId: string): Promise<LegacyContestMutationResult> {
  const slug = data.slug?.trim() || generateSlug(data.title);
  const schedule = validateLegacyContestSchedule(data);
  if (!schedule.ok) return { ok: false, kind: "validation", message: schedule.message };
  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const problemIds = data.problems.map((problem) => problem.problemId);
    const published = await shareLockPublishedProblems(tx, problemIds);
    if (published.length !== problemIds.length) {
      return { ok: false, kind: "unavailable", message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    }
    const contest = await tx.contest.create({ data: {
      title: data.title.trim(),
      slug,
      description: data.description || null,
      contestType: data.contestType,
      status: data.status,
      visibility: data.visibility,
      durationMinutes: data.durationMinutes,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      sourceName: data.sourceName || null,
      rules: data.rules || null,
      createdById: userId,
      problems: {
        create: data.problems.map((problem, index) => ({
          problemId: problem.problemId,
          section: problem.section || "Use of English",
          orderIndex: problem.orderIndex ?? index,
          points: problem.points,
        })),
      },
    } });
    return { ok: true, contest };
  });
}

export async function updateContest(contestId: string, data: {
  title: string;
  slug?: string;
  description?: string | null;
  contestType: ContestType;
  status: ContestStatus;
  visibility: ContestVisibility;
  durationMinutes?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  sourceName?: string | null;
  rules?: string | null;
  problems: Array<{ problemId: string; section: string; orderIndex: number; points?: number | null }>;
}, userId: string): Promise<LegacyContestMutationResult> {
  const slug = data.slug?.trim() || generateSlug(data.title);
  const schedule = validateLegacyContestSchedule(data);
  if (!schedule.ok) return { ok: false, kind: "validation", message: schedule.message };

  // This legacy editor always submits visibility. Invalidate grants on every
  // update so concurrent PRIVATE -> PUBLIC -> PRIVATE transitions cannot reuse
  // an earlier grant. The update and deletion share one transaction.
  return prisma.$transaction(async (tx) => {
    await requireContentAdminInTransaction(tx, userId);
    const locked = await lockContestForAdminMutation(tx, contestId);
    if (!locked) return { ok: false, kind: "unavailable", message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    const problemIds = data.problems.map((problem) => problem.problemId);
    const published = await shareLockPublishedProblems(tx, problemIds);
    if (published.length !== problemIds.length) {
      return { ok: false, kind: "unavailable", message: "Tài nguyên không tồn tại hoặc không còn khả dụng." };
    }
    const contest = await tx.contest.update({
      where: { id: locked.id },
      data: {
        title: data.title.trim(),
        slug,
        description: data.description || null,
        contestType: data.contestType,
        status: data.status,
        visibility: data.visibility,
        durationMinutes: data.durationMinutes,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        sourceName: data.sourceName || null,
        rules: data.rules || null,
        accessCodeUpdatedAt: new Date(),
        problems: {
          deleteMany: {},
          create: data.problems.map((problem, index) => ({
            problemId: problem.problemId,
            section: problem.section || "Use of English",
            orderIndex: problem.orderIndex ?? index,
            points: problem.points,
          })),
        },
      },
    });
    await tx.contestAccessGrant.deleteMany({ where: { contestId: locked.id } });
    return { ok: true, contest };
  });
}

export async function submitContestAttempt(
  contest: ContestWithProblems,
  attemptId: string,
  userId: string,
  answersByProblem: Record<string, Record<string, unknown>>,
  answersBySection: Record<string, Record<string, unknown>> = {},
) {
  // First validate attempt exists and belongs to user
  const attempt = await prisma.contestAttempt.findFirst({
    where: { id: attemptId, contestId: contest.id, userId },
  });
  if (!attempt) throw new Error("Không tìm thấy lượt làm contest.");
  if (attempt.status !== "IN_PROGRESS") throw new Error("Lượt làm này đã nộp.");

  const now = new Date();
  const scored = scoreContest(contest, answersByProblem, answersBySection);
  const overTimeLimit = Boolean(contest.durationMinutes && now.getTime() - attempt.startedAt.getTime() > contest.durationMinutes * 60 * 1000);
  const late = Boolean((contest.endsAt && contest.endsAt < now) || overTimeLimit);
  const status: ContestAttemptStatus = late ? "LATE" : scored.status;

  // Use conditional UPDATE to prevent race: only update if still IN_PROGRESS.
  // This ensures exactly one concurrent request wins.
  await claimSingleWinner(async () => {
    const updated = await prisma.contestAttempt.updateMany({
      where: {
        id: attemptId,
        contestId: contest.id,
        userId,
        status: "IN_PROGRESS",
      },
      data: {
        status,
        submittedAt: now,
        score: scored.score,
        total: scored.total,
        timeSpentSeconds: Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000)),
        answersJson: toJson(scored),
      },
    });
    return updated.count;
  }, "Lượt làm này đã nộp.");

  return prisma.contestAttempt.findUniqueOrThrow({ where: { id: attemptId } });
}
