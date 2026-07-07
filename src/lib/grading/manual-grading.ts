import { Prisma, type ManualGradeCorrectness, type Role, type SubmissionStatus } from "@prisma/client";
import { getProblemStatusFromSubmission } from "@/lib/answer-checking";
import { prisma } from "@/lib/prisma";
import { answerContribution } from "@/lib/analytics/shared";

type TeacherUser = {
  id: string;
  role: Role;
};

export type ManualGradingFilters = {
  classroomId?: string;
  assignmentId?: string;
  skillType?: string;
  studentId?: string;
  date?: string;
};

export type SaveManualGradePayload = {
  submissionAnswerId: string;
  gradedById: string;
  correctness: ManualGradeCorrectness;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
  rubricJson?: Prisma.InputJsonValue | null;
};

function linkedAssignment(answer: {
  submission: {
    assignmentProblemSubmissions: Array<{
      assignmentSubmission: {
        assignment: {
        id: string;
        title: string;
        createdById: string;
          classroomId: string | null;
          classroom: { teacherId: string } | null;
        };
      };
    }>;
  };
}) {
  return answer.submission.assignmentProblemSubmissions[0]?.assignmentSubmission.assignment ?? null;
}

function canTeacherAccessAnswer(user: TeacherUser, answer: Parameters<typeof linkedAssignment>[0]) {
  if (user.role === "ADMIN") return true;
  const assignment = linkedAssignment(answer);
  return Boolean(assignment && (assignment.createdById === user.id || assignment.classroom?.teacherId === user.id));
}

function toAnswerBoolean(correctness: ManualGradeCorrectness) {
  if (correctness === "CORRECT") return true;
  if (correctness === "INCORRECT") return false;
  return null;
}

function statusFromTotals(score: number, total: number, hasNeedsReview: boolean): SubmissionStatus {
  if (hasNeedsReview || total === 0) return "NEEDS_REVIEW";
  if (score >= total) return "ACCEPTED";
  if (score <= 0) return "WRONG_ANSWER";
  return "PARTIAL";
}

export async function getManualGradingQueue(user: TeacherUser, filters: ManualGradingFilters = {}) {
  const answers = await prisma.submissionAnswer.findMany({
    where: {
      manualGrade: null,
      OR: [
        { isCorrect: null },
        { submission: { status: "NEEDS_REVIEW" } },
        { question: { type: { in: ["WRITING_PROMPT", "SENTENCE_TRANSFORMATION"] } } },
      ],
    },
    include: {
      question: true,
      submission: {
        include: {
          user: true,
          problem: true,
          assignmentProblemSubmissions: {
            include: {
              assignmentSubmission: {
                include: {
                  assignment: {
                    include: { classroom: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return answers
    .filter((answer) => canTeacherAccessAnswer(user, answer))
    .filter((answer) => {
      const assignment = linkedAssignment(answer);
      if (filters.classroomId && assignment?.classroomId !== filters.classroomId) return false;
      if (filters.assignmentId && assignment?.id !== filters.assignmentId) return false;
      if (filters.skillType && answer.question.skillType !== filters.skillType) return false;
      if (filters.studentId && answer.submission.userId !== filters.studentId) return false;
      if (filters.date && answer.createdAt.toISOString().slice(0, 10) !== filters.date) return false;
      return true;
    })
    .map((answer) => {
      const assignment = linkedAssignment(answer);
      return {
        id: answer.id,
        student: answer.submission.user,
        problem: answer.submission.problem,
        question: answer.question,
        assignment,
        submittedAt: answer.createdAt,
        studentAnswer: answer.studentAnswer,
        feedback: answer.feedback,
      };
    });
}

export async function getSubmissionAnswerForGrading(submissionAnswerId: string, user: TeacherUser) {
  const answer = await prisma.submissionAnswer.findUnique({
    where: { id: submissionAnswerId },
    include: {
      manualGrade: true,
      question: true,
      submission: {
        include: {
          user: true,
          problem: { include: { problemTopics: { include: { topic: true } } } },
          assignmentProblemSubmissions: {
            include: {
              assignmentSubmission: {
                include: {
                  assignment: {
                    include: { classroom: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!answer) return null;
  if (!canTeacherAccessAnswer(user, answer)) return null;
  return answer;
}

async function recalculateSubmission(submissionId: string, tx: Prisma.TransactionClient) {
  const submission = await tx.submission.findUnique({
    where: { id: submissionId },
    include: { submissionAnswers: { include: { manualGrade: true } } },
  });
  if (!submission) return null;

  let score = 0;
  let total = 0;
  let hasNeedsReview = false;
  submission.submissionAnswers.forEach((answer) => {
    const contribution = answerContribution(answer);
    score += contribution.correct;
    total += contribution.attempted;
    if (contribution.needsReview > 0) hasNeedsReview = true;
  });
  const status = statusFromTotals(score, total, hasNeedsReview);

  await tx.submission.update({
    where: { id: submissionId },
    data: { score, total, status },
  });

  const existingStatus = await tx.userProblemStatus.findUnique({
    where: { userId_problemId: { userId: submission.userId, problemId: submission.problemId } },
  });
  const bestScore = total > 0 ? score / total : null;
  await tx.userProblemStatus.upsert({
    where: { userId_problemId: { userId: submission.userId, problemId: submission.problemId } },
    create: {
      userId: submission.userId,
      problemId: submission.problemId,
      status: getProblemStatusFromSubmission(status),
      bestScore,
      attempts: 1,
      lastAttemptAt: new Date(),
    },
    update: {
      status: getProblemStatusFromSubmission(status),
      bestScore:
        bestScore === null
          ? existingStatus?.bestScore
          : Math.max(existingStatus?.bestScore ?? 0, bestScore),
      lastAttemptAt: new Date(),
    },
  });

  return { submission, score, total, status };
}

async function recalculateAssignmentSubmission(assignmentSubmissionId: string, tx: Prisma.TransactionClient) {
  const assignmentSubmission = await tx.assignmentSubmission.findUnique({
    where: { id: assignmentSubmissionId },
    include: { problemSubmissions: true },
  });
  if (!assignmentSubmission) return;
  const score = assignmentSubmission.problemSubmissions.reduce((sum, item) => sum + (item.score ?? 0), 0);
  const total = assignmentSubmission.problemSubmissions.reduce((sum, item) => sum + (item.total ?? 0), 0);
  const hasNeedsReview = assignmentSubmission.problemSubmissions.some((item) => item.status === "NEEDS_REVIEW");
  await tx.assignmentSubmission.update({
    where: { id: assignmentSubmissionId },
    data: {
      score,
      total,
      status: hasNeedsReview ? "NEEDS_REVIEW" : assignmentSubmission.status === "LATE" ? "LATE" : "SUBMITTED",
      resultJson: {
        problems: assignmentSubmission.problemSubmissions.map((item) => ({
          problemId: item.problemId,
          score: item.score,
          total: item.total,
          status: item.status,
        })),
      },
    },
  });
}

export async function saveManualGrade(payload: SaveManualGradePayload) {
  return prisma.$transaction(async (tx) => {
    const answer = await tx.submissionAnswer.findUnique({
      where: { id: payload.submissionAnswerId },
      include: {
        submission: {
          include: {
            assignmentProblemSubmissions: true,
          },
        },
      },
    });
    if (!answer) throw new Error("Không tìm thấy câu trả lời cần chấm.");

    const normalizedScore =
      typeof payload.score === "number" && Number.isFinite(payload.score) ? Math.max(0, payload.score) : null;
    const normalizedMaxScore =
      typeof payload.maxScore === "number" && Number.isFinite(payload.maxScore) && payload.maxScore > 0
        ? payload.maxScore
        : normalizedScore === null
          ? null
          : 1;

    await tx.manualGrade.upsert({
      where: { submissionAnswerId: payload.submissionAnswerId },
      create: {
        submissionAnswerId: payload.submissionAnswerId,
        gradedById: payload.gradedById,
        correctness: payload.correctness,
        score: normalizedScore,
        maxScore: normalizedMaxScore,
        feedback: payload.feedback,
        rubricJson: payload.rubricJson ?? Prisma.JsonNull,
      },
      update: {
        gradedById: payload.gradedById,
        correctness: payload.correctness,
        score: normalizedScore,
        maxScore: normalizedMaxScore,
        feedback: payload.feedback,
        rubricJson: payload.rubricJson ?? Prisma.JsonNull,
      },
    });

    await tx.submissionAnswer.update({
      where: { id: payload.submissionAnswerId },
      data: {
        isCorrect: toAnswerBoolean(payload.correctness),
        feedback: payload.feedback,
      },
    });

    const recalculated = await recalculateSubmission(answer.submissionId, tx);
    for (const assignmentProblemSubmission of answer.submission.assignmentProblemSubmissions) {
      if (recalculated) {
        await tx.assignmentProblemSubmission.update({
          where: { id: assignmentProblemSubmission.id },
          data: { score: recalculated.score, total: recalculated.total, status: recalculated.status },
        });
      }
      await recalculateAssignmentSubmission(assignmentProblemSubmission.assignmentSubmissionId, tx);
    }

    return tx.manualGrade.findUnique({ where: { submissionAnswerId: payload.submissionAnswerId } });
  });
}
