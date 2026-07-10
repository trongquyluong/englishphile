/**
 * Learner-safe DTOs for API responses.
 *
 * These DTOs strip sensitive fields (correctAnswer, answerJson, etc.)
 * that should only be revealed after submission and proper authorization.
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
  // NOTE: correctAnswer is intentionally omitted
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

/**
 * DTO for assignment submission responses.
 */
export interface AssignmentSubmissionResultDTO {
  assignmentSubmissionId: string;
  status: "LATE" | "NEEDS_REVIEW" | "SUBMITTED";
  score: number;
  total: number;
  problems: ProblemResultDTO[];
}

export interface ProblemResultDTO {
  problemId: string;
  score: number;
  total: number;
  status: SubmissionStatus;
  /** Per-question result WITHOUT correct answers */
  answers: QuestionResultDTO[];
}

/**
 * Helper to convert internal check result to safe DTO.
 * Strips correctAnswer before returning to client.
 */
export function toQuestionResult(
  questionId: string,
  isCorrect: boolean | null,
  feedback: string,
): QuestionResultDTO {
  return { questionId, isCorrect, feedback };
}
