import type { ManualGradeCorrectness, SkillType } from "@prisma/client";
import { skillLabels } from "@/lib/labels";

export type PerformanceBucket = {
  attempted: number;
  correct: number;
  needsReview: number;
};

export type AccuracyStat = PerformanceBucket & {
  accuracy: number | null;
  statusLabel: string;
};

export type AnswerScoreInput = {
  isCorrect: boolean | null;
  manualGrade?: {
    correctness: ManualGradeCorrectness;
    score: number | null;
    maxScore: number | null;
  } | null;
};

export function emptyBucket(): PerformanceBucket {
  return { attempted: 0, correct: 0, needsReview: 0 };
}

export function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export function toAccuracy(bucket: PerformanceBucket) {
  return bucket.attempted > 0 ? bucket.correct / bucket.attempted : null;
}

export function getSkillStatus(accuracy: number | null, attempted: number) {
  if (attempted < 5) return "Chưa đủ dữ liệu";
  if (accuracy !== null && accuracy >= 0.85 && attempted >= 10) return "Mạnh";
  if (accuracy !== null && accuracy >= 0.7) return "Ổn";
  if (accuracy !== null && accuracy >= 0.5) return "Cần luyện thêm";
  return "Yếu";
}

export function finalizeBucket(bucket: PerformanceBucket): AccuracyStat {
  const accuracy = toAccuracy(bucket);
  return {
    ...bucket,
    accuracy,
    statusLabel: getSkillStatus(accuracy, bucket.attempted),
  };
}

export function answerContribution(answer: AnswerScoreInput) {
  if (answer.manualGrade) {
    const { correctness, score, maxScore } = answer.manualGrade;
    if (typeof score === "number" && typeof maxScore === "number" && maxScore > 0) {
      return { attempted: 1, correct: Math.max(0, Math.min(1, score / maxScore)), needsReview: 0 };
    }
    if (correctness === "CORRECT") return { attempted: 1, correct: 1, needsReview: 0 };
    if (correctness === "INCORRECT" || correctness === "NEEDS_REVISION") return { attempted: 1, correct: 0, needsReview: 0 };
    return { attempted: 1, correct: 0.5, needsReview: 0 };
  }

  if (answer.isCorrect === true) return { attempted: 1, correct: 1, needsReview: 0 };
  if (answer.isCorrect === false) return { attempted: 1, correct: 0, needsReview: 0 };
  return { attempted: 0, correct: 0, needsReview: 1 };
}

export function addAnswer(bucket: PerformanceBucket, answer: AnswerScoreInput) {
  const contribution = answerContribution(answer);
  bucket.attempted += contribution.attempted;
  bucket.correct += contribution.correct;
  bucket.needsReview += contribution.needsReview;
}

export function skillDisplayName(skillType: SkillType) {
  return skillLabels[skillType] ?? skillType;
}

export function recommendedAction(accuracy: number | null, attempted: number, label: string) {
  if (attempted < 5) return `Bạn chưa luyện nhiều ${label}.`;
  if (accuracy !== null && accuracy < 0.5) return `${label} đang có độ chính xác thấp.`;
  if (accuracy !== null && accuracy < 0.7) return `Cần luyện thêm ${label}.`;
  return `Duy trì nhịp luyện ${label}.`;
}
