/**
 * Learner-safe DTOs for API responses.
 *
 * These DTOs strip sensitive fields (correctAnswer, answerJson, etc.)
 * that remain server-side after submission.
 *
 * @module lib/dto/submission
 */

import type { SubmissionStatus } from "@prisma/client";

/**
 * DTO returned to learners in submission responses.
 * Does NOT include correct answers — those are stored server-side only.
 */
export interface SubmissionResultDTO {
  submissionId: string;
  status: SubmissionStatus;
  score: number;
  total: number;
  /** Per-question result WITHOUT correct answers */
  answers: QuestionResultDTO[];
}

export interface QuestionResultDTO {
  questionId: string;
  isCorrect: boolean | null;
  feedback: string;
}

export const LEARNER_FEEDBACK = {
  correct: "Chính xác.",
  incorrect: "Chưa chính xác. Hãy xem lại kiến thức liên quan.",
  needsReview: "Đã ghi nhận câu trả lời. Nội dung này đang chờ xem xét.",
} as const;

export function learnerFeedbackForCorrectness(isCorrect: boolean | null): string {
  return isCorrect === true
    ? LEARNER_FEEDBACK.correct
    : isCorrect === false
      ? LEARNER_FEEDBACK.incorrect
      : LEARNER_FEEDBACK.needsReview;
}

/**
 * DTO for random practice responses.
 */
export interface RandomPracticeResultDTO {
  status: SubmissionStatus;
  score: number;
  total: number;
  /** Per-question result WITHOUT correct answers */
  answers: QuestionResultDTO[];
}

type SubmissionResultSource = {
  submissionId: string;
  status: SubmissionStatus;
  score: number;
  total: number;
  answers: Array<{ questionId: string; isCorrect: boolean | null }>;
};

type RandomPracticeResultSource = Omit<SubmissionResultSource, "submissionId">;

/**
 * Helper to convert internal check result to safe DTO.
 * Strips correctAnswer before returning to client.
 */
export function toQuestionResult(
  questionId: string,
  isCorrect: boolean | null,
): QuestionResultDTO {
  return { questionId, isCorrect, feedback: learnerFeedbackForCorrectness(isCorrect) };
}

export function toSubmissionResultDTO(source: SubmissionResultSource): SubmissionResultDTO {
  return {
    submissionId: source.submissionId,
    status: source.status,
    score: source.score,
    total: source.total,
    answers: source.answers.map(({ questionId, isCorrect }) => toQuestionResult(questionId, isCorrect)),
  };
}

export function toRandomPracticeResultDTO(
  source: RandomPracticeResultSource,
): RandomPracticeResultDTO {
  return {
    status: source.status,
    score: source.score,
    total: source.total,
    answers: source.answers.map(({ questionId, isCorrect }) => toQuestionResult(questionId, isCorrect)),
  };
}
