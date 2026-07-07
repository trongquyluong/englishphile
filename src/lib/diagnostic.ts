import type { Difficulty, Prisma, QuestionType, SkillType } from "@prisma/client";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import {
  diagnosticBlueprint,
  getDiagnosticCoverage,
  getSectionForQuestion,
  isAutoMarkableDiagnosticType,
  type DiagnosticSectionPlan,
} from "@/lib/diagnostic-blueprint";
import {
  calculateDiagnosticScore,
  diagnosticLevelExplanation,
  skillStatusLabel,
  type DiagnosticScoreSummary,
} from "@/lib/diagnostic-scoring";
import { diagnosticQuestionDataWhere, hasRequiredDiagnosticQuestionData } from "@/lib/diagnostic-question-readiness";
import { skillLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const diagnosticQuestionSelect = {
  id: true,
  problemId: true,
  type: true,
  skillType: true,
  difficulty: true,
  prompt: true,
  passage: true,
  options: true,
  answer: true,
  explanation: true,
  rootWord: true,
  keyword: true,
  targetSentence: true,
  lineNumber: true,
  metadata: true,
  orderIndex: true,
  problem: {
    select: {
      id: true,
      title: true,
      slug: true,
      statement: true,
      skillType: true,
      isDiagnosticEligible: true,
      diagnosticWeight: true,
      problemTopics: { include: { topic: { select: { id: true, name: true, slug: true } } } },
    },
  },
} as const;

export type DiagnosticQuestion = Prisma.QuestionGetPayload<{ select: typeof diagnosticQuestionSelect }>;

export type DiagnosticAttemptMetadata = {
  questionIds?: string[];
  sections?: DiagnosticSectionPlan[];
  coverageWarnings?: string[];
  results?: Array<{
    questionId: string;
    problemId: string;
    skillType: SkillType;
    difficulty: Difficulty;
    isCorrect: boolean | null;
    feedback: string;
    correctAnswer: string;
  }>;
  scoring?: Pick<
    DiagnosticScoreSummary,
    "weightedAccuracy" | "rawCorrect" | "rawAttempted" | "confidence" | "confidenceLabel" | "confidenceReason" | "strengths" | "weakAreas"
  > & {
    levelExplanation: string;
  };
};

function parseAttemptMetadata(value: unknown): DiagnosticAttemptMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as DiagnosticAttemptMetadata;
  }
  return {};
}

async function findQuestionsForBlueprintItem(
  item: (typeof diagnosticBlueprint)[number]["items"][number],
  usedQuestionIds: Set<string>,
) {
  const baseWhere = {
    skillType: { in: item.skillTypes },
    type: { in: item.questionTypes },
    contentStatus: "PUBLISHED" as const,
    problem: { contentStatus: "PUBLISHED" as const },
    AND: [diagnosticQuestionDataWhere],
  };

  const [eligible, fallback] = await Promise.all([
    prisma.question.findMany({
      where: {
        ...baseWhere,
        id: { notIn: [...usedQuestionIds] },
        problem: { ...baseWhere.problem, isDiagnosticEligible: true },
      },
      select: diagnosticQuestionSelect,
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: item.targetCount * 3,
    }),
    prisma.question.findMany({
      where: {
        ...baseWhere,
        id: { notIn: [...usedQuestionIds] },
      },
      select: diagnosticQuestionSelect,
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: item.targetCount * 4,
    }),
  ]);

  const candidates = [...eligible, ...fallback]
    .filter((question, index, array) => array.findIndex((item) => item.id === question.id) === index)
    .filter(hasRequiredDiagnosticQuestionData)
    .filter((question) => isAutoMarkableDiagnosticType(question.type) || question.type === "WRITING_PROMPT")
    .sort((left, right) => {
      const eligibleDelta = Number(right.problem.isDiagnosticEligible) - Number(left.problem.isDiagnosticEligible);
      if (eligibleDelta) return eligibleDelta;
      const weightDelta = right.problem.diagnosticWeight - left.problem.diagnosticWeight;
      if (weightDelta) return weightDelta;
      return left.orderIndex - right.orderIndex;
    });

  return candidates.slice(0, item.targetCount);
}

export async function selectDiagnosticQuestions() {
  const selected: DiagnosticQuestion[] = [];
  const used = new Set<string>();
  const sections: DiagnosticSectionPlan[] = [];
  const coverage = await getDiagnosticCoverage();

  for (const section of diagnosticBlueprint) {
    const sectionQuestions: DiagnosticQuestion[] = [];
    const scored = section.items.some((item) => item.scored);
    const optional = section.items.every((item) => item.optional);
    const targetCount = section.items.reduce((sum, item) => sum + item.targetCount, 0);

    for (const item of section.items) {
      const questions = await findQuestionsForBlueprintItem(item, used);
      for (const question of questions) {
        if (used.has(question.id)) continue;
        selected.push(question);
        sectionQuestions.push(question);
        used.add(question.id);
      }
    }

    const coverageItem = coverage.sections.find((item) => item.id === section.id);
    const warning =
      sectionQuestions.length >= Math.min(targetCount, Math.max(1, targetCount))
        ? coverageItem?.status === "missing"
          ? coverageItem.message
          : undefined
        : coverageItem?.message ?? "Thiếu câu hỏi cho section này.";

    sections.push({
      id: section.id,
      title: section.title,
      description: section.description,
      scored,
      optional,
      targetCount,
      questionIds: sectionQuestions.map((question) => question.id),
      warning,
    });
  }

  const scoredCount = sections.filter((section) => section.scored).reduce((sum, section) => sum + section.questionIds.length, 0);
  if (scoredCount >= 12) return { questions: selected, sections, coverageWarnings: coverage.warnings };

  const fallback = await prisma.question.findMany({
    where: {
      id: { notIn: [...used] },
      contentStatus: "PUBLISHED",
      problem: { contentStatus: "PUBLISHED" },
      type: { in: ["MCQ", "WORD_FORMATION", "OPEN_CLOZE", "GUIDED_CLOZE", "READING_MCQ", "ERROR_IDENTIFICATION"] },
      AND: [diagnosticQuestionDataWhere],
    },
    select: diagnosticQuestionSelect,
    orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
    take: 20 - scoredCount,
  });

  const fallbackSection = sections.find((section) => section.id === "use-of-english-core");
  for (const question of fallback.filter(hasRequiredDiagnosticQuestionData)) {
    if (used.has(question.id)) continue;
    selected.push(question);
    used.add(question.id);
    fallbackSection?.questionIds.push(question.id);
  }

  return { questions: selected.slice(0, 35), sections, coverageWarnings: coverage.warnings };
}

export function estimateLevel(score: number, total: number): Difficulty {
  const accuracy = total > 0 ? score / total : null;
  if (accuracy === null) return "B2";
  if (accuracy < 0.4) return "B2";
  if (accuracy < 0.6) return "C1";
  if (accuracy < 0.75) return "C2";
  if (accuracy < 0.88) return "CHUYEN";
  return "HSG";
}

export { skillStatusLabel };

export async function createDiagnosticAttempt(userId: string) {
  const selection = await selectDiagnosticQuestions();
  return prisma.diagnosticAttempt.create({
    data: {
      userId,
      status: "IN_PROGRESS",
      recommendationJson: {
        questionIds: selection.questions.map((question) => question.id),
        sections: selection.sections,
        coverageWarnings: selection.coverageWarnings,
      },
    },
  });
}

export async function getDiagnosticQuestionsForAttempt(attemptId: string, userId: string) {
  const attempt = await prisma.diagnosticAttempt.findFirst({ where: { id: attemptId, userId } });
  if (!attempt) return null;
  const metadata = parseAttemptMetadata(attempt.recommendationJson);
  const questionIds = metadata.questionIds ?? [];
  if (!questionIds.length) return { attempt, questions: [] as DiagnosticQuestion[], sections: metadata.sections ?? [] };

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, problem: { contentStatus: "PUBLISHED" } },
    select: diagnosticQuestionSelect,
  });
  const order = new Map(questionIds.map((id, index) => [id, index]));
  const sortedQuestions = questions.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  return {
    attempt,
    questions: sortedQuestions,
    sections: metadata.sections ?? buildSectionsFromQuestions(sortedQuestions),
  };
}

function buildSectionsFromQuestions(questions: DiagnosticQuestion[]): DiagnosticSectionPlan[] {
  return diagnosticBlueprint.map((section) => {
    const questionIds = questions
      .filter((question) => getSectionForQuestion(question.skillType, question.type as QuestionType).id === section.id)
      .map((question) => question.id);
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      scored: section.items.some((item) => item.scored),
      optional: section.items.every((item) => item.optional),
      targetCount: section.items.reduce((sum, item) => sum + item.targetCount, 0),
      questionIds,
    };
  });
}

export async function scoreDiagnosticAttempt(attemptId: string, userId: string, answers: Record<string, unknown>) {
  const data = await getDiagnosticQuestionsForAttempt(attemptId, userId);
  if (!data) throw new Error("Không tìm thấy diagnostic attempt.");

  const results = data.questions.map((question) => {
    const result = checkQuestionAnswer(question, answers[question.id]);
    return {
      questionId: question.id,
      problemId: question.problemId,
      skillType: question.skillType,
      difficulty: question.difficulty,
      isCorrect: result.isCorrect,
      feedback: result.feedback,
      correctAnswer: result.correctAnswer,
      diagnosticWeight: question.problem.diagnosticWeight,
      topics: question.problem.problemTopics.map(({ topic }) => topic),
    };
  });

  const scoreSummary = calculateDiagnosticScore(results);
  const estimatedLevel = scoreSummary.estimatedLevel;

  for (const item of scoreSummary.skillBreakdown) {
    await prisma.userSkillProfile.upsert({
      where: { userId_skillType: { userId, skillType: item.skillType } },
      create: {
        userId,
        skillType: item.skillType,
        estimatedLevel,
        accuracy: item.accuracy,
        attempted: item.attempted,
        correct: item.correct,
        confidence: Math.min(1, item.attempted / 10),
      },
      update: {
        estimatedLevel,
        accuracy: item.accuracy,
        attempted: item.attempted,
        correct: item.correct,
        confidence: Math.min(1, item.attempted / 10),
        lastUpdatedAt: new Date(),
      },
    });
  }

  for (const item of scoreSummary.topicBreakdown) {
    await prisma.userTopicProfile.upsert({
      where: { userId_topicId: { userId, topicId: item.topicId } },
      create: {
        userId,
        topicId: item.topicId,
        estimatedLevel,
        accuracy: item.accuracy,
        attempted: item.attempted,
        correct: item.correct,
        confidence: Math.min(1, item.attempted / 8),
      },
      update: {
        estimatedLevel,
        accuracy: item.accuracy,
        attempted: item.attempted,
        correct: item.correct,
        confidence: Math.min(1, item.attempted / 8),
        lastUpdatedAt: new Date(),
      },
    });
  }

  await prisma.learningRecommendation.updateMany({
    where: { userId, status: "ACTIVE", recommendationType: { not: "WRONG_QUESTION_RETRY" } },
    data: { status: "DISMISSED" },
  });

  await createDiagnosticRecommendations(userId, scoreSummary, estimatedLevel);

  const existingMetadata = parseAttemptMetadata(data.attempt.recommendationJson);
  const attempt = await prisma.diagnosticAttempt.update({
    where: { id: attemptId },
    data: {
      status: results.some((result) => result.isCorrect === null) ? "NEEDS_REVIEW" : "COMPLETED",
      completedAt: new Date(),
      score: scoreSummary.score,
      total: scoreSummary.total,
      estimatedLevel,
      skillBreakdownJson: scoreSummary.skillBreakdown,
      topicBreakdownJson: scoreSummary.topicBreakdown,
      recommendationJson: {
        ...existingMetadata,
        results: results.map((result) => ({
          questionId: result.questionId,
          problemId: result.problemId,
          skillType: result.skillType,
          difficulty: result.difficulty,
          isCorrect: result.isCorrect,
          feedback: result.feedback,
          correctAnswer: result.correctAnswer,
        })),
        scoring: {
          weightedAccuracy: scoreSummary.weightedAccuracy,
          rawCorrect: scoreSummary.rawCorrect,
          rawAttempted: scoreSummary.rawAttempted,
          confidence: scoreSummary.confidence,
          confidenceLabel: scoreSummary.confidenceLabel,
          confidenceReason: scoreSummary.confidenceReason,
          strengths: scoreSummary.strengths,
          weakAreas: scoreSummary.weakAreas,
          levelExplanation: diagnosticLevelExplanation(estimatedLevel),
        },
      },
    },
  });

  return attempt;
}

async function createDiagnosticRecommendations(userId: string, scoreSummary: DiagnosticScoreSummary, estimatedLevel: Difficulty) {
  const solved = await prisma.userProblemStatus.findMany({ where: { userId, status: "SOLVED" }, select: { problemId: true } });
  const solvedIds = solved.map((item) => item.problemId);

  for (const [index, skill] of scoreSummary.weakAreas.entries()) {
    const problem = await prisma.problem.findFirst({
      where: {
        contentStatus: "PUBLISHED",
        skillType: skill.skillType,
        id: { notIn: solvedIds },
      },
      orderBy: [{ recommendedMinLevel: "asc" }, { difficulty: "asc" }, { orderIndex: "asc" }],
    });
    await prisma.learningRecommendation.create({
      data: {
        userId,
        recommendationType: problem ? "NEXT_PROBLEM" : "SKILL_FOCUS",
        skillType: skill.skillType,
        problemId: problem?.id,
        reason: `Diagnostic cho thấy bạn cần luyện thêm ${skill.label}.`,
        priority: 120 - index * 10,
      },
    });
  }

  const weakTopics = scoreSummary.topicBreakdown
    .filter((topic) => topic.attempted >= 2 && (topic.accuracy ?? 1) < 0.7)
    .slice(0, 3);
  for (const [index, topic] of weakTopics.entries()) {
    const problem = await prisma.problem.findFirst({
      where: {
        contentStatus: "PUBLISHED",
        id: { notIn: solvedIds },
        problemTopics: { some: { topicId: topic.topicId } },
      },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
    });
    await prisma.learningRecommendation.create({
      data: {
        userId,
        recommendationType: "TOPIC_REVIEW",
        topicId: topic.topicId,
        problemId: problem?.id,
        reason: `Bạn thường sai các câu liên quan đến ${topic.topicName}.`,
        priority: 90 - index * 10,
      },
    });
  }

  const levelProblem = await prisma.problem.findFirst({
    where: {
      contentStatus: "PUBLISHED",
      difficulty: estimatedLevel,
      id: { notIn: solvedIds },
    },
    orderBy: [{ orderIndex: "asc" }],
  });
  if (levelProblem) {
    await prisma.learningRecommendation.create({
      data: {
        userId,
        recommendationType: "NEXT_PROBLEM",
        skillType: levelProblem.skillType,
        problemId: levelProblem.id,
        reason: `Bài này phù hợp với level ${estimatedLevel} hiện tại của bạn.`,
        priority: 70,
      },
    });
  }
}

export async function getLatestDiagnosticAttempt(userId: string, status?: "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW" | "ABANDONED") {
  return prisma.diagnosticAttempt.findFirst({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveLearningRecommendations(userId: string, take = 6) {
  return prisma.learningRecommendation.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ problemId: null }, { problem: { contentStatus: "PUBLISHED" } }],
    },
    include: {
      problem: {
        include: { problemTopics: { include: { topic: true } } },
      },
      topic: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function getRecommendedModeCounts(userId: string) {
  const [reading, writing, listening, useOfEnglish] = await Promise.all([
    prisma.problem.count({ where: { contentStatus: "PUBLISHED", skillType: "READING" } }),
    prisma.problem.count({ where: { contentStatus: "PUBLISHED", skillType: "WRITING" } }),
    prisma.problem.count({ where: { contentStatus: "PUBLISHED", skillType: "LISTENING" } }),
    prisma.problem.count({
      where: {
        contentStatus: "PUBLISHED",
        skillType: { notIn: ["READING", "WRITING", "LISTENING"] },
        userStatuses: { none: { userId, status: "SOLVED" } },
      },
    }),
  ]);
  return { reading, writing, listening, useOfEnglish };
}

export function getDiagnosticMetadata(value: unknown) {
  return parseAttemptMetadata(value);
}

export function getReadableSkillStatus(accuracy: number | null | undefined, attempted: number | undefined) {
  return skillStatusLabel(accuracy ?? null, attempted ?? 0);
}

export function getSkillLabel(skillType: SkillType) {
  return skillLabels[skillType];
}
