import { NextResponse } from "next/server";
import { checkQuestionAnswer, getProblemStatusFromSubmission, getSubmissionStatus } from "@/lib/answer-checking";
import { getCurrentUser, isAdminUser } from "@/lib/auth/session";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { prisma } from "@/lib/prisma";
import { markRecommendationsCompletedForProblem } from "@/lib/recommendations";
import type { SubmissionResultDTO } from "@/lib/dto/submission";
import { toQuestionResult } from "@/lib/dto/submission";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

function toJson(value: unknown) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

export async function POST(request: Request) {
  // Validate request origin (CSRF protection for Route Handlers)
  const originCheck = await validateRequestOrigin();
  if (!originCheck.valid) {
    return NextResponse.json({ error: getOriginErrorMessage() }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkConfiguredRateLimit(RATE_LIMITS.SUBMISSION(user.id));
  if (limit.status === "infrastructure-error") {
    return NextResponse.json({ error: "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau." }, { status: 503 });
  }
  if (limit.status === "rate-limited") {
    return NextResponse.json({ error: "Bạn nộp bài quá nhanh. Vui lòng thử lại sau." }, { status: 429 });
  }

  const body = (await request.json()) as {
    problemId?: string;
    answers?: Record<string, unknown>;
  };

  if (!body.problemId) {
    return NextResponse.json({ error: "Missing problemId" }, { status: 400 });
  }

  const canManageContent = isAdminUser(user);
  const questions = await prisma.question.findMany({
    where: {
      problemId: body.problemId,
      ...(canManageContent ? {} : { contentStatus: "PUBLISHED", problem: { contentStatus: "PUBLISHED" } }),
    },
    orderBy: { orderIndex: "asc" },
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const results = questions.map((question) => {
    const studentAnswer = body.answers?.[question.id] ?? "";
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
  const bestScore = total > 0 ? score / total : null;

  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId: body.problemId,
      mode: "SINGLE_PROBLEM",
      status,
      score,
      total,
      answers: toJson(body.answers ?? {}),
      submissionAnswers: {
        create: results.map((result) => ({
          questionId: result.question.id,
          studentAnswer: toJson(result.studentAnswer),
          isCorrect: result.isCorrect,
          feedback: result.feedback,
        })),
      },
    },
  });

  const existingStatus = await prisma.userProblemStatus.findUnique({
    where: {
      userId_problemId: {
        userId: user.id,
        problemId: body.problemId,
      },
    },
  });

  await prisma.userProblemStatus.upsert({
    where: {
      userId_problemId: {
        userId: user.id,
        problemId: body.problemId,
      },
    },
    create: {
      userId: user.id,
      problemId: body.problemId,
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
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  await markRecommendationsCompletedForProblem(user.id, body.problemId);

  // Build learner-safe response — correct answers are NOT sent to the client
  const response: SubmissionResultDTO = {
    submissionId: submission.id,
    status,
    score,
    total,
    answers: results.map((result) =>
      toQuestionResult(result.question.id, result.isCorrect, result.feedback),
    ),
  };

  return NextResponse.json(response);
}
