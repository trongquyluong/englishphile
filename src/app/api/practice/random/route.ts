import { NextResponse } from "next/server";
import { checkQuestionAnswer, getProblemStatusFromSubmission, getSubmissionStatus } from "@/lib/answer-checking";
import { getCurrentUser } from "@/lib/auth/session";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { prisma } from "@/lib/prisma";
import { learnerFeedbackForCorrectness, toRandomPracticeResultDTO } from "@/lib/dto/submission";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  PracticeSubmissionInputError,
  MINIMIZED_SUBMISSION_ANSWERS,
  parseRandomPracticeSubmissionBody,
  readBoundedPracticeRequestBody,
  requireAnswerKeysBelongToQuestions,
  requireExactQuestionSet,
  requireSupportedQuestionAnswerShapes,
} from "@/lib/security/submission-input";

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

  const limit = await checkConfiguredRateLimit(RATE_LIMITS.RANDOM_PRACTICE(user.id));
  if (limit.status === "infrastructure-error") {
    return NextResponse.json({ error: "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau." }, { status: 503 });
  }
  if (limit.status === "rate-limited") {
    return NextResponse.json({ error: "Bạn nộp bài quá nhanh. Vui lòng thử lại sau." }, { status: 429 });
  }

  let body: ReturnType<typeof parseRandomPracticeSubmissionBody>;
  try {
    body = parseRandomPracticeSubmissionBody(await readBoundedPracticeRequestBody(request));
  } catch (error) {
    if (error instanceof PracticeSubmissionInputError) {
      return NextResponse.json({ error: "Dữ liệu bài làm không hợp lệ." }, { status: 400 });
    }
    throw error;
  }

  const questionIds = body.questionIds;
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, contentStatus: "PUBLISHED", problem: { contentStatus: "PUBLISHED" } },
    orderBy: { orderIndex: "asc" },
  });

  try {
    requireExactQuestionSet(questionIds, questions.map((question) => question.id));
    requireAnswerKeysBelongToQuestions(body.answers, questionIds);
    requireSupportedQuestionAnswerShapes(body.answers, questions);
  } catch (error) {
    if (error instanceof PracticeSubmissionInputError) {
      return NextResponse.json({ error: "Dữ liệu bài làm không hợp lệ." }, { status: 400 });
    }
    throw error;
  }

  const results = questions.map((question) => {
    const studentAnswer = body.answers?.[question.id] ?? "";
    const checked = checkQuestionAnswer(question, studentAnswer);
    return { question, studentAnswer, ...checked };
  });

  const groups = new Map<string, typeof results>();
  for (const result of results) {
    const group = groups.get(result.question.problemId) ?? [];
    group.push(result);
    groups.set(result.question.problemId, group);
  }

  await prisma.$transaction(async (tx) => {
    for (const [problemId, group] of groups) {
      const total = group.filter((result) => result.isCorrect !== null).length;
      const score = group.filter((result) => result.isCorrect === true).length;
      const status = getSubmissionStatus(group);
      const bestScore = total > 0 ? score / total : null;

      await tx.submission.create({
        data: {
          userId: user.id,
          problemId,
          mode: "RANDOM_PRACTICE",
          status,
          score,
          total,
          answers: toJson(MINIMIZED_SUBMISSION_ANSWERS),
          submissionAnswers: {
            create: group.map((result) => ({
              questionId: result.question.id,
              studentAnswer: toJson(result.studentAnswer),
              isCorrect: result.isCorrect,
              feedback: learnerFeedbackForCorrectness(result.isCorrect),
            })),
          },
        },
      });

      const existing = await tx.userProblemStatus.findUnique({
        where: { userId_problemId: { userId: user.id, problemId } },
      });
      await tx.userProblemStatus.upsert({
        where: { userId_problemId: { userId: user.id, problemId } },
        create: {
          userId: user.id,
          problemId,
          status: getProblemStatusFromSubmission(status),
          bestScore,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
        update: {
          status: getProblemStatusFromSubmission(status),
          bestScore: bestScore === null ? existing?.bestScore : Math.max(existing?.bestScore ?? 0, bestScore),
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
    }
  });

  const total = results.filter((result) => result.isCorrect !== null).length;
  const score = results.filter((result) => result.isCorrect === true).length;

  // Build learner-safe response — correct answers are NOT sent to the client
  const response = toRandomPracticeResultDTO({
    status: getSubmissionStatus(results),
    score,
    total,
    answers: results.map((result) => ({
      questionId: result.question.id,
      isCorrect: result.isCorrect,
    })),
  });

  return NextResponse.json(response);
}
