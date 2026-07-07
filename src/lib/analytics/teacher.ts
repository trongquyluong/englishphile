import type { SkillType } from "@prisma/client";
import { skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { addAnswer, emptyBucket, finalizeBucket, percent, recommendedAction, skillDisplayName } from "./shared";

async function getClassStudentIds(classroomId: string) {
  const members = await prisma.classroomMember.findMany({
    where: { classroomId, role: "STUDENT" },
    select: { userId: true },
  });
  return members.map((member) => member.userId);
}

export async function getClassOverview(classroomId: string) {
  const studentIds = await getClassStudentIds(classroomId);
  const [answers, assignments, assignmentSubmissions, students] = await Promise.all([
    prisma.submissionAnswer.findMany({
      where: { submission: { userId: { in: studentIds } } },
      include: { manualGrade: true },
    }),
    prisma.assignment.findMany({ where: { classroomId }, select: { id: true, status: true } }),
    prisma.assignmentSubmission.findMany({
      where: { assignment: { classroomId }, userId: { in: studentIds } },
    }),
    prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true } }),
  ]);

  const bucket = emptyBucket();
  answers.forEach((answer) => addAnswer(bucket, answer));
  const submitted = assignmentSubmissions.filter((submission) => submission.submittedAt).length;
  const possible = assignments.length * Math.max(students.length, 1);
  const scored = assignmentSubmissions.filter((submission) => submission.total && submission.total > 0);
  const averageScore =
    scored.length > 0
      ? scored.reduce((sum, submission) => sum + ((submission.score ?? 0) / (submission.total ?? 1)), 0) / scored.length
      : null;

  return {
    activeStudents: students.length,
    assignmentCount: assignments.length,
    submittedAssignments: submitted,
    assignmentCompletion: assignments.length && students.length ? submitted / possible : null,
    averageScore,
    classAccuracy: finalizeBucket(bucket),
    needsReviewAnswers: bucket.needsReview,
    assignmentsNeedingReview: assignmentSubmissions.filter((submission) => submission.status === "NEEDS_REVIEW").length,
  };
}

export async function getClassSkillStats(classroomId: string) {
  const studentIds = await getClassStudentIds(classroomId);
  const answers = await prisma.submissionAnswer.findMany({
    where: { submission: { userId: { in: studentIds } } },
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

export async function getClassTopicStats(classroomId: string) {
  const studentIds = await getClassStudentIds(classroomId);
  const answers = await prisma.submissionAnswer.findMany({
    where: { submission: { userId: { in: studentIds } } },
    include: {
      manualGrade: true,
      question: { include: { problem: { include: { problemTopics: { include: { topic: true } } } } } },
    },
  });
  const buckets = new Map<string, ReturnType<typeof emptyBucket> & { name: string; slug: string }>();
  answers.forEach((answer) => {
    answer.question.problem.problemTopics.forEach(({ topic }) => {
      const bucket = buckets.get(topic.id) ?? { ...emptyBucket(), name: topic.name, slug: topic.slug };
      addAnswer(bucket, answer);
      buckets.set(topic.id, bucket);
    });
  });
  return [...buckets.entries()]
    .map(([topicId, bucket]) => {
      const stat = finalizeBucket(bucket);
      return {
        topicId,
        topicName: bucket.name,
        topicSlug: bucket.slug,
        recommendedAction: recommendedAction(stat.accuracy, stat.attempted, `topic ${bucket.name}`),
        ...stat,
      };
    })
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1));
}

export async function getTopDifficultProblems(classroomId: string, take = 8) {
  const studentIds = await getClassStudentIds(classroomId);
  const answers = await prisma.submissionAnswer.findMany({
    where: { submission: { userId: { in: studentIds } } },
    include: {
      manualGrade: true,
      submission: { include: { problem: true } },
    },
  });
  const buckets = new Map<string, ReturnType<typeof emptyBucket> & { title: string; slug: string }>();
  answers.forEach((answer) => {
    const problem = answer.submission.problem;
    const bucket = buckets.get(problem.id) ?? { ...emptyBucket(), title: problem.title, slug: problem.slug };
    addAnswer(bucket, answer);
    buckets.set(problem.id, bucket);
  });
  return [...buckets.entries()]
    .map(([problemId, bucket]) => ({ problemId, ...bucket, ...finalizeBucket(bucket) }))
    .filter((item) => item.attempted > 0)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, take);
}

export async function getStudentsNeedingAttention(classroomId: string) {
  const studentIds = await getClassStudentIds(classroomId);
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, displayName: true, email: true },
  });
  const rows = await Promise.all(
    students.map(async (student) => {
      const [answers, assignments, submissions] = await Promise.all([
        prisma.submissionAnswer.findMany({
          where: { submission: { userId: student.id } },
          include: { manualGrade: true },
        }),
        prisma.assignment.count({ where: { classroomId, status: "PUBLISHED" } }),
        prisma.assignmentSubmission.findMany({ where: { userId: student.id, assignment: { classroomId } } }),
      ]);
      const bucket = emptyBucket();
      answers.forEach((answer) => addAnswer(bucket, answer));
      const stat = finalizeBucket(bucket);
      const completed = submissions.filter((submission) => submission.submittedAt).length;
      return {
        ...student,
        ...stat,
        assignmentCompletion: assignments ? completed / assignments : null,
        reason:
          stat.attempted < 5
            ? "Chưa đủ dữ liệu"
            : stat.accuracy !== null && stat.accuracy < 0.6
              ? "Độ chính xác thấp"
              : assignments && completed / assignments < 0.7
                ? "Chưa hoàn thành đủ bài"
                : "Theo dõi thêm",
      };
    }),
  );
  return rows
    .filter((row) => row.statusLabel !== "Mạnh" || (row.assignmentCompletion ?? 1) < 0.7)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1));
}

export async function getAssignmentAnalytics(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      classroom: { include: { members: { include: { user: true } } } },
      problems: {
        orderBy: { orderIndex: "asc" },
        include: { problem: { include: { questions: true } } },
      },
      submissions: {
        include: {
          user: true,
          problemSubmissions: {
            include: {
              problem: true,
              submission: {
                include: { submissionAnswers: { include: { manualGrade: true, question: true } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!assignment) return null;

  const students = assignment.classroom?.members.filter((member) => member.role === "STUDENT").map((member) => member.user) ?? [];
  const submitted = assignment.submissions.filter((submission) => submission.submittedAt).length;
  const late = assignment.submissions.filter((submission) => submission.status === "LATE").length;
  const needsReview = assignment.submissions.filter((submission) => submission.status === "NEEDS_REVIEW").length;
  const scored = assignment.submissions.filter((submission) => submission.total && submission.total > 0);
  const averageScore =
    scored.length > 0
      ? scored.reduce((sum, submission) => sum + ((submission.score ?? 0) / (submission.total ?? 1)), 0) / scored.length
      : null;

  const scoreDistribution = [
    { label: "0-49%", count: 0 },
    { label: "50-69%", count: 0 },
    { label: "70-84%", count: 0 },
    { label: "85-100%", count: 0 },
  ];
  scored.forEach((submission) => {
    const ratio = (submission.score ?? 0) / (submission.total ?? 1);
    if (ratio < 0.5) scoreDistribution[0].count += 1;
    else if (ratio < 0.7) scoreDistribution[1].count += 1;
    else if (ratio < 0.85) scoreDistribution[2].count += 1;
    else scoreDistribution[3].count += 1;
  });

  const problemPerformance = assignment.problems.map(({ problem }) => {
    const bucket = emptyBucket();
    assignment.submissions.forEach((submission) => {
      const problemSubmission = submission.problemSubmissions.find((item) => item.problemId === problem.id);
      problemSubmission?.submission?.submissionAnswers.forEach((answer) => addAnswer(bucket, answer));
    });
    return { problemId: problem.id, title: problem.title, slug: problem.slug, ...finalizeBucket(bucket) };
  });

  const questionPerformance = assignment.problems.flatMap(({ problem }) =>
    problem.questions.map((question) => {
      const bucket = emptyBucket();
      assignment.submissions.forEach((submission) => {
        submission.problemSubmissions
          .find((item) => item.problemId === problem.id)
          ?.submission?.submissionAnswers.filter((answer) => answer.questionId === question.id)
          .forEach((answer) => addAnswer(bucket, answer));
      });
      return { questionId: question.id, problemTitle: problem.title, prompt: question.prompt, type: question.type, ...finalizeBucket(bucket) };
    }),
  );

  return {
    assignment,
    students,
    completionCount: submitted,
    notSubmittedCount: Math.max(0, students.length - submitted),
    lateCount: late,
    needsReviewCount: needsReview,
    averageScore,
    averageScoreLabel: percent(averageScore),
    scoreDistribution,
    problemPerformance,
    questionPerformance,
  };
}
