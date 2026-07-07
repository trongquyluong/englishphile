import type { Difficulty, SkillType } from "@prisma/client";
import { getStudentTopicStats, getStudentWrongQuestionStats } from "@/lib/analytics/student";
import { skillLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export type PersonalizedRecommendation = {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  difficulty: Difficulty;
  reason: string;
  priority: number;
  actionLink: string;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
};

const difficultyOrder: Difficulty[] = ["B2", "C1", "C2", "CHUYEN", "HSG"];

function nextDifficulty(level: Difficulty | null | undefined) {
  if (!level) return "B2";
  const index = difficultyOrder.indexOf(level);
  return difficultyOrder[Math.min(difficultyOrder.length - 1, Math.max(0, index + 1))];
}

function includesProblem(recommendations: PersonalizedRecommendation[], problemId: string) {
  return recommendations.some((item) => item.id === problemId);
}

async function toRecommendation(problem: {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  difficulty: Difficulty;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
}, reason: string, priority: number): Promise<PersonalizedRecommendation> {
  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    skillType: problem.skillType,
    difficulty: problem.difficulty,
    problemTopics: problem.problemTopics,
    reason,
    priority,
    actionLink: `/problems/${problem.slug}`,
  };
}

export async function getPersonalizedRecommendations(userId: string, take = 8): Promise<PersonalizedRecommendation[]> {
  const [latestDiagnostic, activeRecommendations, skillProfiles, topicStats, wrongQuestions, solvedStatuses, writingAttempts, readingAttempts] =
    await Promise.all([
      prisma.diagnosticAttempt.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.learningRecommendation.findMany({
        where: { userId, status: "ACTIVE", problem: { contentStatus: "PUBLISHED" } },
        include: { problem: { include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } } } },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      prisma.userSkillProfile.findMany({ where: { userId }, orderBy: [{ accuracy: "asc" }, { attempted: "desc" }] }),
      getStudentTopicStats(userId),
      getStudentWrongQuestionStats(userId, 8),
      prisma.userProblemStatus.findMany({ where: { userId, status: "SOLVED" }, select: { problemId: true } }),
      prisma.submission.count({ where: { userId, problem: { skillType: "WRITING" } } }),
      prisma.submission.count({ where: { userId, problem: { skillType: "READING" } } }),
    ]);

  const solvedIds = new Set(solvedStatuses.map((item) => item.problemId));
  const recommendations: PersonalizedRecommendation[] = [];

  for (const wrong of wrongQuestions) {
    if (recommendations.length >= take) break;
    if (includesProblem(recommendations, wrong.problemId)) continue;
    const problem = await prisma.problem.findFirst({
      where: { id: wrong.problemId, contentStatus: "PUBLISHED" },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
    });
    if (!problem) continue;
    recommendations.push(await toRecommendation(problem, "Bạn đã sai dạng này trước đó, nên nên ôn lại.", 140));
  }

  for (const active of activeRecommendations) {
    if (!active.problem || recommendations.length >= take) break;
    if (includesProblem(recommendations, active.problem.id)) continue;
    recommendations.push(await toRecommendation(active.problem, active.reason, active.priority));
  }

  const weakSkills = skillProfiles
    .filter((profile) => profile.attempted >= 3 && profile.accuracy !== null && profile.accuracy < 0.7)
    .slice(0, 3);
  for (const profile of weakSkills) {
    if (recommendations.length >= take) break;
    const problem = await prisma.problem.findFirst({
      where: {
        contentStatus: "PUBLISHED",
        skillType: profile.skillType,
        id: { notIn: [...solvedIds, ...recommendations.map((item) => item.id)] },
      },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
    });
    if (problem) {
      recommendations.push(
        await toRecommendation(problem, `Diagnostic cho thấy bạn cần luyện thêm ${skillLabels[profile.skillType]}.`, 110),
      );
    }
  }

  const weakTopics = topicStats.filter((topic) => topic.attempted >= 3 && topic.accuracy !== null && topic.accuracy < 0.7).slice(0, 3);
  for (const topic of weakTopics) {
    if (recommendations.length >= take) break;
    const problem = await prisma.problem.findFirst({
      where: {
        contentStatus: "PUBLISHED",
        id: { notIn: [...solvedIds, ...recommendations.map((item) => item.id)] },
        problemTopics: { some: { topicId: topic.topicId } },
      },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
    });
    if (problem) {
      recommendations.push(await toRecommendation(problem, `Bạn thường sai các câu liên quan đến ${topic.topicName}.`, 95));
    }
  }

  const currentLevel = latestDiagnostic?.estimatedLevel ?? skillProfiles.find((profile) => profile.estimatedLevel)?.estimatedLevel ?? "B2";
  if (recommendations.length < take) {
    const levelProblems = await prisma.problem.findMany({
      where: {
        contentStatus: "PUBLISHED",
        difficulty: currentLevel,
        id: { notIn: [...solvedIds, ...recommendations.map((item) => item.id)] },
      },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: [{ orderIndex: "asc" }],
      take: take - recommendations.length,
    });
    for (const problem of levelProblems) {
      recommendations.push(await toRecommendation(problem, `Bài này phù hợp với level ${currentLevel} hiện tại của bạn.`, 70));
    }
  }

  if (recommendations.length < take) {
    const challenge = await prisma.problem.findFirst({
      where: {
        contentStatus: "PUBLISHED",
        difficulty: nextDifficulty(currentLevel),
        id: { notIn: [...solvedIds, ...recommendations.map((item) => item.id)] },
      },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: [{ orderIndex: "asc" }],
    });
    if (challenge) {
      recommendations.push(await toRecommendation(challenge, "Bài này cao hơn trình độ hiện tại một chút để thử thách.", 60));
    }
  }

  if (writingAttempts === 0 && recommendations.length < take) {
    const writing = await prisma.problem.findFirst({
      where: { contentStatus: "PUBLISHED", skillType: "WRITING" },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
    });
    if (writing && !includesProblem(recommendations, writing.id)) {
      recommendations.push(await toRecommendation(writing, "Bạn chưa có dữ liệu Writing, nên hãy thử một prompt ngắn.", 55));
    }
  }

  if (readingAttempts < 2 && recommendations.length < take) {
    const reading = await prisma.problem.findFirst({
      where: { contentStatus: "PUBLISHED", skillType: "READING" },
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
    });
    if (reading && !includesProblem(recommendations, reading.id)) {
      recommendations.push(await toRecommendation(reading, "Bạn chưa có đủ dữ liệu Reading, nên hãy làm một bài đọc ngắn.", 50));
    }
  }

  return recommendations.sort((left, right) => right.priority - left.priority).slice(0, take);
}

export async function markRecommendationsCompletedForProblem(userId: string, problemId: string) {
  await prisma.learningRecommendation.updateMany({
    where: { userId, problemId, status: "ACTIVE" },
    data: { status: "COMPLETED" },
  });
}
