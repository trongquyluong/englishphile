import type { SkillType } from "@prisma/client";
import { summarizeCorrectAnswer } from "@/lib/answer-checking";
import { difficultyOrder, skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { addAnswer, emptyBucket, finalizeBucket, percent, recommendedAction, skillDisplayName } from "./shared";

export type StudentSkillStat = ReturnType<typeof finalizeBucket> & {
  skillType: SkillType;
  label: string;
};

export type StudentTopicStat = ReturnType<typeof finalizeBucket> & {
  topicId: string;
  topicName: string;
  topicSlug: string;
  recommendedAction: string;
};

export async function getStudentOverview(userId: string) {
  const [statuses, submissions, answers, accessibleAssignments, assignmentSubmissions] = await Promise.all([
    prisma.userProblemStatus.findMany({ where: { userId } }),
    prisma.submission.findMany({
      where: { userId },
      include: { problem: { select: { title: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.submissionAnswer.findMany({
      where: { submission: { userId } },
      include: { manualGrade: true },
    }),
    prisma.assignment.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ classroomId: null }, { classroom: { members: { some: { userId, role: "STUDENT" } } } }],
      },
      select: { id: true },
    }),
    prisma.assignmentSubmission.findMany({
      where: { userId },
      include: { assignment: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const bucket = emptyBucket();
  answers.forEach((answer) => addAnswer(bucket, answer));
  const scoredAssignments = assignmentSubmissions.filter((submission) => submission.total && submission.total > 0);
  const completedAssignmentCount = assignmentSubmissions.filter((submission) => submission.submittedAt).length;
  const assignmentCompletion =
    accessibleAssignments.length > 0 ? completedAssignmentCount / accessibleAssignments.length : null;
  const averageScore =
    scoredAssignments.length > 0
      ? scoredAssignments.reduce((sum, submission) => sum + ((submission.score ?? 0) / (submission.total ?? 1)), 0) /
        scoredAssignments.length
      : null;

  const recentProgress = submissions.map((submission) => ({
    id: submission.id,
    problemTitle: submission.problem.title,
    problemSlug: submission.problem.slug,
    status: submission.status,
    score: submission.score,
    total: submission.total,
    createdAt: submission.createdAt,
  }));

  const trendMap = new Map<string, { total: number; wrong: number }>();
  for (const answer of answers) {
    const day = answer.createdAt.toISOString().slice(0, 10);
    const current = trendMap.get(day) ?? { total: 0, wrong: 0 };
    const contribution = answer.manualGrade
      ? answer.manualGrade.correctness === "INCORRECT" || answer.manualGrade.correctness === "NEEDS_REVISION"
      : answer.isCorrect === false;
    if (answer.isCorrect !== null || answer.manualGrade) {
      current.total += 1;
      if (contribution) current.wrong += 1;
    }
    trendMap.set(day, current);
  }

  return {
    attemptedProblems: statuses.length,
    solvedProblems: statuses.filter((status) => status.status === "SOLVED").length,
    totalSubmissions: await prisma.submission.count({ where: { userId } }),
    assignmentCompletion,
    averageScore,
    questionsNeedingReview: bucket.needsReview,
    answerStats: finalizeBucket(bucket),
    recentProgress,
    recentAssignmentResults: assignmentSubmissions,
    wrongAnswerTrends: [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([date, value]) => ({ date, ...value })),
  };
}

export async function getStudentSkillStats(userId: string): Promise<StudentSkillStat[]> {
  const answers = await prisma.submissionAnswer.findMany({
    where: { submission: { userId } },
    include: { manualGrade: true, question: true },
  });
  const buckets = new Map<SkillType, ReturnType<typeof emptyBucket>>();
  skillOrder.forEach((skill) => buckets.set(skill, emptyBucket()));

  answers.forEach((answer) => {
    const bucket = buckets.get(answer.question.skillType) ?? emptyBucket();
    addAnswer(bucket, answer);
    buckets.set(answer.question.skillType, bucket);
  });

  return skillOrder.map((skillType) => ({
    skillType,
    label: skillDisplayName(skillType),
    ...finalizeBucket(buckets.get(skillType) ?? emptyBucket()),
  }));
}

export async function getStudentTopicStats(userId: string): Promise<StudentTopicStat[]> {
  const answers = await prisma.submissionAnswer.findMany({
    where: { submission: { userId } },
    include: {
      manualGrade: true,
      question: { include: { problem: { include: { problemTopics: { include: { topic: true } } } } } },
    },
  });
  const buckets = new Map<string, ReturnType<typeof emptyBucket> & { topicName: string; topicSlug: string }>();

  answers.forEach((answer) => {
    answer.question.problem.problemTopics.forEach(({ topic }) => {
      const bucket = buckets.get(topic.id) ?? { ...emptyBucket(), topicName: topic.name, topicSlug: topic.slug };
      addAnswer(bucket, answer);
      buckets.set(topic.id, bucket);
    });
  });

  return [...buckets.entries()]
    .map(([topicId, bucket]) => {
      const stat = finalizeBucket(bucket);
      return {
        topicId,
        topicName: bucket.topicName,
        topicSlug: bucket.topicSlug,
        recommendedAction: recommendedAction(stat.accuracy, stat.attempted, `topic ${bucket.topicName}`),
        ...stat,
      };
    })
    .sort((a, b) => {
      if (a.accuracy === null && b.accuracy === null) return b.attempted - a.attempted;
      if (a.accuracy === null) return 1;
      if (b.accuracy === null) return -1;
      return a.accuracy - b.accuracy;
    });
}

export async function getStudentWrongQuestionStats(userId: string, take = 8) {
  const wrongAnswers = await prisma.submissionAnswer.findMany({
    where: {
      submission: { userId },
      OR: [
        { isCorrect: false },
        { manualGrade: { correctness: { in: ["INCORRECT", "NEEDS_REVISION"] } } },
      ],
    },
    include: {
      manualGrade: true,
      submission: { include: { problem: true } },
      question: {
        include: {
          problem: {
            include: { problemTopics: { include: { topic: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return wrongAnswers.map((answer) => ({
    id: answer.id,
    problemId: answer.submission.problemId,
    problemTitle: answer.submission.problem.title,
    problemSlug: answer.submission.problem.slug,
    skillType: answer.question.skillType,
    questionType: answer.question.type,
    prompt: answer.question.prompt,
    topics: answer.question.problem.problemTopics.map(({ topic }) => topic.name),
    studentAnswer: answer.studentAnswer,
    correctAnswer: summarizeCorrectAnswer(answer.question),
    createdAt: answer.createdAt,
  }));
}

export async function getStudentSkillDetail(userId: string, skillType: SkillType) {
  const [skillStats, topicStats, wrongQuestions, recentSubmissions, recommendedProblems] = await Promise.all([
    getStudentSkillStats(userId),
    getStudentTopicStats(userId),
    getStudentWrongQuestionStats(userId, 20),
    prisma.submission.findMany({
      where: { userId, problem: { skillType } },
      include: { problem: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.problem.findMany({
      where: {
        contentStatus: "PUBLISHED",
        skillType,
        userStatuses: { none: { userId, status: "SOLVED" } },
      },
      include: { sourceCollection: true, problemTopics: { include: { topic: true } } },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: 6,
    }),
  ]);

  return {
    skill: skillStats.find((stat) => stat.skillType === skillType) ?? {
      skillType,
      label: skillLabels[skillType],
      ...finalizeBucket(emptyBucket()),
    },
    relatedTopics: topicStats.filter((topic) => topic.attempted > 0).slice(0, 8),
    wrongQuestions: wrongQuestions.filter((answer) => answer.skillType === skillType).slice(0, 8),
    recentSubmissions,
    recommendedProblems: recommendedProblems.sort(
      (a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty),
    ),
  };
}

export { percent };
