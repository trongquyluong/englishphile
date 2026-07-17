import type {
  DiagnosticAttemptStatus,
  Difficulty,
  SkillType,
} from "@prisma/client";
import type { DiagnosticSectionPlan } from "@/lib/diagnostic-blueprint";

const difficulties: Difficulty[] = ["B2", "C1", "C2", "CHUYEN", "HSG"];
const skills: SkillType[] = [
  "READING",
  "WRITING",
  "LISTENING",
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "TRIOS",
  "COLLOCATIONS",
  "PHRASAL_VERBS",
  "TRANSITIONS",
  "GRAMMAR_FOCUS",
  "USE_OF_ENGLISH",
];

const sectionIds = ["use-of-english-core", "reading", "writing", "listening"] as const;

export type LearnerDiagnosticQuestionResultDTO = {
  questionId: string;
  problemId: string;
  skillType: SkillType;
  difficulty: Difficulty;
  isCorrect: boolean | null;
};

export type LearnerDiagnosticSkillBreakdownDTO = {
  skillType: SkillType;
  label: string;
  correct: number;
  attempted: number;
  weightedCorrect: number;
  weightedTotal: number;
  accuracy: number | null;
  statusLabel: string;
};

export type LearnerDiagnosticTopicBreakdownDTO = {
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

export type LearnerDiagnosticScoringDTO = {
  weightedAccuracy: number | null;
  rawCorrect: number;
  rawAttempted: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  confidenceLabel: string;
  confidenceReason: string;
  strengths: LearnerDiagnosticSkillBreakdownDTO[];
  weakAreas: LearnerDiagnosticSkillBreakdownDTO[];
  levelExplanation: string;
};

export type LearnerDiagnosticMetadataDTO = {
  questionIds: string[];
  sections: DiagnosticSectionPlan[];
  coverageWarnings: string[];
  results: LearnerDiagnosticQuestionResultDTO[];
  scoring: LearnerDiagnosticScoringDTO | null;
};

export type LearnerDiagnosticAttemptSummaryDTO = {
  id: string;
  status: DiagnosticAttemptStatus;
  startedAt: Date;
  completedAt: Date | null;
  score: number | null;
  total: number | null;
  estimatedLevel: Difficulty | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LearnerDiagnosticResultDTO = LearnerDiagnosticAttemptSummaryDTO & {
  status: "COMPLETED" | "NEEDS_REVIEW";
  skillBreakdown: LearnerDiagnosticSkillBreakdownDTO[];
  topicBreakdown: LearnerDiagnosticTopicBreakdownDTO[];
  scoring: LearnerDiagnosticScoringDTO | null;
};

type DiagnosticAttemptSummarySource = {
  id: string;
  status: DiagnosticAttemptStatus;
  startedAt: Date;
  completedAt: Date | null;
  score: number | null;
  total: number | null;
  estimatedLevel: Difficulty | null;
  createdAt: Date;
  updatedAt: Date;
};

type DiagnosticResultSource = DiagnosticAttemptSummarySource & {
  skillBreakdownJson: unknown;
  topicBreakdownJson: unknown;
  recommendationJson: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function skillValue(value: unknown): SkillType | null {
  return typeof value === "string" && skills.includes(value as SkillType)
    ? (value as SkillType)
    : null;
}

function difficultyValue(value: unknown): Difficulty | null {
  return typeof value === "string" && difficulties.includes(value as Difficulty)
    ? (value as Difficulty)
    : null;
}

function sanitizeSkillBreakdown(value: unknown): LearnerDiagnosticSkillBreakdownDTO[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = asRecord(entry);
    const skillType = skillValue(item.skillType);
    if (!skillType) return [];
    return [{
      skillType,
      label: stringValue(item.label),
      correct: numberValue(item.correct),
      attempted: numberValue(item.attempted),
      weightedCorrect: numberValue(item.weightedCorrect),
      weightedTotal: numberValue(item.weightedTotal),
      accuracy: nullableNumber(item.accuracy),
      statusLabel: stringValue(item.statusLabel),
    }];
  });
}

function sanitizeTopicBreakdown(value: unknown): LearnerDiagnosticTopicBreakdownDTO[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = asRecord(entry);
    const topicId = stringValue(item.topicId);
    if (!topicId) return [];
    return [{
      topicId,
      topicName: stringValue(item.topicName),
      topicSlug: stringValue(item.topicSlug),
      correct: numberValue(item.correct),
      attempted: numberValue(item.attempted),
      weightedCorrect: numberValue(item.weightedCorrect),
      weightedTotal: numberValue(item.weightedTotal),
      accuracy: nullableNumber(item.accuracy),
      statusLabel: stringValue(item.statusLabel),
    }];
  });
}

function sanitizeSection(value: unknown): DiagnosticSectionPlan | null {
  const section = asRecord(value);
  const id = stringValue(section.id);
  const title = stringValue(section.title);
  const description = stringValue(section.description);
  if (!sectionIds.includes(id as (typeof sectionIds)[number]) || !title) return null;
  return {
    id: id as (typeof sectionIds)[number],
    title,
    description,
    scored: section.scored === true,
    optional: section.optional === true,
    targetCount: Math.max(0, numberValue(section.targetCount)),
    questionIds: Array.isArray(section.questionIds)
      ? section.questionIds.filter((item): item is string => typeof item === "string")
      : [],
    ...(typeof section.warning === "string" ? { warning: section.warning } : {}),
  };
}

function sanitizeScoring(value: unknown): LearnerDiagnosticScoringDTO | null {
  const scoring = asRecord(value);
  const confidence = scoring.confidence;
  if (confidence !== "LOW" && confidence !== "MEDIUM" && confidence !== "HIGH") {
    return null;
  }
  return {
    weightedAccuracy: nullableNumber(scoring.weightedAccuracy),
    rawCorrect: numberValue(scoring.rawCorrect),
    rawAttempted: numberValue(scoring.rawAttempted),
    confidence,
    confidenceLabel: stringValue(scoring.confidenceLabel),
    confidenceReason: stringValue(scoring.confidenceReason),
    strengths: sanitizeSkillBreakdown(scoring.strengths),
    weakAreas: sanitizeSkillBreakdown(scoring.weakAreas),
    levelExplanation: stringValue(scoring.levelExplanation),
  };
}

/**
 * Allowlist parser for both current and legacy recommendationJson. Sensitive
 * legacy keys such as correctAnswer, feedback, explanation, and answer are
 * ignored even when nested beside safe fields.
 */
export function sanitizeDiagnosticAttemptMetadata(value: unknown): LearnerDiagnosticMetadataDTO {
  const metadata = asRecord(value);
  const results = Array.isArray(metadata.results)
    ? metadata.results.flatMap((entry) => {
        const item = asRecord(entry);
        const questionId = stringValue(item.questionId);
        const problemId = stringValue(item.problemId);
        const skillType = skillValue(item.skillType);
        const difficulty = difficultyValue(item.difficulty);
        const isCorrect = item.isCorrect === true || item.isCorrect === false || item.isCorrect === null
          ? item.isCorrect
          : null;
        if (!questionId || !problemId || !skillType || !difficulty) return [];
        return [{ questionId, problemId, skillType, difficulty, isCorrect }];
      })
    : [];

  return {
    questionIds: Array.isArray(metadata.questionIds)
      ? metadata.questionIds.filter((item): item is string => typeof item === "string")
      : [],
    sections: Array.isArray(metadata.sections)
      ? metadata.sections.flatMap((section) => {
          const sanitized = sanitizeSection(section);
          return sanitized ? [sanitized] : [];
        })
      : [],
    coverageWarnings: Array.isArray(metadata.coverageWarnings)
      ? metadata.coverageWarnings.filter((item): item is string => typeof item === "string")
      : [],
    results,
    scoring: sanitizeScoring(metadata.scoring),
  };
}

export function toLearnerDiagnosticAttemptSummaryDTO(
  attempt: DiagnosticAttemptSummarySource,
): LearnerDiagnosticAttemptSummaryDTO {
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    score: attempt.score,
    total: attempt.total,
    estimatedLevel: attempt.estimatedLevel,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

export function toLearnerDiagnosticResultDTO(
  attempt: DiagnosticResultSource,
): LearnerDiagnosticResultDTO | null {
  if (
    (attempt.status !== "COMPLETED" && attempt.status !== "NEEDS_REVIEW") ||
    attempt.completedAt === null
  ) return null;
  const summary = toLearnerDiagnosticAttemptSummaryDTO(attempt);
  const metadata = sanitizeDiagnosticAttemptMetadata(attempt.recommendationJson);
  return {
    id: summary.id,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    score: summary.score,
    total: summary.total,
    estimatedLevel: summary.estimatedLevel,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    status: attempt.status,
    skillBreakdown: sanitizeSkillBreakdown(attempt.skillBreakdownJson),
    topicBreakdown: sanitizeTopicBreakdown(attempt.topicBreakdownJson),
    scoring: metadata.scoring,
  };
}
