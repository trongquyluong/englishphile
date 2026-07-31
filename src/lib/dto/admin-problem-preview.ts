import "server-only";

import type { LearnerProblemDTO, LearnerQuestionDTO } from "@/lib/dto/learner-question";
import { normalizeLearnerQuestionOptions } from "@/lib/dto/learner-question";
import { validateTriosSentences } from "@/lib/questions/trios-contract";
import { projectWritingRubric } from "@/lib/questions/writing-rubric-contract";
import { projectListeningPresentation } from "@/lib/questions/listening-contract";

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
    questions: problem.questions.map((question) => {
      const listeningPresentation = projectListeningPresentation(
        question.metadata,
        question.options,
        question.type
      );

      let options = normalizeLearnerQuestionOptions(question.type, question.options);
      if (question.type === "LISTENING_MCQ" && (!listeningPresentation || listeningPresentation.state === "UNAVAILABLE")) {
        options = [];
      }

      return {
        id: question.id,
        type: question.type,
        skillType: question.skillType,
        difficulty: question.difficulty,
        prompt: question.prompt,
        passage: question.passage,
        options,
        rootWord: question.rootWord,
        keyword: question.keyword,
        targetSentence: question.targetSentence,
        lineNumber: question.lineNumber,
        orderIndex: question.orderIndex,
        problemTitle: problem.title,
        audioUrl: question.type.startsWith("LISTENING_") ? null : metadataString(question.metadata, "audioUrl"),
        sectionType: question.type.startsWith("LISTENING_") ? null : metadataString(question.metadata, "sectionType"),
        triosSentences:
          question.type === "TRIOS_GAPPED_SENTENCES"
            ? validateTriosSentences(question.metadata).sentences
            : null,
        writingRubric:
          question.type === "WRITING_PROMPT"
            ? projectWritingRubric(question.answer)
            : null,
        listeningPresentation,
        answer: question.answer,
        explanation: question.explanation,
        metadata: question.metadata,
        rawOptions: question.options,
      };
    }),
  };
}
