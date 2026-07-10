import type { AssignmentSubmissionStatus, SubmissionMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { checkQuestionAnswer, getProblemStatusFromSubmission, getSubmissionStatus } from "@/lib/answer-checking";
import { getCurrentUser } from "@/lib/auth/session";
import { canSubmitAssignment } from "@/lib/classroom/permissions";
import { prisma } from "@/lib/prisma";
import type { AssignmentSubmissionResultDTO } from "@/lib/dto/submission";
import { toQuestionResult } from "@/lib/dto/submission";

type RouteProps = {
  params: Promise<{ id: string }>;
};

type AssignmentAnswerBody = {
  answers?: Record<string, Record<string, unknown>>;
  startedAt?: string;
};

function toJson(value: unknown) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function secondsBetween(startedAt: Date | null, submittedAt: Date) {
  if (!startedAt) return null;
  return Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000));
}

export async function POST(request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để nộp bài." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as AssignmentAnswerBody;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      classroom: true,
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

  if (!assignment) {
    return NextResponse.json({ error: "Không tìm thấy bài giao." }, { status: 404 });
  }

  if (!(await canSubmitAssignment(user, assignment))) {
    return NextResponse.json({ error: "Bạn không có quyền làm bài này." }, { status: 403 });
  }

  const now = new Date();
  const isLate = Boolean(assignment.dueAt && assignment.dueAt < now);
  if (isLate && !assignment.allowLateSubmission) {
    return NextResponse.json({ error: "Đã quá hạn nộp bài." }, { status: 400 });
  }

  if (assignment.status === "CLOSED" || assignment.status === "ARCHIVED") {
    return NextResponse.json({ error: "Bài này đã đóng." }, { status: 400 });
  }

  const startedAt = body.startedAt ? new Date(body.startedAt) : now;
  const safeStartedAt = Number.isNaN(startedAt.getTime()) ? now : startedAt;
  const answersByProblem = body.answers ?? {};
  const mode: SubmissionMode = assignment.assignmentType === "MOCK_TEST" ? "MOCK_TEST" : "SINGLE_PROBLEM";

  const problemResults = assignment.problems.map((assignmentProblem) => {
    const problem = assignmentProblem.problem;
    const problemAnswers = answersByProblem[problem.id] ?? {};
    const results = problem.questions.map((question) => {
      const studentAnswer = problemAnswers[question.id] ?? "";
      const checked = checkQuestionAnswer(question, studentAnswer);
      return {
        question,
        studentAnswer,
        ...checked,
      };
    });
    const total = results.filter((result) => result.isCorrect !== null).length;
    const score = results.filter((result) => result.isCorrect === true).length;
    const status = getSubmissionStatus(results);

    return {
      assignmentProblem,
      problem,
      problemAnswers,
      results,
      total,
      score,
      status,
    };
  });

  const total = problemResults.reduce((sum, item) => sum + item.total, 0);
  const score = problemResults.reduce((sum, item) => sum + item.score, 0);
  const needsReview = problemResults.some((item) => item.status === "NEEDS_REVIEW");
  const assignmentStatus: AssignmentSubmissionStatus = isLate ? "LATE" : needsReview ? "NEEDS_REVIEW" : "SUBMITTED";

  const assignmentSubmission = await prisma.$transaction(async (tx) => {
    const existing = await tx.assignmentSubmission.findUnique({
      where: { assignmentId_userId: { assignmentId: assignment.id, userId: user.id } },
    });

    const savedAssignmentSubmission = await tx.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId: assignment.id, userId: user.id } },
      create: {
        assignmentId: assignment.id,
        userId: user.id,
        status: assignmentStatus,
        startedAt: safeStartedAt,
        submittedAt: now,
        score,
        total,
        timeSpentSeconds: secondsBetween(safeStartedAt, now),
        answers: toJson(answersByProblem),
        resultJson: toJson({
          problems: problemResults.map((item) => ({
            problemId: item.problem.id,
            score: item.score,
            total: item.total,
            status: item.status,
          })),
        }),
      },
      update: {
        status: assignmentStatus,
        submittedAt: now,
        score,
        total,
        timeSpentSeconds: secondsBetween(existing?.startedAt ?? safeStartedAt, now),
        answers: toJson(answersByProblem),
        resultJson: toJson({
          problems: problemResults.map((item) => ({
            problemId: item.problem.id,
            score: item.score,
            total: item.total,
            status: item.status,
          })),
        }),
      },
    });

    await tx.assignmentProblemSubmission.deleteMany({
      where: { assignmentSubmissionId: savedAssignmentSubmission.id },
    });

    for (const item of problemResults) {
      const submission = await tx.submission.create({
        data: {
          userId: user.id,
          problemId: item.problem.id,
          mode,
          status: item.status,
          score: item.score,
          total: item.total,
          answers: toJson(item.problemAnswers),
          submissionAnswers: {
            create: item.results.map((result) => ({
              questionId: result.question.id,
              studentAnswer: toJson(result.studentAnswer),
              isCorrect: result.isCorrect,
              feedback: result.feedback,
            })),
          },
        },
      });

      await tx.assignmentProblemSubmission.create({
        data: {
          assignmentSubmissionId: savedAssignmentSubmission.id,
          problemId: item.problem.id,
          submissionId: submission.id,
          score: item.score,
          total: item.total,
          status: item.status,
        },
      });

      const existingStatus = await tx.userProblemStatus.findUnique({
        where: { userId_problemId: { userId: user.id, problemId: item.problem.id } },
      });
      const bestScore = item.total > 0 ? item.score / item.total : null;
      await tx.userProblemStatus.upsert({
        where: { userId_problemId: { userId: user.id, problemId: item.problem.id } },
        create: {
          userId: user.id,
          problemId: item.problem.id,
          status: getProblemStatusFromSubmission(item.status),
          bestScore,
          attempts: 1,
          lastAttemptAt: now,
        },
        update: {
          status: getProblemStatusFromSubmission(item.status),
          bestScore:
            bestScore === null
              ? existingStatus?.bestScore
              : Math.max(existingStatus?.bestScore ?? 0, bestScore),
          attempts: { increment: 1 },
          lastAttemptAt: now,
        },
      });
    }

    return savedAssignmentSubmission;
  });

  // Build learner-safe response — correct answers are NOT sent to the client
  const response: AssignmentSubmissionResultDTO = {
    assignmentSubmissionId: assignmentSubmission.id,
    status: assignmentStatus,
    score,
    total,
    problems: problemResults.map((item) => ({
      problemId: item.problem.id,
      score: item.score,
      total: item.total,
      status: item.status,
      answers: item.results.map((result) =>
        toQuestionResult(result.question.id, result.isCorrect, result.feedback),
      ),
    })),
  };

  return NextResponse.json(response);
}
