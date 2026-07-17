import "server-only";

import type { LearnerProblemDTO, LearnerQuestionDTO } from "@/lib/dto/learner-question";
import { normalizeLearnerOptions } from "@/lib/dto/learner-question";

export type AdminPreviewQuestionDTO = LearnerQuestionDTO & {
  answer: unknown;
  explanation: string | null;
  metadata: unknown;
  rawOptions: unknown;
};

export type AdminProblemPreviewDTO = Omit<LearnerProblemDTO, "questions"> & {
  questions: AdminPreviewQuestionDTO[];
};

type AdminProblemPreviewSource = Omit<LearnerProblemDTO, "questions"> & {
  questions: Array<{
    id: string;
    type: AdminPreviewQuestionDTO["type"];
    skillType: AdminPreviewQuestionDTO["skillType"];
    difficulty: AdminPreviewQuestionDTO["difficulty"];
    prompt: string;
    passage: string | null;
    options: unknown;
    answer: unknown;
    explanation: string | null;
    rootWord: string | null;
    keyword: string | null;
    targetSentence: string | null;
    lineNumber: number | null;
    metadata: unknown;
    orderIndex: number;
  }>;
};

function metadataString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" && item.trim() ? item : null;
}

/** Admin-only mapping. Full answer fields deliberately remain available here. */
export function toAdminProblemPreviewDTO(problem: AdminProblemPreviewSource): AdminProblemPreviewDTO {
  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    skillType: problem.skillType,
    questionType: problem.questionType,
    difficulty: problem.difficulty,
    contentStatus: problem.contentStatus,
    statement: problem.statement,
    instructions: problem.instructions,
    estimatedMinutes: problem.estimatedMinutes,
    acceptanceRate: problem.acceptanceRate,
    sourceCollection: problem.sourceCollection,
    problemTopics: problem.problemTopics,
    questions: problem.questions.map((question) => ({
      id: question.id,
      type: question.type,
      skillType: question.skillType,
      difficulty: question.difficulty,
      prompt: question.prompt,
      passage: question.passage,
      options: normalizeLearnerOptions(question.options),
      rootWord: question.rootWord,
      keyword: question.keyword,
      targetSentence: question.targetSentence,
      lineNumber: question.lineNumber,
      orderIndex: question.orderIndex,
      problemTitle: problem.title,
      audioUrl: metadataString(question.metadata, "audioUrl"),
      sectionType: metadataString(question.metadata, "sectionType"),
      answer: question.answer,
      explanation: question.explanation,
      metadata: question.metadata,
      rawOptions: question.options,
    })),
  };
}
