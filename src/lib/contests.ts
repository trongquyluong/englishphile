import type { Contest, ContestAttemptStatus, ContestStatus, ContestType, ContestVisibility, Prisma } from "@prisma/client";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import { generateSlug } from "@/lib/import/duplicates";
import { prisma } from "@/lib/prisma";

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
  if (contest.status === "DRAFT" || contest.status === "ARCHIVED") {
    return { canStart: false, reason: "Contest chưa mở công khai." };
  }

  if (contest.contestType === "LIVE_CONTEST") {
    if (contest.startsAt && contest.startsAt > now) {
      return { canStart: false, reason: "Contest chưa đến giờ bắt đầu." };
    }
    if (contest.status === "ENDED" || (contest.endsAt && contest.endsAt < now)) {
      return { canStart: false, reason: "Contest đã kết thúc." };
    }
    return { canStart: true, reason: "Contest đang mở." };
  }

  if (contest.startsAt && contest.startsAt > now) {
    return { canStart: false, reason: "Contest chưa đến giờ mở." };
  }

  return { canStart: true, reason: contest.status === "ENDED" ? "Đề cũ vẫn có thể luyện lại." : "Có thể bắt đầu." };
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
    },
  });
}

export async function createContestAttempt(contest: Contest, userId: string) {
  const existing = await prisma.contestAttempt.findFirst({
    where: { contestId: contest.id, userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.contestAttempt.create({
    data: {
      contestId: contest.id,
      userId,
      status: "IN_PROGRESS",
    },
  });
}

export function scoreContest(contest: ContestWithProblems, answersByProblem: Record<string, Record<string, unknown>>) {
  let score = 0;
  let total = 0;
  const sections = new Map<string, { score: number; total: number; needsReview: number }>();

  const problems = contest.problems.map((contestProblem) => {
    const problemAnswers = answersByProblem[contestProblem.problemId] ?? {};
    const questionResults = contestProblem.problem.questions.map((question) => {
      const studentAnswer = problemAnswers[question.id] ?? "";
      const checked = checkQuestionAnswer(question, studentAnswer);
      if (!sections.has(contestProblem.section)) {
        sections.set(contestProblem.section, { score: 0, total: 0, needsReview: 0 });
      }
      const section = sections.get(contestProblem.section)!;
      if (checked.isCorrect === null) {
        section.needsReview += 1;
      } else {
        total += 1;
        section.total += 1;
        if (checked.isCorrect) {
          score += 1;
          section.score += 1;
        }
      }
      return {
        questionId: question.id,
        prompt: question.prompt,
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

  const needsReview = problems.some((problem) => problem.results.some((result) => result.isCorrect === null));
  const sectionBreakdown = [...sections.entries()].map(([section, data]) => ({ section, ...data }));
  return {
    score,
    total,
    status: (needsReview ? "NEEDS_REVIEW" : "SUBMITTED") as ContestAttemptStatus,
    answers: answersByProblem,
    problems,
    sectionBreakdown,
  };
}

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
  createdById?: string;
  problems: Array<{ problemId: string; section: string; orderIndex: number; points?: number | null }>;
}) {
  const slug = data.slug?.trim() || generateSlug(data.title);
  return prisma.contest.create({
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
      createdById: data.createdById,
      problems: {
        create: data.problems.map((problem, index) => ({
          problemId: problem.problemId,
          section: problem.section || "Use of English",
          orderIndex: problem.orderIndex ?? index,
          points: problem.points,
        })),
      },
    },
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
}) {
  const slug = data.slug?.trim() || generateSlug(data.title);
  return prisma.contest.update({
    where: { id: contestId },
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
}

export async function submitContestAttempt(contest: ContestWithProblems, attemptId: string, userId: string, answersByProblem: Record<string, Record<string, unknown>>) {
  const attempt = await prisma.contestAttempt.findFirst({ where: { id: attemptId, contestId: contest.id, userId } });
  if (!attempt) throw new Error("Không tìm thấy lượt làm contest.");
  if (attempt.status !== "IN_PROGRESS") throw new Error("Lượt làm này đã nộp.");
  const now = new Date();
  const scored = scoreContest(contest, answersByProblem);
  const overTimeLimit = Boolean(contest.durationMinutes && now.getTime() - attempt.startedAt.getTime() > contest.durationMinutes * 60 * 1000);
  const late = Boolean((contest.endsAt && contest.endsAt < now) || overTimeLimit);
  const status: ContestAttemptStatus = late ? "LATE" : scored.status;
  return prisma.contestAttempt.update({
    where: { id: attempt.id },
    data: {
      status,
      submittedAt: now,
      score: scored.score,
      total: scored.total,
      timeSpentSeconds: Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000)),
      answersJson: toJson(scored),
    },
  });
}
