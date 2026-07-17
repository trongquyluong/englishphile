import type { Difficulty, SkillType } from "@prisma/client";
import { difficultyLabels, skillLabels } from "@/lib/labels";

export type DiagnosticConfidence = "LOW" | "MEDIUM" | "HIGH";

export type DiagnosticScoredResult = {
  questionId: string;
  problemId: string;
  skillType: SkillType;
  difficulty: Difficulty;
  isCorrect: boolean | null;
  diagnosticWeight: number;
  topics: Array<{ id: string; name: string; slug: string }>;
};

export type DiagnosticSkillBreakdownItem = {
  skillType: SkillType;
  label: string;
  correct: number;
  attempted: number;
  weightedCorrect: number;
  weightedTotal: number;
  accuracy: number | null;
  statusLabel: string;
};

export type DiagnosticTopicBreakdownItem = {
  topicId: string;
  topicName: string;
  topicSlug: string;
  correct: number;
  attempted: number;
  weightedCorrect: number;
  weightedTotal: number;
  accuracy: number | null;
  statusLabel: string;
};

export type DiagnosticScoreSummary = {
  score: number;
  total: number;
  rawCorrect: number;
  rawAttempted: number;
  weightedAccuracy: number | null;
  estimatedLevel: Difficulty;
  confidence: DiagnosticConfidence;
  confidenceLabel: string;
  confidenceReason: string;
  skillBreakdown: DiagnosticSkillBreakdownItem[];
  topicBreakdown: DiagnosticTopicBreakdownItem[];
  strengths: DiagnosticSkillBreakdownItem[];
  weakAreas: DiagnosticSkillBreakdownItem[];
};

export const difficultyWeights: Record<Difficulty, number> = {
  B2: 1,
  C1: 1.1,
  C2: 1.25,
  CHUYEN: 1.4,
  HSG: 1.6,
};

export function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimateWeightedLevel(accuracy: number | null): Difficulty {
  const value = accuracy ?? 0;
  if (value < 0.4) return "B2";
  if (value < 0.6) return "C1";
  if (value < 0.75) return "C2";
  if (value < 0.88) return "CHUYEN";
  return "HSG";
}

export function getDiagnosticConfidence(scoredQuestionCount: number) {
  if (scoredQuestionCount >= 30) {
    return {
      confidence: "HIGH" as const,
      confidenceLabel: "Cao",
      confidenceReason: "Có ít nhất 30 câu tự chấm nên kết quả khá ổn định.",
    };
  }

  if (scoredQuestionCount >= 15) {
    return {
      confidence: "MEDIUM" as const,
      confidenceLabel: "Trung bình",
      confidenceReason: "Có đủ dữ liệu cơ bản, nhưng nên luyện thêm để hiệu chỉnh hồ sơ.",
    };
  }

  return {
    confidence: "LOW" as const,
    confidenceLabel: "Thấp",
    confidenceReason: "Có dưới 15 câu tự chấm nên level chỉ là ước lượng ban đầu.",
  };
}

export function skillStatusLabel(accuracy: number | null, attempted: number) {
  if (attempted < 3 || accuracy === null) return "Chưa đủ dữ liệu";
  if (accuracy >= 0.85) return "Mạnh";
  if (accuracy >= 0.7) return "Ổn";
  if (accuracy >= 0.5) return "Cần luyện thêm";
  return "Yếu";
}

export function calculateDiagnosticScore(results: DiagnosticScoredResult[]): DiagnosticScoreSummary {
  const scored = results.filter((result) => result.isCorrect !== null);
  const skillBuckets = new Map<
    SkillType,
    { attempted: number; correct: number; weightedCorrect: number; weightedTotal: number }
  >();
  const topicBuckets = new Map<
    string,
    { topicName: string; topicSlug: string; attempted: number; correct: number; weightedCorrect: number; weightedTotal: number }
  >();

  let weightedCorrect = 0;
  let weightedTotal = 0;
  let rawCorrect = 0;

  for (const result of scored) {
    const weight = difficultyWeights[result.difficulty] * Math.max(1, result.diagnosticWeight || 1);
    weightedTotal += weight;
    if (result.isCorrect) {
      weightedCorrect += weight;
      rawCorrect += 1;
    }

    const skillBucket = skillBuckets.get(result.skillType) ?? { attempted: 0, correct: 0, weightedCorrect: 0, weightedTotal: 0 };
    skillBucket.attempted += 1;
    skillBucket.weightedTotal += weight;
    if (result.isCorrect) {
      skillBucket.correct += 1;
      skillBucket.weightedCorrect += weight;
    }
    skillBuckets.set(result.skillType, skillBucket);

    for (const topic of result.topics) {
      const topicBucket = topicBuckets.get(topic.id) ?? {
        topicName: topic.name,
        topicSlug: topic.slug,
        attempted: 0,
        correct: 0,
        weightedCorrect: 0,
        weightedTotal: 0,
      };
      topicBucket.attempted += 1;
      topicBucket.weightedTotal += weight;
      if (result.isCorrect) {
        topicBucket.correct += 1;
        topicBucket.weightedCorrect += weight;
      }
      topicBuckets.set(topic.id, topicBucket);
    }
  }

  const weightedAccuracy = weightedTotal > 0 ? weightedCorrect / weightedTotal : null;
  const estimatedLevel = estimateWeightedLevel(weightedAccuracy);
  const confidence = getDiagnosticConfidence(scored.length);

  const skillBreakdown = [...skillBuckets.entries()]
    .map(([skillType, bucket]) => {
      const accuracy = bucket.weightedTotal ? bucket.weightedCorrect / bucket.weightedTotal : null;
      return {
        skillType,
        label: skillLabels[skillType],
        correct: bucket.correct,
        attempted: bucket.attempted,
        weightedCorrect: roundScore(bucket.weightedCorrect),
        weightedTotal: roundScore(bucket.weightedTotal),
        accuracy,
        statusLabel: skillStatusLabel(accuracy, bucket.attempted),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  const topicBreakdown = [...topicBuckets.entries()]
    .map(([topicId, bucket]) => {
      const accuracy = bucket.weightedTotal ? bucket.weightedCorrect / bucket.weightedTotal : null;
      return {
        topicId,
        topicName: bucket.topicName,
        topicSlug: bucket.topicSlug,
        correct: bucket.correct,
        attempted: bucket.attempted,
        weightedCorrect: roundScore(bucket.weightedCorrect),
        weightedTotal: roundScore(bucket.weightedTotal),
        accuracy,
        statusLabel: skillStatusLabel(accuracy, bucket.attempted),
      };
    })
    .sort((left, right) => (left.accuracy ?? 1) - (right.accuracy ?? 1));

  const strengths = skillBreakdown
    .filter((skill) => skill.attempted >= 3 && (skill.accuracy ?? 0) >= 0.7)
    .sort((left, right) => (right.accuracy ?? 0) - (left.accuracy ?? 0))
    .slice(0, 3);
  const weakAreas = skillBreakdown
    .filter((skill) => skill.attempted >= 3 && (skill.accuracy ?? 1) < 0.7)
    .sort((left, right) => (left.accuracy ?? 1) - (right.accuracy ?? 1))
    .slice(0, 4);

  return {
    score: roundScore(weightedCorrect),
    total: roundScore(weightedTotal),
    rawCorrect,
    rawAttempted: scored.length,
    weightedAccuracy,
    estimatedLevel,
    ...confidence,
    skillBreakdown,
    topicBreakdown,
    strengths,
    weakAreas,
  };
}

export function diagnosticLevelExplanation(level: Difficulty) {
  return `Level ${difficultyLabels[level]} được ước lượng từ độ chính xác có trọng số theo độ khó.`;
}
